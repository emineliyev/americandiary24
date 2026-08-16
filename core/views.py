from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.cache import cache_page

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


@cache_page(60 * 3)  # homepage is our single hottest URL; 3 min balances freshness vs. load
def home(request):
    published = (
        Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        .select_related('category', 'author')
    )

    # hero/top_stories/latest are all just windows over the same default
    # (-published_at) ordering — one fetch instead of three separate queries.
    top_12 = list(published[:12])
    hero = top_12[0] if top_12 else None
    top_stories = top_12[1:5]
    latest = top_12[5:12]

    editors_picks = list(published.filter(is_editors_pick=True)[:3])
    exclusives = list(published.filter(is_exclusive=True)[:3])
    breaking = published.filter(is_breaking=True).first()
    videos = list(published.exclude(youtube_id='')[:4])

    # trending is just the top 3 of the same view_count ordering as most_read.
    most_read = list(published.order_by('-view_count')[:5])
    trending = most_read[:3]

    active_quotes = list(Quote.objects.filter(is_active=True).select_related('related_article')[:4])
    featured_quote = active_quotes[0] if active_quotes else None
    previous_quotes = active_quotes[1:4]

    # One query for every category this page needs, instead of one per
    # section — HOMEPAGE_CATEGORY_ORDER previously did .filter(name=X).first()
    # in a loop (6 queries for 6 sections).
    wanted_names = [name for name, _, _ in HOMEPAGE_CATEGORY_ORDER]
    categories_by_name = {c.name: c for c in Category.objects.filter(name__in=wanted_names)}

    category_sections = []
    for name, label, layout in HOMEPAGE_CATEGORY_ORDER:
        category = categories_by_name.get(name)
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
        'previous_quotes': previous_quotes,
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
