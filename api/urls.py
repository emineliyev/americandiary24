from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.urls import include, path

from news.api_views import (
    ArticleViewSet, AuthorViewSet, CategoryViewSet, TagViewSet,
    body_image_upload, change_password, current_user, dashboard_stats,
)
from .views import (
    BackupDetailView, BackupListCreateView, ContactMessageCreateView, ContactMessageViewSet,
    MediaAssetViewSet, MediaFolderViewSet, PageViewSet, SiteSettingsView, UserViewSet,
)

router = DefaultRouter()
router.register('articles', ArticleViewSet, basename='article')
router.register('categories', CategoryViewSet, basename='category')
router.register('authors', AuthorViewSet, basename='author')
router.register('tags', TagViewSet, basename='tag')
router.register('users', UserViewSet, basename='user')
router.register('media-folders', MediaFolderViewSet, basename='media-folder')
router.register('media', MediaAssetViewSet, basename='media-asset')
router.register('pages', PageViewSet, basename='page')
router.register('contact-messages', ContactMessageViewSet, basename='contact-message')

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('uploads/body-image/', body_image_upload, name='body-image-upload'),
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('auth/me/', current_user, name='current-user'),
    path('auth/change-password/', change_password, name='change-password'),
    # Singleton — GET/PATCH the one row directly, no list/id in the URL.
    path('site-settings/', SiteSettingsView.as_view({'get': 'list', 'patch': 'partial_update'}), name='site-settings'),
    # Public, unauthenticated — the Contact page's own form posts here.
    path('public/contact/', ContactMessageCreateView.as_view(), name='public-contact'),
    path('backups/', BackupListCreateView.as_view(), name='backup-list-create'),
    path('backups/<str:filename>/', BackupDetailView.as_view(), name='backup-detail'),
    path('', include(router.urls)),
]
