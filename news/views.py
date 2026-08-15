from django.db.models import F
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from .models import Article


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
