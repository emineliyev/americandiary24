import html
import re
import shutil
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils.html import strip_tags
from django.utils.text import slugify

from news.legacy_sql import iter_insert_rows
from news.models import Article, Author, Category, Quote, Tag


def clean_plain_text(value):
    """Some legacy titles/leads have raw HTML (e.g. `<font color=red>`) baked
    directly into the text — an old-CMS habit for manual emphasis. Strip it
    for fields that are meant to be plain text."""
    return html.unescape(strip_tags(value or '')).strip()


def parse_legacy_tags(raw):
    """The legacy `tags` field is free text, one tag per line — and some rows
    repeat the same list again, comma-separated, later in the same string.
    Split on both, strip, and de-dupe case-insensitively (keeping first-seen
    casing) rather than trust either delimiter alone."""
    if not raw or not raw.strip():
        return []
    seen = set()
    tags = []
    for part in re.split(r'[\r\n,]+', raw):
        part = part.strip(' \t-')
        if not part:
            continue
        key = part.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(part)
    return tags

SQL_PATH = Path(settings.BASE_DIR).parent / 'ilkx7420_amdairy.sql'
PHOTOS_DIR = Path(settings.BASE_DIR).parent / 'amdeli-file' / 'photos'

CATEGORY_COLUMNS = ['id', 'sira', 'type', 'url', 'stil', 'nameaz', 'nameen', 'nameru']
NEWS_COLUMNS = [
    'id', 'date', 'title', 'lead', 'body', 'image', 'image_big', 'type',
    'category', 'categorya', 'video', 'photoslidetxt', 'photosession',
    'author_id', 'tags', 'docs', 'read', 'lang', 'gorunme',
    'azlink', 'enlink', 'rulink', 'username',
]
SITAT_COLUMNS = ['id', 'date', 'ad', 'vezife', 'metn', 'image', 'read', 'lang', 'gorunme']


class Command(BaseCommand):
    help = (
        'One-time import of the legacy PHP/MySQL site (categories, news, sitat/quotes) '
        'into the new models, preserving legacy IDs, categories and images so every '
        'news.php?id=/cat.php?cat= link keeps working unchanged.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=None, help='Only import the first N articles (for testing).')

    def handle(self, *args, **options):
        if not SQL_PATH.exists():
            self.stderr.write(self.style.ERROR(f'SQL dump not found at {SQL_PATH}'))
            return
        if not PHOTOS_DIR.exists():
            self.stderr.write(self.style.ERROR(f'Photos folder not found at {PHOTOS_DIR}'))
            return

        self.stdout.write('Wiping demo content (quotes, articles, categories, authors, tags)...')
        Quote.objects.all().delete()
        Article.objects.all().delete()
        Category.objects.all().delete()
        Author.objects.all().delete()
        Tag.objects.all().delete()

        sql_text = SQL_PATH.read_text(encoding='utf-8')

        self.import_categories(sql_text)
        default_author = Author.objects.create(name='News Desk', slug='news-desk')
        self.import_articles(sql_text, default_author, options.get('limit'))
        self.import_quotes(sql_text)
        self.reset_sequences()

    def import_categories(self, sql_text):
        count = 0
        for row in iter_insert_rows(sql_text, 'categories'):
            data = dict(zip(CATEGORY_COLUMNS, row))
            name = (data['nameaz'] or '').strip() or f"Category {data['id']}"
            Category.objects.update_or_create(
                id=data['id'],
                defaults=dict(
                    name=name,
                    slug=slugify(name) or f'category-{data["id"]}',
                    order=data['sira'] or 0,
                    is_active=True,
                ),
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Imported {count} categories.'))

    def import_articles(self, sql_text, default_author, limit):
        categories = {c.id: c for c in Category.objects.all()}
        media_dir = Path(settings.MEDIA_ROOT) / 'articles'
        media_dir.mkdir(parents=True, exist_ok=True)
        tag_cache = {}  # lowercased name -> Tag, avoids a query per repeat tag

        created = 0
        skipped_no_category = 0
        skipped_no_title = 0
        images_copied = 0
        images_missing = 0
        tag_links = 0

        for i, row in enumerate(iter_insert_rows(sql_text, 'news')):
            if limit and i >= limit:
                break
            data = dict(zip(NEWS_COLUMNS, row))

            title = clean_plain_text(data['title'])
            if not title:
                skipped_no_title += 1
                continue

            category = categories.get(data['category'])
            if not category:
                skipped_no_category += 1
                continue

            published_at = None
            if data['date']:
                published_at = datetime.fromtimestamp(int(data['date']), tz=dt_timezone.utc)

            status = Article.Status.PUBLISHED if data['gorunme'] == 'he' else Article.Status.ARCHIVED

            article = Article(
                id=data['id'],
                title=title,
                slug=f"{slugify(title)[:230] or 'article'}-{data['id']}",
                dek=clean_plain_text(data['lead'])[:300],
                body=data['body'] or '',
                category=category,
                author=default_author,
                status=status,
                published_at=published_at,
                view_count=data['read'] or 0,
                is_indexed=True,
            )
            article.save()
            created += 1

            for tag_name in parse_legacy_tags(data['tags']):
                tag_name = tag_name[:255]
                key = tag_name.lower()
                tag = tag_cache.get(key)
                if tag is None:
                    tag, _ = Tag.objects.get_or_create(
                        slug=slugify(tag_name)[:255] or slugify(key)[:255],
                        defaults={'name': tag_name},
                    )
                    tag_cache[key] = tag
                article.tags.add(tag)
                tag_links += 1

            image_name = (data['image'] or '').strip()
            if image_name:
                if self.copy_image(image_name, media_dir):
                    article.image.name = f'articles/{image_name}'
                    article.save(update_fields=['image'])
                    images_copied += 1
                else:
                    images_missing += 1

            if created % 500 == 0:
                self.stdout.write(f'  ...{created} articles imported so far')

        self.stdout.write(self.style.SUCCESS(
            f'Imported {created} articles ({skipped_no_title} skipped: no title, '
            f'{skipped_no_category} skipped: unknown category). '
            f'Images copied: {images_copied}, missing on disk: {images_missing}. '
            f'Tags: {len(tag_cache)} unique, {tag_links} article links.'
        ))

    def import_quotes(self, sql_text):
        media_dir = Path(settings.MEDIA_ROOT) / 'quotes'
        media_dir.mkdir(parents=True, exist_ok=True)

        count = 0
        for row in iter_insert_rows(sql_text, 'sitat'):
            data = dict(zip(SITAT_COLUMNS, row))
            name = clean_plain_text(data['ad'])
            quote_text = (data['metn'] or '').strip()
            if not name or not quote_text:
                continue

            quote_date = None
            if data['date']:
                quote_date = datetime.fromtimestamp(int(data['date']), tz=dt_timezone.utc).date()

            quote = Quote(
                name=name,
                title=clean_plain_text(data['vezife']),
                quote_text=quote_text,
                quote_date=quote_date,
                is_active=(data['gorunme'] == 'he'),
            )
            quote.save()
            count += 1

            image_name = (data['image'] or '').strip()
            if image_name and self.copy_image(image_name, media_dir):
                quote.photo.name = f'quotes/{image_name}'
                quote.save(update_fields=['photo'])

        self.stdout.write(self.style.SUCCESS(f'Imported {count} quotes.'))

    def copy_image(self, filename, dest_dir):
        src = PHOTOS_DIR / filename
        if not src.exists():
            return False
        dest = dest_dir / filename
        if not dest.exists():
            shutil.copyfile(src, dest)
        return True

    def reset_sequences(self):
        """After explicitly inserting rows with legacy primary keys, Postgres's
        auto-increment sequences still think the next id is 1 — advance them
        past the highest imported id so future admin-created rows don't collide."""
        with connection.cursor() as cursor:
            for model in (Category, Article, Quote):
                table = model._meta.db_table
                cursor.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
                )
        self.stdout.write(self.style.SUCCESS('Reset id sequences.'))
