from django.conf import settings

from news.models import Category


def site_settings(request):
    active_categories = Category.objects.filter(is_active=True)
    return {
        'SITE_NAME': 'The American Diary 24',
        'SITE_TAGLINE': 'AMERICAN NEWS & ANALYSIS',
        'SITE_DOMAIN': settings.SITE_DOMAIN,
        'SHOW_ADS': settings.SHOW_ADS,
        'nav_categories': active_categories[:9],
        'more_categories': active_categories[9:17],
    }
