from django.db import migrations

GROUPS = ['Administrator', 'Baş Redaktor', 'Redaktor', 'Müəllif']

# (app_label, model_name) this project's content models, for standard
# Django add/change/(delete where applicable) permissions.
CONTENT_MODELS = [
    ('news', 'article'), ('news', 'category'), ('news', 'author'),
    ('news', 'tag'), ('news', 'quote'),
    ('core', 'page'), ('core', 'sitesettings'),
]


def create_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    groups = {name: Group.objects.get_or_create(name=name)[0] for name in GROUPS}

    def perms_for(actions):
        result = []
        for app_label, model in CONTENT_MODELS:
            try:
                ct = ContentType.objects.get(app_label=app_label, model=model)
            except ContentType.DoesNotExist:
                continue
            result += list(Permission.objects.filter(content_type=ct, codename__in=[f'{a}_{model}' for a in actions]))
        return result

    # Administrator / Baş Redaktor: everything, including delete (mainly
    # relevant for non-Article models — Article itself has no destroy
    # endpoint at all, see news/api_views.py).
    full_access = perms_for(['add', 'change', 'delete', 'view'])
    groups['Administrator'].permissions.set(full_access)
    groups['Baş Redaktor'].permissions.set(full_access)

    # Redaktor: create/edit/publish, no delete.
    groups['Redaktor'].permissions.set(perms_for(['add', 'change', 'view']))

    # Müəllif: same base permissions — the "only your own articles" rule
    # is enforced in code (IsOwnArticleOrEditorRole), not by Django's
    # per-model (as opposed to per-object) permission system.
    groups['Müəllif'].permissions.set(perms_for(['add', 'change', 'view']))


def remove_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name__in=GROUPS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('news', '0008_article_meta_description_article_meta_title_and_more'),
        ('core', '0002_sitesettings_ads_txt_content_and_more'),
    ]

    operations = [
        migrations.RunPython(create_groups, remove_groups),
    ]
