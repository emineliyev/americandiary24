from django.conf import settings
from django.core.cache import cache

from news.models import Category

from .models import SiteSettings

# Long TTL as a safety net only — the real freshness guarantee comes from
# the post_save/post_delete signals in core/signals.py clearing these keys
# the moment an editor changes a category or the site settings.
CACHE_TTL = 60 * 60


def _get_active_categories():
    categories = cache.get('active_categories')
    if categories is None:
        categories = list(Category.objects.filter(is_active=True).order_by('order', 'name'))
        cache.set('active_categories', categories, CACHE_TTL)
    return categories


def _get_site_settings():
    site = cache.get('site_settings_singleton')
    if site is None:
        site = SiteSettings.load()
        cache.set('site_settings_singleton', site, CACHE_TTL)
    return site


def site_settings(request):
    active_categories = _get_active_categories()
    site = _get_site_settings()
    return {
        'SITE_NAME': 'The American Diary 24',
        'SITE_TAGLINE': 'AMERICAN NEWS & ANALYSIS',
        'SITE_DOMAIN': settings.SITE_DOMAIN,
        'SHOW_ADS': settings.SHOW_ADS,
        'nav_categories': active_categories[:9],
        'more_categories': active_categories[9:17],
        'GA_MEASUREMENT_ID': site.ga_measurement_id,
        'ADSENSE_PUBLISHER_ID': site.adsense_publisher_id,
    }
