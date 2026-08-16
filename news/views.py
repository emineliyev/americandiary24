from django.core.paginator import Paginator
from django.db.models import F
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from .models import Article, Category

CATEGORY_PAGE_SIZE = 20


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

    # Legacy URLs use a 0-indexed page param (cat.php?p=0 is page one).
    try:
        legacy_page = max(int(request.GET.get('p', 0)), 0)
    except ValueError:
        legacy_page = 0

    paginator = Paginator(published, CATEGORY_PAGE_SIZE)
    page_obj = paginator.get_page(legacy_page + 1)
    page_range = paginator.get_elided_page_range(page_obj.number, on_each_side=2, on_ends=1)

    most_read = list(
        Article.objects.filter(status=Article.Status.PUBLISHED, published_at__lte=timezone.now())
        .order_by('-view_count')[:5]
    )

    context = {
        'category': category,
        'page_obj': page_obj,
        'page_range': page_range,
        'most_read': most_read,
    }
    return render(request, 'category.html', context)
