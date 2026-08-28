import shutil
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils.text import slugify

from news.legacy_sql import iter_insert_rows
from news.management.commands.import_legacy import (
    CATEGORY_COLUMNS, NEWS_COLUMNS, clean_plain_text, parse_legacy_tags,
)
from news.models import Article, Author, Category, Tag

DEFAULT_SQL_PATH = Path(settings.BASE_DIR).parent / 'ilkx7420_amdairy final.sql'
DEFAULT_PHOTOS_DIR = Path(settings.BASE_DIR).parent / 'photos'


class Command(BaseCommand):
    help = (
        'Additive-only sync from an updated legacy DB dump (e.g. a fresh export the '
        'client sends later) — unlike import_legacy, this NEVER wipes or overwrites '
        'existing data. Only inserts `news` rows whose id is not already an Article, '
        'and only creates `categories` rows whose id is not already a Category '
        '(existing categories are never touched, so admin-configured homepage '
        'settings etc. are never clobbered).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--sql', type=str, default=str(DEFAULT_SQL_PATH), help='Path to the updated .sql dump.')
        parser.add_argument('--photos', type=str, default=str(DEFAULT_PHOTOS_DIR), help='Path to the matching photos folder.')

    def handle(self, *args, **options):
        sql_path = Path(options['sql'])
        photos_dir = Path(options['photos'])

        if not sql_path.exists():
            self.stderr.write(self.style.ERROR(f'SQL dump not found at {sql_path}'))
            return
        if not photos_dir.exists():
            self.stderr.write(self.style.ERROR(f'Photos folder not found at {photos_dir}'))
            return

        default_author = Author.objects.filter(name__iexact='News Desk').first()
        if not default_author:
            self.stderr.write(self.style.ERROR(
                'No "News Desk" author found — run import_legacy first (or create '
                'one manually) before using this incremental updater.'
            ))
            return

        sql_text = sql_path.read_text(encoding='utf-8')

        self.import_new_categories(sql_text)
        self.import_new_articles(sql_text, default_author, photos_dir)

    def import_new_categories(self, sql_text):
        existing_ids = set(Category.objects.values_list('id', flat=True))
        created = 0
        for row in iter_insert_rows(sql_text, 'categories'):
            data = dict(zip(CATEGORY_COLUMNS, row))
            if data['id'] in existing_ids:
                continue
            name = (data['nameaz'] or '').strip() or f"Category {data['id']}"
            Category.objects.create(
                id=data['id'], name=name,
                slug=slugify(name) or f'category-{data["id"]}',
                order=data['sira'] or 0, is_active=True,
            )
            created += 1
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created {created} new categor{"y" if created == 1 else "ies"}.'))

    def import_new_articles(self, sql_text, default_author, photos_dir):
        existing_ids = set(Article.objects.values_list('id', flat=True))
        categories = {c.id: c for c in Category.objects.all()}
        media_dir = Path(settings.MEDIA_ROOT) / 'articles'
        media_dir.mkdir(parents=True, exist_ok=True)
        tag_cache = {}

        created = 0
        skipped_existing = 0
        skipped_no_title = 0
        skipped_no_category = 0
        images_copied = 0
        images_missing = 0

        for row in iter_insert_rows(sql_text, 'news'):
            data = dict(zip(NEWS_COLUMNS, row))

            if data['id'] in existing_ids:
                skipped_existing += 1
                continue

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

            image_name = (data['image'] or '').strip()
            if image_name:
                if self.copy_image(image_name, photos_dir, media_dir):
                    article.image.name = f'articles/{image_name}'
                    article.save(update_fields=['image'])
                    images_copied += 1
                else:
                    images_missing += 1

        self.stdout.write(self.style.SUCCESS(
            f'Imported {created} new articles ({skipped_existing} already existed, '
            f'{skipped_no_title} skipped: no title, {skipped_no_category} skipped: unknown category). '
            f'Images copied: {images_copied}, missing on disk: {images_missing}.'
        ))
        if created:
            self.reset_article_sequence()

    def copy_image(self, filename, photos_dir, dest_dir):
        src = photos_dir / filename
        if not src.exists():
            return False
        dest = dest_dir / filename
        if not dest.exists():
            shutil.copyfile(src, dest)
        return True

    def reset_article_sequence(self):
        """New rows are inserted with explicit legacy ids again — advance the
        sequence past the new highest id so future admin-created articles
        don't collide, same as import_legacy does after its own import."""
        with connection.cursor() as cursor:
            table = Article._meta.db_table
            cursor.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
            )
