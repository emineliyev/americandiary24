from urllib.parse import urlencode

from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import Count, F, Q
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.cache import cache_page

from .models import Article, Author, Category, Tag

PAGE_SIZE = 20


def _paginate(request, queryset, page_size=PAGE_SIZE):
    """Legacy URLs use a 0-indexed page param (?p=0 is page one)."""
    try:
        legacy_page = max(int(request.GET.get('p', 0)), 0)
    except ValueError:
        legacy_page = 0

    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(legacy_page + 1)
    page_range = paginator.get_elided_page_range(page_obj.number, on_each_side=2, on_ends=1)
    return page_obj, page_range


def _most_read():
    # Rendered on every article/category/tag/search page — cache it rather
    # than re-querying per request. Short TTL since view_count is what
    # ranks it and changes on every article view.
    most_read = cache.get('most_read')
    if most_read is None:
        most_read = list(
            Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
            .select_related('category')
            .order_by('-view_count')[:5]
        )
        cache.set('most_read', most_read, 120)
    return most_read


def article_detail(request):
    article_id = request.GET.get('id')
    article = get_object_or_404(
        Article.objects.select_related('category', 'author').prefetch_related('co_authors'),
        pk=article_id,
        status=Article.Status.PUBLISHED,
        published_at__lte=timezone.now(),
    )

    Article.objects.filter(pk=article.pk).update(view_count=F('view_count') + 1)

    published = Article.objects.filter(
        status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    article_tags = list(article.tags.all())
    related_articles = _related_articles(article, published, article_tags)

    # Scoped to this article's own category (excluding itself) rather than
    # the site-wide _most_read() — more useful to someone already reading
    # here, same reasoning as category_detail's version below.
    most_read = list(
        published.filter(category=article.category).exclude(pk=article.pk).order_by('-view_count')[:5]
    )

    context = {
        'article': article,
        'article_tags': article_tags,
        'related_articles': related_articles,
        'most_read': most_read,
        'most_read_label': f'Most Read in {article.category.name}',
    }
    return render(request, 'article.html', context)


def _related_articles(article, published, article_tags, limit=6):
    """Prefer stories sharing tags (ranked by how many), then top up with
    same-category stories if there aren't enough tag matches."""
    article_tag_ids = [t.id for t in article_tags]
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


@cache_page(60 * 5)
def category_detail(request):
    category_id = request.GET.get('cat')
    category = get_object_or_404(Category, pk=category_id, is_active=True)

    published = Article.objects.filter(
        category=category, status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, published, page_size=10)

    # Scoped to this category, not the site-wide _most_read() — more useful
    # to someone already browsing here than generic sitewide popularity.
    category_most_read = list(published.order_by('-view_count')[:5])

    context = {
        'category': category,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': f'?cat={category.id}',
        'most_read': category_most_read,
        'most_read_label': f'Most Read in {category.name}',
        'trending': category_most_read[:3],
    }
    return render(request, 'category.html', context)


@cache_page(60 * 5)
def tag_detail(request, slug):
    tag = get_object_or_404(Tag, slug=slug)

    published = Article.objects.filter(
        tags=tag, status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, published, page_size=10)
    most_read = _most_read()

    context = {
        'tag': tag,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': '?',  # tag is a path segment, not a query param
        'most_read': most_read,
        'trending': most_read[:3],
    }
    return render(request, 'tag.html', context)


@cache_page(60 * 5)
def team_detail(request, slug):
    # show_on_about gates the page itself, not just the About grid — a
    # journalist who isn't public shouldn't have a reachable profile URL.
    member = get_object_or_404(Author, slug=slug, show_on_about=True)

    published = Article.objects.filter(
        author=member, status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, published)

    context = {
        'member': member,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': '?',
        'most_read': _most_read(),
    }
    return render(request, 'team_detail.html', context)


@cache_page(60 * 5)
def exclusive_list(request):
    published = Article.objects.filter(
        is_exclusive=True, status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
    ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, published, page_size=10)
    most_read = _most_read()

    context = {
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': '?',
        'most_read': most_read,
        'trending': most_read[:3],
    }
    return render(request, 'exclusive.html', context)


@cache_page(60 * 2)
def search(request):
    query = (request.GET.get('soz') or '').strip()

    results = Article.objects.none()
    if query:
        results = Article.objects.filter(
            Q(title__icontains=query) | Q(dek__icontains=query) | Q(body__icontains=query),
            status=Article.Status.PUBLISHED, published_at__lte=timezone.now(),
        ).select_related('category', 'author')

    page_obj, page_range = _paginate(request, results, page_size=10)
    most_read = _most_read()

    context = {
        'query': query,
        'page_obj': page_obj,
        'page_range': page_range,
        'pagination_base': f'?{urlencode({"soz": query})}',
        'most_read': most_read,
        'trending': most_read[:3],
    }
    return render(request, 'search.html', context)
