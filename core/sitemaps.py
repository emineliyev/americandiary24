from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Page


class StaticSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.8

    def items(self):
        return ['core:home']

    def location(self, name):
        return reverse(name)


class PageSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.3

    def items(self):
        return Page.objects.all()

    def location(self, page):
        # Legacy pages keep their old .php URL names; core:about/contact/terms
        # map to those. Privacy Policy is the one page with no legacy URL.
        url_names = {'about': 'core:about', 'contact': 'core:contact', 'terms-of-use': 'core:terms'}
        return reverse(url_names.get(page.slug, 'core:privacy'))

    def lastmod(self, page):
        return page.updated_at
