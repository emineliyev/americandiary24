from django.conf import settings
from django.core.cache import cache
from django.db.models import Exists, OuterRef
from django.utils import timezone

from news.models import Article, Category

from .models import Page, SiteSettings

# Long TTL as a safety net only — the real freshness guarantee comes from
# the post_save/post_delete signals in core/signals.py clearing these keys
# the moment an editor changes a category or the site settings.
CACHE_TTL = 60 * 60


def _get_active_categories():
    categories = cache.get('active_categories')
    if categories is None:
        # Hides a category from nav (and the "more" overflow menu) the
        # moment it has zero published articles — e.g. Climate right now,
        # before the client has published anything under it. Reappears on
        # its own once an article is published there, no manual toggle
        # needed. Exists() subquery, not a join+distinct, so a category
        # with hundreds of articles doesn't cost more than one with one.
        published_in_category = Article.objects.filter(
            category=OuterRef('pk'),
            status=Article.Status.PUBLISHED,
            published_at__lte=timezone.now(),
        )
        categories = list(
            Category.objects.filter(is_active=True)
            .annotate(has_published_articles=Exists(published_in_category))
            .filter(has_published_articles=True)
            .order_by('order', 'name')
        )
        cache.set('active_categories', categories, CACHE_TTL)
    return categories


def _get_site_settings():
    site = cache.get('site_settings_singleton')
    if site is None:
        site = SiteSettings.load()
        cache.set('site_settings_singleton', site, CACHE_TTL)
    return site


def _get_active_page_slugs():
    slugs = cache.get('active_page_slugs')
    if slugs is None:
        slugs = set(Page.objects.filter(is_active=True).values_list('slug', flat=True))
        cache.set('active_page_slugs', slugs, CACHE_TTL)
    return slugs


def site_settings(request):
    active_categories = _get_active_categories()
    site = _get_site_settings()
    site_name = 'The American Diary 24'
    return {
        'SITE_NAME': site_name,
        'SITE_TAGLINE': 'AMERICAN NEWS & ANALYSIS',
        'SITE_DOMAIN': settings.SITE_DOMAIN,
        'SHOW_ADS': settings.SHOW_ADS,
        'nav_categories': active_categories[:9],
        'more_categories': active_categories[9:17],
        'active_page_slugs': _get_active_page_slugs(),
        'GA_MEASUREMENT_ID': site.ga_measurement_id,
        'ADSENSE_PUBLISHER_ID': site.adsense_publisher_id,
        # Sitewide fallback <meta description>/social-share text for pages
        # that don't set their own (see base.html) — editable from the
        # admin panel's SEO settings, falls back to a generic sentence.
        'DEFAULT_META_DESCRIPTION': site.default_meta_description or f'Breaking news, politics, business and world coverage from {site_name}.',
        # Made available site-wide (not just page_detail's contact.php
        # context) so widgets like _sidebar_follow.html can read the
        # social URLs on any page, e.g. the homepage rail.
        'site_settings': site,
    }
