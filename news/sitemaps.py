from django.contrib.sitemaps import Sitemap
from django.db.models import Count
from django.utils import timezone

from .models import Article, Author, Category, Tag


class ArticleSitemap(Sitemap):
    changefreq = 'never'
    priority = 0.6

    def items(self):
        # is_indexed is the admin-controlled "don't index this one" flag —
        # syndicated/wire content editors flip off stays out of the sitemap.
        return (
            Article.objects.filter(
                status=Article.Status.PUBLISHED,
                published_at__lte=timezone.now(),
                is_indexed=True,
            )
            .order_by('-published_at')
        )

    def location(self, article):
        return article.get_absolute_url()

    def lastmod(self, article):
        return article.updated_at


class CategorySitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.5

    def items(self):
        return Category.objects.filter(is_active=True)

    def location(self, category):
        # Only the first page of a category is indexed (see the category
        # view, which marks p>0 noindex), so that's the only URL listed here.
        return category.get_absolute_url()


class TagSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.2

    def items(self):
        # Most legacy tags only ever tagged a single article (7103 of 8158) —
        # listing every one of those thin single-story pages in the sitemap
        # would be spammy. Only submit tags with real archive depth; the
        # single-article tag pages still exist and are crawlable, just not
        # proactively pushed.
        return (
            Tag.objects.annotate(article_count=Count('articles'))
            .filter(article_count__gte=2)
            .order_by('id')
        )

    def location(self, tag):
        return tag.get_absolute_url()


class AuthorSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.3

    def items(self):
        return Author.objects.filter(show_on_about=True).order_by('id')

    def location(self, author):
        return author.get_absolute_url()
