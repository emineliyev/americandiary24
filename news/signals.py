import shutil
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Article, Author, Category, Quote, Tag

# Django never deletes a FileField's file just because the row is gone —
# without these, every deleted article/journalist/quote leaves its image
# orphaned on disk forever.


@receiver(post_delete, sender=Article)
def delete_article_media(instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
    # In-body images (see article_body_image_upload) aren't tracked by any
    # model field — they all live under this article's own media folder,
    # so removing it catches every one of them in one go.
    body_media_dir = Path(settings.MEDIA_ROOT) / 'articles' / str(instance.pk)
    if body_media_dir.is_dir():
        shutil.rmtree(body_media_dir, ignore_errors=True)


@receiver(post_delete, sender=Author)
def delete_author_media(instance, **kwargs):
    if instance.avatar:
        instance.avatar.delete(save=False)


@receiver(post_delete, sender=Quote)
def delete_quote_media(instance, **kwargs):
    if instance.photo:
        instance.photo.delete(save=False)


# Home/category/tag/team pages are cache_page'd for several minutes for
# performance — without invalidating on save, publishing an article or
# editing a journalist's avatar/name/socials would silently not show up
# anywhere public until that TTL expired (reported: an avatar took several
# minutes to appear on the journalist's own page). Clearing the whole cache
# on any relevant save is simpler and more reliable than reconstructing
# cache_page's internal per-URL cache keys just to target it precisely —
# this is an admin-panel-only write path, not a hot request, so the cost
# of a full clear here is negligible.
@receiver(post_save, sender=Article)
@receiver(post_delete, sender=Article)
@receiver(post_save, sender=Author)
@receiver(post_delete, sender=Author)
@receiver(post_save, sender=Category)
@receiver(post_delete, sender=Category)
@receiver(post_save, sender=Tag)
@receiver(post_delete, sender=Tag)
def clear_public_cache(**kwargs):
    cache.clear()
