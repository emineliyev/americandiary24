from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from news.models import Article, Category, Quote

from .models import Page, SiteSettings

# Real categories from the legacy site, ordered by article volume so the
# homepage's featured sections always have enough content to fill out.
HOMEPAGE_CATEGORY_ORDER = [
    ('Politics', 'Politics', 'lead'),
    ('Breaking', 'Breaking', 'grid'),
    ('News', 'News', 'lead'),
    ('World', 'World', 'grid'),
    ('Business', 'Business', 'grid'),
    ('Incident', 'Incident', 'lead'),
]


def home(request):
    published = (
        Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        .select_related('category', 'author')
    )

    hero = published.first()
    top_stories = list(published[1:5])
    latest = list(published[5:12])
    editors_picks = list(published.filter(is_editors_pick=True)[:3])
    exclusives = list(published.filter(is_exclusive=True)[:3])
    breaking = published.filter(is_breaking=True).first()
    videos = list(published.exclude(youtube_id='')[:4])
    most_read = list(published.order_by('-view_count')[:5])
    trending = list(published.order_by('-view_count')[:3])

    active_quotes = Quote.objects.filter(is_active=True).select_related('related_article')
    featured_quote = active_quotes.first()
    quote_archive_count = active_quotes.count() - 1 if featured_quote else 0

    category_sections = []
    for name, label, layout in HOMEPAGE_CATEGORY_ORDER:
        category = Category.objects.filter(name=name).first()
        if not category:
            continue
        articles = list(published.filter(category=category)[:4])
        if not articles:
            continue
        category_sections.append({
            'category': category,
            'label': label,
            'layout': layout,
            'lead': articles[0],
            'rest': articles[1:],
        })

    context = {
        'hero': hero,
        'top_stories': top_stories,
        'latest': latest,
        'editors_picks': editors_picks,
        'exclusives': exclusives,
        'breaking': breaking,
        'videos': videos,
        'most_read': most_read,
        'trending': trending,
        'category_sections': category_sections,
        'featured_quote': featured_quote,
        'quote_archive_count': quote_archive_count,
    }
    return render(request, 'home.html', context)


def page_detail(request, slug):
    page = get_object_or_404(Page, slug=slug)
    context = {'page': page}
    if slug == 'contact':
        context['site_settings'] = SiteSettings.load()
    return render(request, 'page.html', context)


def robots_txt(request):
    context = {'sitemap_url': f'{settings.SITE_DOMAIN}/sitemap.xml'}
    return render(request, 'robots.txt', context, content_type='text/plain')


def ads_txt(request):
    site = SiteSettings.load()
    if site.ads_txt_content.strip():
        content = site.ads_txt_content
    elif site.adsense_publisher_id.strip():
        # Standard AdSense line; f08c47fec0942fa0 is Google's own fixed
        # certification authority ID, not something we generate.
        content = f'google.com, {site.adsense_publisher_id}, DIRECT, f08c47fec0942fa0\n'
    else:
        content = ''
    return HttpResponse(content, content_type='text/plain')


def custom_404(request, exception=None):
    latest = []
    try:
        latest = list(
            Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
            .select_related('category')[:5]
        )
    except Exception:
        pass
    return render(request, '404.html', {'latest': latest}, status=404)
