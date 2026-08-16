from urllib.parse import urlencode

from django.core.paginator import Paginator
from django.db.models import F, Q
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from .models import Article, Category

PAGE_SIZE = 20


def _paginate(request, queryset):
    """Legacy URLs use a 0-indexed page param (?p=0 is page one)."""
    try:
        legacy_page = max(int(request.GET.get('p', 0)), 0)
    except ValueError:
        legacy_page = 0

    paginator = Paginator(queryset, PAGE_SIZE)
    page_obj = paginator.get_page(legacy_page + 1)
    page_range = paginator.get_elided_page_range(page_obj.number, on_each_side=2, on_ends=1)
    return page_obj, page_range


def _most_read():
    return list(
        Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        .order_by('-view_count')[:5]
    )


def article_detail(request):
    article_id = request.GET.get('id')
    article = get_object_or_404(
        Article.objects.select_related('category', 'author'),
        pk=article_id,
        status=Article.Status.PUBLISHED,
        published_at__lte=timezone.now(),
    )

    Article.objects.filter(pk=article.pk).update(view_count=F('view_count') + 1)

    published = Article.objects.filter(
        status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    related_articles = list(
        published.filter(category=article.category).exclude(pk=article.pk)[:6]
    )
    most_read = list(published.order_by('-view_count')[:5])

    context = {
        'article': article,
        'related_articles': related_articles,
        'most_read': most_read,
    }
    return render(request, 'article.html', context)


def category_detail(request):
    category_id = request.GET.get('cat')
    category = get_object_or_404(Category, pk=category_id, is_active=True)

    published = Article.objects.filter(
        category=category, status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, published)

    context = {
        'category': category,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': f'?cat={category.id}',
        'most_read': _most_read(),
    }
    return render(request, 'category.html', context)


def search(request):
    query = (request.GET.get('soz') or '').strip()

    results = Article.objects.none()
    if query:
        results = Article.objects.filter(
            Q(title__icontains=query) | Q(dek__icontains=query) | Q(body__icontains=query),
            status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
        ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, results)

    context = {
        'query': query,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': f'?{urlencode({"soz": query})}',
        'most_read': _most_read(),
    }
    return render(request, 'search.html', context)
