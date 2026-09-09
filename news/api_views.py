import html
import io
import re
import uuid
import zipfile
from datetime import timedelta

from bs4 import BeautifulSoup
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import Count, ProtectedError
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from api.permissions import IsAdministratorOrReadOnly
from core.models import MediaAsset

from .models import Article, Author, Category, Tag
from .serializers import (
    ArticleListSerializer, ArticleSerializer, AuthorSerializer, CategorySerializer, TagSerializer,
)


class IsOwnArticleOrEditorRole(permissions.BasePermission):
    """Administrator / Baş Redaktor / Redaktor can touch any article.
    Müəllif (no elevated group) can only edit articles whose `author`
    is their own linked Author profile. Trashing/restoring/permanently
    deleting is further restricted to Administrator / Baş Redaktor —
    Redaktor can create/edit/publish but not delete, per the role table.
    Duplicating is edit-adjacent, not delete-tier, so it falls through to
    the normal own-article-or-editor check below."""

    EDITOR_GROUPS = {'Administrator', 'Baş Redaktor', 'Redaktor'}
    DELETE_GROUPS = {'Administrator', 'Baş Redaktor'}
    DELETE_TIER_ACTIONS = {'destroy', 'restore', 'permanent_delete'}

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if getattr(view, 'action', None) in self.DELETE_TIER_ACTIONS:
            return user.is_superuser or user.groups.filter(name__in=self.DELETE_GROUPS).exists()
        if user.is_superuser or user.groups.filter(name__in=self.EDITOR_GROUPS).exists():
            return True
        author = getattr(user, 'author_profile', None)
        return author is not None and obj.author_id == author.id


class IsTaxonomyManagerOrReadOnly(permissions.BasePermission):
    """Categories/Authors/Tags are shared site structure, not per-author
    content — every logged-in role can read them (the Article form's
    pickers need that), but only Administrator / Baş Redaktor can
    create, edit, or delete them. Redaktor and Müəllif pick from the
    existing list rather than reshape it."""

    MANAGER_GROUPS = {'Administrator', 'Baş Redaktor'}

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_superuser or request.user.groups.filter(name__in=self.MANAGER_GROUPS).exists()


class ProtectedDestroyMixin:
    """Category/Author use on_delete=PROTECT — turn the resulting
    ProtectedError into a friendly 400 instead of a 500."""

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'This is still in use by one or more articles and can\'t be deleted.'},
                status=400,
            )


class ArticleViewSet(viewsets.ModelViewSet):
    """Archiving (PATCH status=archived) is the everyday "remove this from
    the site" action, available to anyone who can edit the article —
    distinct from trashing (DELETE / `destroy`), which soft-deletes into
    the admin panel's Silinənlər tab (see `destroy`/`restore`/
    `permanent_delete` below), restricted to Administrator/Baş Redaktor by
    IsOwnArticleOrEditorRole.DELETE_GROUPS."""
    permission_classes = [IsOwnArticleOrEditorRole]
    filterset_fields = ['status', 'category']
    search_fields = ['title']

    def get_queryset(self):
        # `all_objects` (not the default-excludes-trashed `objects`) so the
        # Silinənlər tab can list trashed rows via ?deleted=true — everyone
        # else (public views, sitemaps, dashboard_stats) keeps using
        # `Article.objects` and never sees trashed rows at all.
        qs = Article.all_objects.select_related('category', 'author').prefetch_related('tags').order_by('-updated_at')
        # Only the `list` action splits on active/trashed — detail actions
        # (retrieve/update/destroy/restore/permanent_delete/duplicate) look
        # up a specific known id regardless of its trashed state, since
        # e.g. `restore` would otherwise never find the very row it's
        # meant to restore (it's trashed by definition when restore is
        # called).
        if self.action == 'list':
            show_deleted = self.request.query_params.get('deleted') == 'true'
            qs = qs.filter(deleted_at__isnull=not show_deleted)
        user = self.request.user
        if user.is_superuser or user.groups.filter(name__in=IsOwnArticleOrEditorRole.EDITOR_GROUPS).exists():
            return qs
        author = getattr(user, 'author_profile', None)
        return qs.filter(author=author) if author else qs.none()

    def get_serializer_class(self):
        return ArticleListSerializer if self.action == 'list' else ArticleSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_superuser or user.groups.filter(name__in=IsOwnArticleOrEditorRole.EDITOR_GROUPS).exists()):
            # A Müəllif can only ever author their own bylines, regardless
            # of what author_id they send.
            serializer.save(author=getattr(user, 'author_profile', None))
        else:
            serializer.save()
        # Public-cache invalidation happens in news/signals.py's
        # clear_public_cache (post_save on Article) — covers this and every
        # other save path (Django admin, scripts), not just this view.

    def destroy(self, request, *args, **kwargs):
        """Soft delete — moves the article to the Silinənlər tab instead of
        actually deleting it. The post_save cache-clear signal already
        fires from this save, so it disappears from the public site right
        away; the media-cleanup post_delete signal correctly doesn't fire,
        since nothing was actually deleted yet."""
        article = self.get_object()
        article.deleted_at = timezone.now()
        article.save(update_fields=['deleted_at'])
        return Response(status=204)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        article = self.get_object()
        article.deleted_at = None
        article.save(update_fields=['deleted_at'])
        return Response(ArticleSerializer(article, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def permanent_delete(self, request, pk=None):
        article = self.get_object()
        article.delete()  # real delete — media-cleanup + cache-clear signals fire as usual
        return Response(status=204)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        original = self.get_object()
        user = request.user
        is_editor = user.is_superuser or user.groups.filter(name__in=IsOwnArticleOrEditorRole.EDITOR_GROUPS).exists()
        # Same authorship rule as perform_create: a Müəllif can only ever
        # own their own bylines; editors keep whatever the source had.
        author = original.author if is_editor else getattr(user, 'author_profile', None)
        if author is None:
            return Response({'detail': 'Your account has no journalist profile to credit this copy to.'}, status=400)

        title = f'{original.title} (Copy)'
        base_slug = slugify(title)
        slug = base_slug
        suffix = 2
        while Article.all_objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{suffix}'
            suffix += 1

        copy = Article.objects.create(
            title=title, slug=slug, dek=original.dek, body=original.body,
            meta_title=original.meta_title, meta_description=original.meta_description,
            image=original.image.name, image_credit=original.image_credit,
            category=original.category, author=author,
            status=Article.Status.DRAFT, published_at=None, view_count=0,
            is_breaking=original.is_breaking, is_exclusive=original.is_exclusive,
            is_editors_pick=original.is_editors_pick, is_indexed=original.is_indexed,
            show_author_name=original.show_author_name,
        )
        copy.co_authors.set(original.co_authors.all())
        copy.tags.set(original.tags.all())
        return Response(ArticleSerializer(copy, context={'request': request}).data, status=201)

    @action(detail=False, methods=['post'])
    def bulk_export(self, request):
        """Export one or more articles as raw-HTML files for offline
        editing (title + dek + body — everything else about the article is
        untouched by the round trip). One .html download for a single
        article, a .zip for several. The filename (`{id}__{slug}.html`) is
        the source of truth for which article a re-imported file targets —
        <title>, the dek <meta> tag, and <body> are standard enough to
        survive being opened in almost any editor, unlike e.g. HTML
        comments some tools strip."""
        ids = request.data.get('ids') or []
        articles = list(self.get_queryset().filter(pk__in=ids))
        if not articles:
            return Response({'detail': 'No matching articles found.'}, status=400)

        def build_html(article):
            return (
                '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n'
                f'<title>{html.escape(article.title)}</title>\n'
                f'<meta name="dek" content="{html.escape(article.dek)}">\n</head>\n<body>\n'
                f'{article.body}\n</body>\n</html>\n'
            )

        def export_filename(article):
            slug_part = slugify(article.title)[:50] or 'untitled'
            return f'{article.id}__{slug_part}.html'

        if len(articles) == 1:
            article = articles[0]
            # application/octet-stream (not text/html) forces a download in
            # every browser and — locally, with DEBUG=True — keeps Django
            # Debug Toolbar from splicing its own UI into the file: it only
            # instruments text/html responses, and its injected markup has
            # nothing to do with the article but would still land inside
            # the downloaded .html. Production never has the toolbar
            # installed at all, so this only matters for local testing.
            response = HttpResponse(build_html(article), content_type='application/octet-stream')
            response['Content-Disposition'] = f'attachment; filename="{export_filename(article)}"'
            return response

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for article in articles:
                zf.writestr(export_filename(article), build_html(article))
        response = HttpResponse(buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="articles-export.zip"'
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def import_preview(self, request):
        """First step of the two-step import flow: parses the uploaded
        file(s), reports what *would* change per article, and makes no
        database writes at all. The frontend holds this response in memory
        and lets the admin uncheck any row before calling import_apply —
        nothing is committed here, so a bad upload is always safe to
        preview and walk away from."""
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'No file provided.'}, status=400)

        files = []  # (filename, content_bytes)
        if upload.name.lower().endswith('.zip'):
            try:
                with zipfile.ZipFile(upload) as zf:
                    for name in zf.namelist():
                        if name.lower().endswith('.html'):
                            files.append((name.rsplit('/', 1)[-1], zf.read(name)))
            except zipfile.BadZipFile:
                return Response({'detail': 'That doesn\'t look like a valid .zip file.'}, status=400)
        else:
            files.append((upload.name, upload.read()))

        if not files:
            return Response({'detail': 'No .html files found in the upload.'}, status=400)

        queryset = self.get_queryset()
        results = []
        for filename, content in files:
            match = re.match(r'^(\d+)__.*\.html$', filename, re.IGNORECASE)
            if not match:
                results.append({
                    'filename': filename, 'id': None, 'found': False,
                    'error': 'Could not read an article ID from this filename — don\'t rename exported files.',
                })
                continue

            article_id = int(match.group(1))
            article = queryset.filter(pk=article_id).first()
            if article is None:
                results.append({
                    'filename': filename, 'id': article_id, 'found': False,
                    'error': 'No article with this ID (or you don\'t have permission to edit it).',
                })
                continue

            try:
                soup = BeautifulSoup(content.decode('utf-8', errors='replace'), 'html.parser')
                title_tag = soup.find('title')
                dek_tag = soup.find('meta', attrs={'name': 'dek'})
                body_tag = soup.find('body')
                new_title = title_tag.get_text().strip() if title_tag else ''
                new_dek = dek_tag.get('content', '').strip() if dek_tag else ''
                new_body = body_tag.decode_contents().strip() if body_tag else ''
            except Exception as e:
                results.append({
                    'filename': filename, 'id': article_id, 'found': True,
                    'error': f'Could not parse this file as HTML: {e}',
                })
                continue

            if not new_title or not new_body:
                results.append({
                    'filename': filename, 'id': article_id, 'found': True,
                    'error': 'Missing a <title> or <body> — the file structure looks broken.',
                })
                continue

            results.append({
                'filename': filename, 'id': article_id, 'found': True, 'error': None,
                'old_title': article.title, 'new_title': new_title,
                'old_dek': article.dek, 'new_dek': new_dek, 'new_body': new_body,
                'updated_at': article.updated_at.isoformat(),
            })
        return Response(results)

    @action(detail=False, methods=['post'])
    def import_apply(self, request):
        """Second step — applies exactly the items the frontend sends
        (whatever survived the admin's review of import_preview's output).
        Re-checks permission and updated_at per item, independently of
        preview, since time may have passed between the two calls."""
        items = request.data.get('items') or []
        queryset = self.get_queryset()
        results = []
        for item in items:
            article_id = item.get('id')
            article = queryset.filter(pk=article_id).first()
            if article is None:
                results.append({'id': article_id, 'success': False, 'error': 'Article not found.'})
                continue
            if item.get('updated_at') and article.updated_at.isoformat() != item['updated_at']:
                results.append({
                    'id': article_id, 'success': False,
                    'error': 'This article was changed since you previewed the import — re-export and try again.',
                })
                continue
            article.title = item.get('new_title', article.title)
            article.dek = item.get('new_dek', article.dek)
            article.body = item.get('new_body', article.body)
            article.save(update_fields=['title', 'dek', 'body'])
            results.append({'id': article_id, 'success': True, 'error': None})
        return Response(results)


class CategoryViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    # Small, fixed-ish list (13 categories) — the Article form's category
    # picker wants all of them in one response, not paginated.
    queryset = Category.objects.all().order_by('order', 'name')
    serializer_class = CategorySerializer
    permission_classes = [IsTaxonomyManagerOrReadOnly]
    pagination_class = None


class AuthorViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    # Managed exclusively from the admin panel's Users screen (see the
    # IsAdministratorOnly docstring) — not a standalone "Authors" section.
    # Still used read-only by the Article form's author picker for every role.
    queryset = Author.objects.all().order_by('order', 'name')
    serializer_class = AuthorSerializer
    permission_classes = [IsAdministratorOrReadOnly]
    pagination_class = None


class TagViewSet(viewsets.ModelViewSet):
    # Thousands of tags (mostly single-article legacy ones) — left
    # paginated with search, so the picker searches-as-you-type instead
    # of shipping the whole table on every page load. Tags are a plain
    # M2M (no PROTECT), so a normal destroy is safe as-is.
    queryset = Tag.objects.all().order_by('name')
    serializer_class = TagSerializer
    permission_classes = [IsTaxonomyManagerOrReadOnly]
    search_fields = ['name']


def _to_webp(upload, quality=82):
    """Shared crop-to-WebP conversion for the admin panel's image pipeline
    — the original upload is never kept, only the converted bytes."""
    img = Image.open(upload)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGBA')
    else:
        img = img.convert('RGB')
    buffer = io.BytesIO()
    img.save(buffer, format='WEBP', quality=quality)
    return ContentFile(buffer.getvalue())


_SVG_WIDTH_HEIGHT_RE = re.compile(r'<svg[^>]*\bwidth="([\d.]+)[^"]*"[^>]*\bheight="([\d.]+)[^"]*"', re.IGNORECASE | re.DOTALL)
_SVG_VIEWBOX_RE = re.compile(r'<svg[^>]*\bviewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"', re.IGNORECASE | re.DOTALL)


def _svg_dimensions(raw_bytes):
    """SVGs aren't rasterizable via Pillow — a best-effort regex read of the
    root <svg> tag's width/height (or viewBox as a fallback) instead of a
    full XML parse. Returns (None, None) if neither is present/parseable;
    the Media Library just shows file size without dimensions in that case."""
    text = raw_bytes.decode('utf-8', errors='ignore')
    match = _SVG_WIDTH_HEIGHT_RE.search(text) or _SVG_VIEWBOX_RE.search(text)
    if not match:
        return None, None
    try:
        return round(float(match.group(1))), round(float(match.group(2)))
    except ValueError:
        return None, None


def _create_media_asset(upload, *, user, folder=None):
    """Shared upload+convert+catalog pipeline reused by every image entry
    point (Article main image, Author avatar, CKEditor body images, and
    direct Media Library uploads via MediaAssetViewSet.create) so all of
    them are tracked and show up in the Media Library. JPEG/PNG/WebP are
    normalized to WebP via _to_webp(); SVG is kept as-is (vector, not
    rasterizable). The model field this asset backs (if any) should point
    at `asset.file.name` directly rather than re-uploading the same bytes a
    second time — otherwise the Media Library's "still in use" delete
    check, which matches on that exact path, would never match."""
    original_filename = getattr(upload, 'name', '') or ''
    is_svg = original_filename.lower().endswith('.svg') or getattr(upload, 'content_type', '') == 'image/svg+xml'

    if is_svg:
        raw = upload.read()
        content = ContentFile(raw)
        ext, fmt = 'svg', 'svg'
        width, height = _svg_dimensions(raw)
    else:
        content = _to_webp(upload)
        ext, fmt = 'webp', 'webp'
        with Image.open(content) as img:
            width, height = img.size
        content.seek(0)

    size_bytes = content.size
    today = timezone.now()
    path = default_storage.save(f'uploads/{today:%Y}/{today:%m}/{uuid.uuid4().hex[:12]}.{ext}', content)

    return MediaAsset.objects.create(
        file=path, original_filename=original_filename, folder=folder,
        format=fmt, width=width, height=height, size_bytes=size_bytes,
        uploaded_by=user if getattr(user, 'is_authenticated', False) else None,
    )


@api_view(['POST'])
@parser_classes([MultiPartParser])
@permission_classes([permissions.IsAuthenticated])
def body_image_upload(request):
    """For images inserted into the CKEditor article body — there can be
    many per article and the article may not even be saved yet (CKEditor's
    upload adapter needs a static endpoint, not a parent record), so these
    aren't tied to a model field or an article ID at all. Any authenticated
    admin-panel user is trusted to upload while writing their own content —
    there's no article to check object-level permission against yet."""
    upload = request.FILES.get('image')
    if not upload:
        return Response({'detail': 'No image file provided.'}, status=400)

    asset = _create_media_asset(upload, user=request.user)
    return Response({'url': request.build_absolute_uri(asset.file.url)})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_user(request):
    user = request.user
    groups = list(user.groups.values_list('name', flat=True))
    role = 'Administrator' if user.is_superuser else (groups[0] if groups else 'Müəllif')
    author = getattr(user, 'author_profile', None)
    return Response({
        'username': user.username,
        'role': role,
        'author_id': getattr(author, 'id', None),
        'author_name': getattr(author, 'name', None),
        'author_avatar': request.build_absolute_uri(author.avatar.url) if author and author.avatar else None,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Self-service password change, reachable from the topbar key icon —
    distinct from the Users screen's password field, which is
    Administrator-only and used to reset *other* people's passwords. Every
    role needs some way to change their own, since only Administrators can
    reach the Users screen at all."""
    user = request.user
    current_password = request.data.get('current_password', '')
    new_password = request.data.get('new_password', '')

    if not user.check_password(current_password):
        return Response({'detail': 'Current password is incorrect.'}, status=400)

    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as e:
        return Response({'detail': ' '.join(e.messages)}, status=400)

    user.set_password(new_password)
    user.save(update_fields=['password'])
    return Response(status=204)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Per TZ bənd 35. Scoped the same way the Article list is: editors see
    the whole site, a Müəllif sees only their own numbers."""
    user = request.user
    qs = Article.objects.select_related('category', 'author')
    if not (user.is_superuser or user.groups.filter(name__in=IsOwnArticleOrEditorRole.EDITOR_GROUPS).exists()):
        author = getattr(user, 'author_profile', None)
        qs = qs.filter(author=author) if author else qs.none()

    today = timezone.now().date()
    published_qs = qs.filter(status=Article.Status.PUBLISHED)
    published_total = published_qs.count()

    week_start = today - timedelta(days=6)
    counts_by_day = {
        row['published_at__date']: row['count']
        for row in published_qs.filter(published_at__date__gte=week_start)
            .values('published_at__date').annotate(count=Count('id'))
    }
    weekly = [
        {'date': (week_start + timedelta(days=i)).isoformat(), 'count': counts_by_day.get(week_start + timedelta(days=i), 0)}
        for i in range(7)
    ]

    by_category = [
        {
            'name': row['category__name'],
            'count': row['count'],
            'percent': round(row['count'] / published_total * 100, 1) if published_total else 0,
        }
        for row in published_qs.values('category__name').annotate(count=Count('id')).order_by('-count')
    ]

    data = {
        'total': qs.count(),
        'published': published_total,
        'published_today': published_qs.filter(published_at__date=today).count(),
        'drafts': qs.filter(status=Article.Status.DRAFT).count(),
        'scheduled': qs.filter(status=Article.Status.SCHEDULED).count(),
        'categories_count': Category.objects.count(),
        'users_count': User.objects.filter(is_active=True).count(),
        'weekly': weekly,
        'by_category': by_category,
        'most_read': ArticleListSerializer(published_qs.order_by('-view_count')[:5], many=True).data,
        'latest': ArticleListSerializer(qs.order_by('-updated_at')[:5], many=True).data,
    }
    return Response(data)
