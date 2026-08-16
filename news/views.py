from urllib.parse import urlencode

from django.core.paginator import Paginator
from django.db.models import Count, F, Q
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from .models import Article, Category, Tag

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

    related_articles = _related_articles(article, published)
    most_read = list(published.order_by('-view_count')[:5])

    context = {
        'article': article,
        'related_articles': related_articles,
        'most_read': most_read,
    }
    return render(request, 'article.html', context)


def _related_articles(article, published, limit=6):
    """Prefer stories sharing tags (ranked by how many), then top up with
    same-category stories if there aren't enough tag matches."""
    article_tag_ids = list(article.tags.values_list('id', flat=True))
    results = []
    seen_ids = {article.pk}

    if article_tag_ids:
        by_tag = (
            published.filter(tags__in=article_tag_ids)
            .exclude(pk=article.pk)
            .annotate(shared_tags=Count('tags', filter=Q(tags__in=article_tag_ids)))
            .order_by('-shared_tags', '-published_at')
            .distinct()[:limit]
        )
        for a in by_tag:
            results.append(a)
            seen_ids.add(a.pk)

    if len(results) < limit:
        same_category = (
            published.filter(category=article.category)
            .exclude(pk__in=seen_ids)
            .order_by('-published_at')[:limit - len(results)]
        )
        results.extend(same_category)

    return results


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


def tag_detail(request, slug):
    tag = get_object_or_404(Tag, slug=slug)

    published = Article.objects.filter(
        tags=tag, status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, published)

    context = {
        'tag': tag,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': '?',  # tag is a path segment, not a query param
        'most_read': _most_read(),
    }
    return render(request, 'tag.html', context)


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
