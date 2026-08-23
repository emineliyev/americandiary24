from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand

from news.models import Article

# Legacy editors faked subheadings with underline + inline font styling
# instead of a real heading tag. A <u> only counts as a subheading if its
# text is the *entire* content of its parent block (div/p) — the same tag
# is also used for inline emphasis, bylines, and photo credits mid-sentence,
# which must be left untouched.
BLOCK_TAGS = ('div', 'p')


def normalize_text(s):
    return ' '.join(s.replace('\xa0', ' ').split())


def classify_block(tag):
    """Returns ('heading', text) if this block is exactly one <u> run and
    nothing else, ('ambiguous', [texts]) if multiple <u> runs make up the
    whole block, or None if the block should be left untouched."""
    u_tags = tag.find_all('u')
    if not u_tags:
        return None

    full_text = normalize_text(tag.get_text())
    combined_u_text = normalize_text(' '.join(u.get_text() for u in u_tags))

    if full_text != combined_u_text or not full_text:
        return None  # <u> co-exists with other text in this block — leave alone

    if len(u_tags) == 1:
        return ('heading', normalize_text(u_tags[0].get_text()))
    return ('ambiguous', [normalize_text(u.get_text()) for u in u_tags])


def find_shallowest_matches(soup):
    """Walk block tags outer-to-inner, skipping descendants of a block
    that already matched, so a div-wrapping-a-p pair isn't double-counted."""
    results = []
    for tag in soup.find_all(BLOCK_TAGS):
        result = classify_block(tag)
        if result is None:
            continue
        if any(tag in matched.descendants for matched, _ in results):
            continue
        results.append((tag, result))
    return results


class Command(BaseCommand):
    help = (
        'Converts legacy fake subheadings (standalone <u><span style="...">text'
        '</span></u> blocks) in Article.body into real <h3> tags. Dry-run by '
        'default; pass --apply to save changes.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Write changes to the database.')
        parser.add_argument('--article-id', type=int, help='Limit to a single article, for spot-checking.')

    def handle(self, *args, **options):
        qs = Article.objects.all().order_by('id')
        if options['article_id']:
            qs = qs.filter(id=options['article_id'])

        total_converted = 0
        articles_touched = 0
        ambiguous_report = []

        for article in qs.only('id', 'title', 'body'):
            if '<u' not in article.body:
                continue

            soup = BeautifulSoup(article.body, 'html.parser')
            matches = find_shallowest_matches(soup)
            if not matches:
                continue

            headings = [(tag, val) for tag, (kind, val) in matches if kind == 'heading']
            ambiguous = [(tag, val) for tag, (kind, val) in matches if kind == 'ambiguous']

            for _, texts in ambiguous:
                ambiguous_report.append((article.id, article.title, texts))

            if not headings:
                continue

            for tag, text in headings:
                h3 = soup.new_tag('h3')
                h3.string = text
                tag.replace_with(h3)

            total_converted += len(headings)
            articles_touched += 1

            if options['apply']:
                article.body = str(soup)
                article.save(update_fields=['body'])
            elif options['article_id']:
                self.stdout.write(f'--- article {article.id}: {len(headings)} heading(s) ---')
                for _, text in headings:
                    self.stdout.write(f'  -> <h3>{text}</h3>')

        self.stdout.write(self.style.SUCCESS(
            f'{"Applied" if options["apply"] else "Would convert"}: '
            f'{total_converted} heading(s) across {articles_touched} article(s).'
        ))

        if ambiguous_report:
            self.stdout.write(self.style.WARNING(
                f'\n{len(ambiguous_report)} ambiguous block(s) skipped (multiple <u> runs alone in one block) — review manually:'
            ))
            for aid, title, texts in ambiguous_report:
                self.stdout.write(f'  article {aid} ({title[:60]!r}): {texts}')
