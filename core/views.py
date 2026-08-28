from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.cache import cache_page

from news.models import Article, Author, Category

from .models import Page, SiteSettings


@cache_page(60 * 3)  # homepage is our single hottest URL; 3 min balances freshness vs. load
def home(request):
    published = (
        Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        .select_related('category', 'author').prefetch_related('co_authors')
    )

    # Hero + "More Headlines" is driven by the is_main flag (editors opt an
    # article in explicitly when publishing) — not the is_breaking flag,
    # which drives the separate thin news bar below, and not a category.
    # Unflagged articles never appear here, no matter how recent. Falls
    # back to plain recency only if literally nothing is flagged yet, so
    # the hero doesn't go blank before any editor has used the new flag.
    main_articles = list(published.filter(is_main=True)[:5])
    if main_articles:
        hero = main_articles[0]
        top_stories = main_articles[1:5]
    else:
        recent = list(published[:5])
        hero = recent[0] if recent else None
        top_stories = recent[1:5]

    # latest/"Latest News" (sidebar) stays sitewide-recency regardless of
    # the above — a different widget, not part of this change.
    latest = list(published[:7])

    # "More Stories" (sidebar, next to Politics/World) — News category only,
    # unlike `latest` above which is sitewide recency.
    news_category = Category.objects.filter(slug='news').first()
    more_stories = list(published.filter(category=news_category)[:7]) if news_category else []

    editors_picks = list(published.filter(is_editors_pick=True)[:4])
    exclusives = list(published.filter(is_exclusive=True)[:3])
    breaking = published.filter(is_breaking=True).first()
    reference_articles = list(published.filter(is_reference=True)[:4])

    # "AmericanDiary24 Analysis" — a fixed row of 4, sourced from Analysis &
    # Opinion specifically. Excluded from the generic category-section pool
    # below (along with Breaking and Did You Know?) since it renders with
    # this bespoke layout instead of the standard lead+list one.
    analysis_category = Category.objects.filter(slug='analysis-opinion').first()
    analysis_articles = list(published.filter(category=analysis_category)[:4]) if analysis_category else []

    # "Did You Know?" — 1 lead + 4 small (2x2), its own bespoke layout too.
    dyk_category = Category.objects.filter(slug='did-you-know').first()
    dyk_articles = list(published.filter(category=dyk_category)[:5]) if dyk_category else []
    did_you_know = {
        'category': dyk_category,
        'label': (dyk_category.homepage_title or dyk_category.name) if dyk_category else '',
        'lead': dyk_articles[0],
        'rest': dyk_articles[1:5],
    } if dyk_articles else None

    # "Climate" — pairs with Crime & Incident in the homepage's final row.
    # No fake/placeholder content: if nothing's published under this
    # category yet, climate_section is None and the template gives
    # Crime & Incident the full row width instead of a half-empty one.
    climate_category = Category.objects.filter(slug='climate').first()
    climate_articles = list(published.filter(category=climate_category)[:4]) if climate_category else []
    climate_section = {
        'category': climate_category,
        'label': (climate_category.homepage_title or climate_category.name) if climate_category else '',
        'lead': climate_articles[0],
        'rest': climate_articles[1:4],
    } if climate_articles else None

    most_read = list(published.order_by('-view_count')[:5])

    # Which categories get a homepage section, in what order, and how
    # they're grouped 1-3 per row, is fully admin-controlled (Categories
    # screen: "Show on Homepage" + drag-to-reorder + "New Row"). Breaking/
    # Analysis & Opinion/Did You Know?/Climate are excluded here since
    # they're each already handled above with their own bespoke layout.
    homepage_categories = Category.objects.filter(
        is_active=True, show_on_homepage=True,
    ).exclude(slug__in=['breaking', 'analysis-opinion', 'did-you-know', 'climate']).order_by('homepage_order', 'name')

    category_sections = []
    for category in homepage_categories:
        articles = list(published.filter(category=category)[:4])
        if not articles:
            continue
        category_sections.append({
            'category': category,
            'label': category.homepage_title or category.name,
            'lead': articles[0],
            'rest': articles[1:],
            'new_row': category.homepage_new_row,
        })

    # Grouped by each section's own "start a new row here" flag (admin-set,
    # 1-3 categories can share a row) rather than a fixed pair-of-2.
    category_section_rows = []
    current_row = []
    for section in category_sections:
        if section['new_row'] and current_row:
            category_section_rows.append(current_row)
            current_row = []
        current_row.append(section)
    if current_row:
        category_section_rows.append(current_row)

    context = {
        'hero': hero,
        'top_stories': top_stories,
        'latest': latest,
        'more_stories': more_stories,
        'editors_picks': editors_picks,
        'exclusives': exclusives,
        'breaking': breaking,
        'reference_articles': reference_articles,
        'analysis_articles': analysis_articles,
        'analysis_label': (analysis_category.homepage_title or analysis_category.name) if analysis_category else '',
        'did_you_know': did_you_know,
        'climate_section': climate_section,
        'most_read': most_read,
        'category_section_rows': category_section_rows,
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
