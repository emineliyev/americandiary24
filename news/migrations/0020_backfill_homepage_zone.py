from django.db import migrations
from django.utils import timezone

# Mirrors the exact index->zone mapping the old category_section_rows[N]
# template lookups used, so this migration is purely a mechanical rewrite —
# every category ends up in the same visual slot it already renders in today.
BESPOKE_SLUGS = ['breaking', 'analysis-opinion', 'did-you-know', 'climate']
ZONE_BY_ROW_INDEX = {0: 'top', 1: 'row1', 2: 'row2', 3: 'with_climate'}
ZONE_FALLBACK = 'bottom'


def assign_zones(apps, schema_editor):
    Category = apps.get_model('news', 'Category')
    Article = apps.get_model('news', 'Article')
    now = timezone.now()

    categories = list(
        Category.objects.filter(is_active=True, show_on_homepage=True)
        .exclude(slug__in=BESPOKE_SLUGS).order_by('homepage_order', 'name')
    )

    # Same grouping loop as the old core/views.py: skip categories with no
    # current published articles (they never consumed a row slot at render
    # time either), then break into rows wherever homepage_new_row is set.
    rows, current_row = [], []
    for category in categories:
        has_articles = Article.objects.filter(
            category=category, status='published', published_at__lte=now,
        ).exists()
        if not has_articles:
            continue
        if category.homepage_new_row and current_row:
            rows.append(current_row)
            current_row = []
        current_row.append(category)
    if current_row:
        rows.append(current_row)

    for index, row in enumerate(rows):
        zone = ZONE_BY_ROW_INDEX.get(index, ZONE_FALLBACK)
        for category in row:
            category.homepage_zone = zone
            category.save(update_fields=['homepage_zone'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('news', '0019_category_homepage_zone'),
    ]

    operations = [
        migrations.RunPython(assign_zones, noop),
    ]
