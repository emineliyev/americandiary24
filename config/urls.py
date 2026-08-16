from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('core.urls')),
    path('', include('news.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# 500.html uses Django's default handler, which deliberately renders with an
# empty context (no context processors) so it stays robust even when the
# error is a DB/context-processor failure. 404 gets a custom view instead so
# it can show real "latest news" — safe since routing failures are not
# server failures.
handler404 = 'core.views.custom_404'
