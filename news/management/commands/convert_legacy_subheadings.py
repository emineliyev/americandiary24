import re

from django.core.management.base import BaseCommand

from news.models import Article

# Matches only the one, verified-consistent pattern the legacy WYSIWYG editor
# used for in-body subheadings (double nested <span>, this exact style
# string) — deliberately narrow so it can't accidentally catch bylines or
# other differently-styled <u><span> runs that happen to share a font-size.
PATTERN = re.compile(
    r'<u><span style="font-size:18px;"><span style="font-family:arial,helvetica,sans-serif;">'
    r'(.*?)</span></span></u>',
    re.IGNORECASE | re.DOTALL,
)


class Command(BaseCommand):
    help = (
        'One-time cleanup of legacy-imported article bodies: replaces the '
        'WYSIWYG editor\'s underline+span subheading markup with real <h4> tags.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report what would change without saving anything.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        articles_changed = 0
        total_replacements = 0

        for article in Article.all_objects.filter(body__icontains='<u>'):
            matches = PATTERN.findall(article.body)
            if not matches:
                continue

            new_body = PATTERN.sub(r'<h4>\1</h4>', article.body)
            articles_changed += 1
            total_replacements += len(matches)

            label = f'Article({article.id}): {len(matches)} subheading(s)'
            if dry_run:
                self.stdout.write(f'  would update: {label}')
                for m in matches:
                    self.stdout.write(f'    - {m}')
            else:
                article.body = new_body
                article.save(update_fields=['body'])
                self.stdout.write(self.style.SUCCESS(f'  updated: {label}'))

        suffix = ' (dry run — nothing changed)' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Articles changed: {articles_changed}, '
            f'subheadings converted: {total_replacements}{suffix}'
        ))
