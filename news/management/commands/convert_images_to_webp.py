import os

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from core.models import MediaAsset, SiteSettings
from news.api_views import _to_webp
from news.models import Article, Author, Quote

RASTER_EXTS = ('.jpg', '.jpeg', '.png')


def _console_safe(text):
    """Windows' console codepage (cp1251 etc.) can't encode every Unicode
    character legacy filenames sometimes contain (accents, curly quotes).
    Linux production (UTF-8 locale) never hits this — this is purely so the
    command doesn't crash mid-run when someone eyeballs it locally on
    Windows."""
    import sys
    encoding = getattr(sys.stdout, 'encoding', None) or 'utf-8'
    return text.encode(encoding, errors='replace').decode(encoding)


class Command(BaseCommand):
    help = (
        'One-time conversion of legacy JPG/PNG uploads (predating the '
        '_to_webp() upload pipeline) to WebP. Updates the referencing '
        'model field to the new path and deletes the original file.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report what would change without touching any files or the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        self.total_before = 0
        self.total_after = 0
        self.converted = 0
        self.errors = 0

        self.stdout.write('Articles...')
        for article in Article.all_objects.all():
            self._convert(article, 'image', dry_run)

        self.stdout.write('Authors...')
        for author in Author.objects.all():
            self._convert(author, 'avatar', dry_run)

        self.stdout.write('Quotes...')
        for quote in Quote.objects.all():
            self._convert(quote, 'photo', dry_run)

        self.stdout.write('SiteSettings...')
        for settings_row in SiteSettings.objects.all():
            self._convert(settings_row, 'default_share_image', dry_run)

        self.stdout.write('MediaAsset (legacy, catalogued as jpeg/png)...')
        for asset in MediaAsset.objects.exclude(format__in=['webp', 'svg']):
            self._convert_media_asset(asset, dry_run)

        suffix = ' (dry run — nothing changed)' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Converted: {self.converted}, Errors: {self.errors}, '
            f'{self.total_before / 1024 / 1024:.1f} MiB -> {self.total_after / 1024 / 1024:.1f} MiB'
            f'{suffix}'
        ))

    def _convert(self, instance, field_name, dry_run):
        field_file = getattr(instance, field_name)
        if not field_file:
            return
        name = field_file.name
        if not name.lower().endswith(RASTER_EXTS):
            return
        if not default_storage.exists(name):
            self.stdout.write(self.style.WARNING(f'  missing on disk, skipping: {_console_safe(name)}'))
            return

        label = _console_safe(f'{instance.__class__.__name__}({instance.pk}).{field_name}: {name}')
        try:
            size_before = field_file.size
        except Exception:
            size_before = 0

        if dry_run:
            self.stdout.write(f'  would convert: {label} ({size_before / 1024:.0f} KiB)')
            self.total_before += size_before
            self.converted += 1
            return

        try:
            with default_storage.open(name, 'rb') as fh:
                webp_content = _to_webp(fh)
            new_name = os.path.splitext(name)[0] + '.webp'
            saved_name = default_storage.save(new_name, webp_content)
            size_after = default_storage.size(saved_name)

            field_file.name = saved_name
            instance.save(update_fields=[field_name])
            default_storage.delete(name)

            self.total_before += size_before
            self.total_after += size_after
            self.converted += 1
            self.stdout.write(self.style.SUCCESS(
                f'  converted: {label} ({size_before / 1024:.0f} KiB -> {size_after / 1024:.0f} KiB)'
            ))
        except Exception as e:
            self.errors += 1
            self.stdout.write(self.style.ERROR(_console_safe(f'  FAILED: {label}: {e}')))

    def _convert_media_asset(self, asset, dry_run):
        name = asset.file.name
        if not name.lower().endswith(RASTER_EXTS):
            return
        if not default_storage.exists(name):
            self.stdout.write(self.style.WARNING(f'  missing on disk, skipping: {_console_safe(name)}'))
            return

        label = _console_safe(f'MediaAsset({asset.pk}): {name}')
        size_before = asset.size_bytes or 0

        if dry_run:
            self.stdout.write(f'  would convert: {label} ({size_before / 1024:.0f} KiB)')
            self.total_before += size_before
            self.converted += 1
            return

        try:
            from PIL import Image
            with default_storage.open(name, 'rb') as fh:
                webp_content = _to_webp(fh)
            new_name = os.path.splitext(name)[0] + '.webp'
            saved_name = default_storage.save(new_name, webp_content)
            size_after = default_storage.size(saved_name)
            with default_storage.open(saved_name, 'rb') as fh:
                width, height = Image.open(fh).size

            old_name = name
            asset.file.name = saved_name
            asset.format = 'webp'
            asset.width = width
            asset.height = height
            asset.size_bytes = size_after
            asset.save(update_fields=['file', 'format', 'width', 'height', 'size_bytes'])
            default_storage.delete(old_name)

            self.total_before += size_before
            self.total_after += size_after
            self.converted += 1
            self.stdout.write(self.style.SUCCESS(
                f'  converted: {label} ({size_before / 1024:.0f} KiB -> {size_after / 1024:.0f} KiB)'
            ))
        except Exception as e:
            self.errors += 1
            self.stdout.write(self.style.ERROR(_console_safe(f'  FAILED: {label}: {e}')))
