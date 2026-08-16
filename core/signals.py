from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from news.models import Category

from .models import SiteSettings


@receiver([post_save, post_delete], sender=Category)
def clear_category_cache(**kwargs):
    cache.delete('active_categories')


@receiver([post_save, post_delete], sender=SiteSettings)
def clear_site_settings_cache(**kwargs):
    cache.delete('site_settings_singleton')
