from django.shortcuts import render
from django.utils import timezone

from news.models import Article, Category

HOMEPAGE_CATEGORY_ORDER = [
    ('U.S.', 'U.S. News', 'lead'),
    ('Politics', 'Politics', 'grid'),
    ('Business', 'Business', 'lead'),
    ('Technology', 'Technology', 'grid'),
    ('World', 'World', 'grid'),
    ('Sports', 'Sports', 'lead'),
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
    }
    return render(request, 'home.html', context)
