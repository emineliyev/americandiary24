from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from news.models import Category

from .models import Page, SiteSettings

# Category/SiteSettings/Page all feed the nav, footer, and social icons —
# rendered on every page, including the ones wrapped in @cache_page (home,
# category/tag/exclusive/search). Deleting only the narrow context-processor
# keys (active_categories/site_settings_singleton/active_page_slugs) left
# those already-cached page responses holding stale HTML until their own
# TTL expired (e.g. deactivating a Page in the admin panel wouldn't drop its
# footer link from the cached homepage for up to 3 minutes). A full flush is
# the simple fix — these are rare admin edits, not hot-path writes, so the
# cost of a cache-cold reload afterward is negligible.
@receiver([post_save, post_delete], sender=Category)
@receiver([post_save, post_delete], sender=SiteSettings)
@receiver([post_save, post_delete], sender=Page)
def clear_full_cache(**kwargs):
    cache.clear()
