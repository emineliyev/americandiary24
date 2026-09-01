import re
from datetime import datetime, timezone

import django_filters
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.db.models import Count
from django.http import FileResponse, Http404
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.models import ContactMessage, MediaAsset, MediaFolder, Page, SiteSettings
from news.api_views import IsTaxonomyManagerOrReadOnly, _create_media_asset
from news.models import Article, Author, Quote

from .permissions import IsAdministratorOnly, IsMediaManager
from .serializers import (
    ContactMessageCreateSerializer, ContactMessageSerializer, MediaAssetSerializer,
    MediaFolderSerializer, PageSerializer, SiteSettingsSerializer, UserSerializer,
)


class PageViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Editor for the site's fixed set of static pages (About, Contact,
    Privacy Policy, ...) — list + edit only, no create/delete: every page's
    URL is wired individually by slug in core/urls.py, so there's nowhere
    for an admin-created page to actually be served, and deleting one of
    these would 404 a real, linked route."""

    queryset = Page.objects.all().order_by('title')
    serializer_class = PageSerializer
    permission_classes = [IsMediaManager]
    pagination_class = None


class ContactMessageThrottle(AnonRateThrottle):
    # Basic spam guard on an open, unauthenticated write endpoint — keyed by
    # the requester's IP (AnonRateThrottle's default), not per-user.
    scope = 'contact'


class ContactMessageCreateView(generics.CreateAPIView):
    """Public Contact-page form submission — no auth required. Feeds the
    admin panel's Inquiries inbox (ContactMessageViewSet)."""

    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageCreateSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ContactMessageThrottle]


class ContactMessageViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet,
):
    """Inquiries inbox — read-only on the message content (see
    ContactMessageSerializer), PATCH only flips is_read, DELETE removes
    spam/handled messages. Same manager tier as Pages."""

    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [IsMediaManager]
    pagination_class = None


class SiteSettingsView(viewsets.ViewSet):
    """Singleton — GET/PATCH the one SiteSettings row directly, no list/id
    in the URL. Contact info here is public-facing; the GA/AdSense IDs are
    revenue/tracking-sensitive, so this is Administrator-only rather than
    the wider manager tier Pages/Categories use."""

    permission_classes = [IsAdministratorOnly]

    def list(self, request):
        serializer = SiteSettingsSerializer(SiteSettings.load())
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        instance = SiteSettings.load()
        serializer = SiteSettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    """Admin-panel logins. No hard delete — "removing" a user deactivates
    the login and un-publishes their journalist profile (if any) instead,
    consistent with the rest of the admin panel's no-hard-delete stance."""

    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAdministratorOnly]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        author = getattr(user, 'author_profile', None)
        if author is not None:
            author.show_on_about = False
            author.save(update_fields=['show_on_about'])
        return Response(status=204)


class MediaFolderViewSet(viewsets.ModelViewSet):
    # Flat (non-nested) grouping — same manager tier as Categories/Tags
    # since folder structure is shared across everyone using the library.
    serializer_class = MediaFolderSerializer
    permission_classes = [IsTaxonomyManagerOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        # MediaAsset.folder is SET_NULL, so the default destroy() already
        # does the right thing on delete — assets just become unfiled
        # (reappear under "Bütün fayllar"), never get deleted themselves.
        return MediaFolder.objects.annotate(asset_count=Count('assets')).order_by('order', 'name')


class MediaAssetFilter(django_filters.FilterSet):
    # `format` is DRF's own reserved query param for content-negotiation
    # (?format=json chooses a renderer) — filtering by MediaAsset.format
    # through that same name silently 404s ("no renderer for ?format=webp")
    # instead of filtering, so it's exposed under a different query param
    # name here while the model field itself stays `format`.
    file_format = django_filters.CharFilter(field_name='format')

    class Meta:
        model = MediaAsset
        fields = ['folder', 'file_format']


class MediaAssetViewSet(viewsets.ModelViewSet):
    """Browsing/uploading/organizing is open to any authenticated role (a
    Müəllif writing an article needs to upload/reuse images too), but
    deleting a shared asset can break someone else's article or avatar, so
    that alone is restricted to the taxonomy-manager tier — see
    get_permissions()."""

    queryset = MediaAsset.objects.select_related('folder').all()
    serializer_class = MediaAssetSerializer
    filterset_class = MediaAssetFilter
    search_fields = ['original_filename']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsMediaManager()]
        return [permissions.IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'No file provided.'}, status=400)

        folder_id = request.data.get('folder') or None
        folder = MediaFolder.objects.filter(pk=folder_id).first() if folder_id else None
        asset = _create_media_asset(upload, user=request.user, folder=folder)
        serializer = self.get_serializer(asset)
        return Response(serializer.data, status=201)

    def destroy(self, request, *args, **kwargs):
        asset = self.get_object()
        path = asset.file.name

        used_by = []
        if Article.objects.filter(image=path).exists():
            used_by.append('an article\'s main image')
        if Author.objects.filter(avatar=path).exists():
            used_by.append('a journalist avatar')
        if Quote.objects.filter(photo=path).exists():
            used_by.append('a quote photo')
        if used_by:
            return Response(
                {'detail': f'This file is still set as {", ".join(used_by)} and can\'t be deleted.'},
                status=400,
            )

        # Best-effort only — in-body CKEditor images aren't a structured
        # field, so this is a substring scan rather than an authoritative
        # reference check. Surfaced to the frontend as a soft warning (via
        # ?force=true to proceed anyway), not a hard block like the
        # structured cases above.
        in_body_count = Article.objects.filter(body__icontains=asset.file.url).count()
        if in_body_count and request.query_params.get('force') != 'true':
            return Response(
                {'detail': f'This image appears in {in_body_count} article body(ies).', 'in_use_count': in_body_count},
                status=409,
            )

        asset.file.delete(save=False)
        asset.delete()
        return Response(status=204)


_BACKUP_FILENAME_RE = re.compile(r'^backup_\d{8}_\d{6}\.tar\.gz$')


def _backup_dir():
    d = settings.BASE_DIR / 'backups'
    d.mkdir(exist_ok=True)
    return d


class BackupListCreateView(APIView):
    """Full-site backups (database dump + media) — Administrator only,
    since a backup file contains everything: user credentials, contact
    form submissions, the works. GET lists what's on disk (also populated
    by the VPS's daily cron job, not just manual creates here); POST runs
    create_backup synchronously — acceptable for a manually-triggered,
    infrequent admin action on a site this size, no background job
    infrastructure needed."""
    permission_classes = [IsAdministratorOnly]

    def get(self, request):
        backups = []
        for path in sorted(_backup_dir().glob('backup_*.tar.gz'), key=lambda p: p.stat().st_mtime, reverse=True):
            stat = path.stat()
            backups.append({
                'filename': path.name,
                'size_bytes': stat.st_size,
                'created_at': datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
        return Response(backups)

    def post(self, request):
        try:
            call_command('create_backup')
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(status=status.HTTP_201_CREATED)


class BackupDetailView(APIView):
    """Download or delete one backup file. Filename is validated against a
    strict pattern (not just "does this path exist") before ever touching
    the filesystem, so a crafted filename can't walk outside backups/."""
    permission_classes = [IsAdministratorOnly]

    def _resolve(self, filename):
        if not _BACKUP_FILENAME_RE.match(filename):
            raise Http404
        path = _backup_dir() / filename
        if not path.exists():
            raise Http404
        return path

    def get(self, request, filename):
        path = self._resolve(filename)
        return FileResponse(open(path, 'rb'), as_attachment=True, filename=path.name)

    def delete(self, request, filename):
        path = self._resolve(filename)
        path.unlink()
        return Response(status=status.HTTP_204_NO_CONTENT)
