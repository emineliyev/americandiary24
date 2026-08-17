from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.urls import include, path

from news.api_views import (
    ArticleViewSet, AuthorViewSet, CategoryViewSet, TagViewSet, article_image_upload, dashboard_stats,
)

router = DefaultRouter()
router.register('articles', ArticleViewSet, basename='article')
router.register('categories', CategoryViewSet, basename='category')
router.register('authors', AuthorViewSet, basename='author')
router.register('tags', TagViewSet, basename='tag')

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('articles/<int:pk>/image/', article_image_upload, name='article-image-upload'),
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('', include(router.urls)),
]
