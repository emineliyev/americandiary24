from django.conf import settings
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.cache import cache_page

from news.models import Article, Author, Category, Quote

from .models import Page, SiteSettings

# Capped rather than showing every active category — as the site adds more
# categories over time, an uncapped list would make the homepage (and its
# per-category queries) grow unbounded. 6 was chosen to match the previous
# hand-picked list's size.
HOMEPAGE_CATEGORY_COUNT = 6


@cache_page(60 * 3)  # homepage is our single hottest URL; 3 min balances freshness vs. load
def home(request):
    published = (
        Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        .select_related('category', 'author').prefetch_related('co_authors')
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
    reference_articles = list(published.filter(is_reference=True)[:6])

    # trending is just the top 3 of the same view_count ordering as most_read.
    most_read = list(published.order_by('-view_count')[:5])
    trending = most_read[:3]

    active_quotes = list(Quote.objects.filter(is_active=True).select_related('related_article')[:4])
    featured_quote = active_quotes[0] if active_quotes else None
    previous_quotes = active_quotes[1:4]

    # Featured categories are whichever HOMEPAGE_CATEGORY_COUNT are
    # currently the most-read (summed view_count across their own published
    # articles) — not a hand-picked list, so this tracks real readership
    # and needs no code change as categories are added/renamed.
    top_categories = list(
        Category.objects.filter(is_active=True)
        .annotate(total_views=Sum(
            'articles__view_count',
            filter=Q(articles__status=Article.Status.PUBLISHED, articles__published_at__lte=timezone.now()),
        ))
        .filter(total_views__gt=0)
        .order_by('-total_views')[:HOMEPAGE_CATEGORY_COUNT]
    )

    category_sections = []
    for category in top_categories:
        articles = list(published.filter(category=category)[:4])
        if not articles:
            continue
        category_sections.append({
            'category': category,
            'label': category.name,
            'lead': articles[0],
            'rest': articles[1:],
        })

    # Paired up two-at-a-time for the homepage's side-by-side layout —
    # sequential adjacent pairs (Politics+Breaking, News+World, ...), not
    # grouped by lead/grid style. An odd section out just renders alone in
    # the final row.
    category_section_rows = [category_sections[i:i + 2] for i in range(0, len(category_sections), 2)]

    context = {
        'hero': hero,
        'top_stories': top_stories,
        'latest': latest,
        'editors_picks': editors_picks,
        'exclusives': exclusives,
        'breaking': breaking,
        'reference_articles': reference_articles,
        'most_read': most_read,
        'trending': trending,
        'category_section_rows': category_section_rows,
        'featured_quote': featured_quote,
        'previous_quotes': previous_quotes,
    }
    return render(request, 'home.html', context)


def page_detail(request, slug):
    page = get_object_or_404(Page, slug=slug, is_active=True)
    context = {'page': page}
    if slug == 'contact':
        context['site_settings'] = SiteSettings.load()
    return render(request, 'page.html', context)


def about(request):
    # Reuses the existing editable Page (slug='about') for the free-text
    # intro so nothing the admin already wrote is lost, plus the team grid.
    # Deactivating this Page only hides the intro text, not the whole route
    # — the team grid is core to /about.php regardless.
    page = Page.objects.filter(slug='about', is_active=True).first()
    team = Author.objects.filter(show_on_about=True).order_by('order', 'name')
    context = {'page': page, 'team': team}
    return render(request, 'about.html', context)


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
