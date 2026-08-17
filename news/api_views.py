import io

from django.core.cache import cache
from django.core.files.base import ContentFile
from PIL import Image
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Article, Author, Category, Tag
from .serializers import (
    ArticleListSerializer, ArticleSerializer, AuthorSerializer, CategorySerializer, TagSerializer,
)


class IsOwnArticleOrEditorRole(permissions.BasePermission):
    """Administrator / Baş Redaktor / Redaktor can touch any article.
    Müəllif (no elevated group) can only edit articles whose `author`
    is their own linked Author profile."""

    EDITOR_GROUPS = {'Administrator', 'Baş Redaktor', 'Redaktor'}

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.groups.filter(name__in=self.EDITOR_GROUPS).exists():
            return True
        author = getattr(user, 'author_profile', None)
        return author is not None and obj.author_id == author.id


class ArticleViewSet(viewsets.ModelViewSet):
    """No DELETE: per the TZ's soft-delete requirement, "deleting" an
    article from the admin panel means PATCHing status to Archived, not a
    real destroy — so hard delete is simply not exposed here at all."""
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']
    permission_classes = [IsOwnArticleOrEditorRole]
    filterset_fields = ['status', 'category']
    search_fields = ['title']

    def get_queryset(self):
        qs = Article.objects.select_related('category', 'author').prefetch_related('tags').order_by('-updated_at')
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

    def perform_update(self, serializer):
        # Cache invalidation for the public site is TTL-based (see the
        # cache_page decorators in core/views.py + news/views.py) rather
        # than precise per-article, except for the pieces that ARE cheap
        # and precise to clear: the shared most_read list.
        serializer.save()
        cache.delete('most_read')


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all().order_by('order', 'name')
    serializer_class = CategorySerializer


class AuthorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Author.objects.all().order_by('name')
    serializer_class = AuthorSerializer


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all().order_by('name')
    serializer_class = TagSerializer


@api_view(['POST'])
@parser_classes([MultiPartParser])
@permission_classes([permissions.IsAuthenticated])
def article_image_upload(request, pk):
    """Receives an already-cropped image from the admin panel, converts it
    to WebP, and discards the original — per the agreed image pipeline."""
    article = Article.objects.get(pk=pk)
    if not IsOwnArticleOrEditorRole().has_object_permission(request, None, article):
        return Response({'detail': 'Not allowed to edit this article.'}, status=403)

    upload = request.FILES.get('image')
    if not upload:
        return Response({'detail': 'No image file provided.'}, status=400)

    img = Image.open(upload)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGBA')
    else:
        img = img.convert('RGB')

    buffer = io.BytesIO()
    img.save(buffer, format='WEBP', quality=82)
    filename = f'article-{pk}.webp'

    article.image.save(filename, ContentFile(buffer.getvalue()), save=True)
    return Response({'image': article.image.url})
