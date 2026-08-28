from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.urls import include, path
from django.views.decorators.cache import cache_page

from core import views as core_views
from core.sitemaps import PageSitemap, StaticSitemap
from news.sitemaps import ArticleSitemap, AuthorSitemap, CategorySitemap, TagSitemap

sitemaps = {
    'static': StaticSitemap,
    'pages': PageSitemap,
    'categories': CategorySitemap,
    'articles': ArticleSitemap,
    'tags': TagSitemap,
    'team': AuthorSitemap,
}

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.urls')),
    path('sitemap.xml', cache_page(60 * 60)(sitemap), {'sitemaps': sitemaps}, name='sitemap'),
    path('robots.txt', core_views.robots_txt, name='robots'),
    path('ads.txt', core_views.ads_txt, name='ads_txt'),
    path('', include('core.urls')),
    path('', include('news.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += [path('__debug__/', include('debug_toolbar.urls'))]

# 500.html uses Django's default handler, which deliberately renders with an
# empty context (no context processors) so it stays robust even when the
# error is a DB/context-processor failure. 404 gets a custom view instead so
# it can show real "latest news" — safe since routing failures are not
# server failures.
handler404 = 'core.views.custom_404'
