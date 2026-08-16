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
        # Explicit map, not a slug->name transform: some of these keep their
        # legacy .php URL, others (privacy, cookies) are brand new paths.
        url_names = {
            'about': 'core:about',
            'contact': 'core:contact',
            'terms-of-use': 'core:terms',
            'advertise': 'core:advertise',
            'privacy-policy': 'core:privacy',
            'cookie-policy': 'core:cookies',
        }
        return reverse(url_names[page.slug])

    def lastmod(self, page):
        return page.updated_at
