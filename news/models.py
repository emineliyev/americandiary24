from django.conf import settings
from django.db import models
from django.utils import timezone


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        # URL scheme intentionally mirrors the legacy site (cat.php?cat=<id>)
        # so every previously indexed/shared link keeps working unchanged.
        return f'/cat.php?cat={self.pk}'


class Tag(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return f'/tag/{self.slug}/'


class Author(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    avatar = models.ImageField(upload_to='authors/', blank=True, max_length=255)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='author_profile',
        help_text='Links this byline to an admin-panel login. Required for '
                   'the "Müəllif" role, which can only edit its own articles.',
    )

    # Public profile fields — filled in from the admin panel's Users screen,
    # not a separate "Team" section (see news/api_views.py IsAdministratorOnly).
    title = models.CharField('position', max_length=150, blank=True)
    bio = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    facebook_url = models.URLField('Facebook', blank=True)
    twitter_url = models.URLField('X (Twitter)', blank=True)
    instagram_url = models.URLField('Instagram', blank=True)
    linkedin_url = models.URLField('LinkedIn', blank=True)
    youtube_url = models.URLField('YouTube', blank=True)
    telegram_url = models.URLField('Telegram', blank=True)
    other_social_url = models.URLField('Other', blank=True)

    show_on_about = models.BooleanField(
        default=False,
        help_text='Show this person as a card on the public About page, with their own profile page.',
    )
    order = models.PositiveIntegerField(default=0, help_text='Display order on the About page.')

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return f'/team/{self.slug}/'


class ArticleManager(models.Manager):
    """Excludes soft-deleted (trashed) articles by default so every existing
    call site — public views, sitemaps, dashboard_stats — automatically
    stops seeing them without needing to add `.exclude(...)` everywhere.
    The admin panel's trash tab uses `Article.all_objects` explicitly."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SCHEDULED = 'scheduled', 'Scheduled'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    dek = models.CharField('deck', max_length=300, blank=True)
    body = models.TextField(blank=True)
    meta_title = models.CharField(max_length=150, blank=True, help_text='Falls back to the title if left blank.')
    meta_description = models.CharField(max_length=300, blank=True, help_text='Falls back to the deck if left blank.')
    image = models.ImageField(upload_to='articles/', blank=True, max_length=255)
    image_credit = models.CharField(
        max_length=255, blank=True,
        help_text='Optional — e.g. "Photo: Reuters" or "AI-generated image". Shown under the main image.',
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='articles')
    author = models.ForeignKey(Author, on_delete=models.PROTECT, related_name='articles')
    # Additional bylines for jointly-reported pieces. `author` stays the
    # single owner permissions are checked against (a Müəllif can only edit
    # articles where they're the primary author) — co_authors is purely
    # about who gets credited in the byline.
    co_authors = models.ManyToManyField(Author, blank=True, related_name='co_authored_articles')
    tags = models.ManyToManyField(Tag, blank=True, related_name='articles')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_breaking = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    is_editors_pick = models.BooleanField(default=False)
    is_reference = models.BooleanField(
        'reference article', default=False,
        help_text='Featured in the "Referenced by" widget beside the homepage header (newest 6, shown with a circular thumbnail).',
    )
    is_indexed = models.BooleanField(
        'search-indexable',
        default=True,
        help_text='Uncheck for syndicated/wire content to exclude it from sitemap.xml and add noindex.',
    )
    show_author_name = models.BooleanField(
        default=True,
        help_text='Uncheck to display "News Desk" instead of the author\'s name on this article.',
    )

    view_count = models.PositiveIntegerField(default=0)

    # Soft delete — moving to the admin panel's Silinənlər (trash) tab sets
    # this instead of actually deleting the row, so it can be restored.
    # Only ArticleViewSet.permanent_delete does a real .delete().
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = ArticleManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ['-published_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Every public-facing query filters on `published_at__lte=now()`
        # (see news/views.py) — setting status to Published in the admin
        # panel without also picking a Publish Date/Time left published_at
        # null, so the save would succeed but the article would silently
        # never actually appear anywhere on the site. Defaulting it here
        # guarantees the two can't drift apart, regardless of which entry
        # point (admin panel, Django admin, a script) saves the row.
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        # URL scheme intentionally mirrors the legacy site (news.php?id=<id>)
        # so every previously indexed/shared link keeps working unchanged.
        return f'/news.php?id={self.pk}'

    @property
    def display_author_name(self):
        """Plain-text byline (e.g. for JSON-LD) — every credited name
        joined, or the "News Desk" fallback."""
        if not self.show_author_name:
            return 'News Desk'
        names = [p.name for p in self._byline_people if p.name.strip()]
        return ', '.join(names) or 'News Desk'

    @property
    def _byline_people(self):
        return [self.author, *self.co_authors.all()]

    @property
    def byline_people(self):
        """(name, url) pairs for the byline template, in credit order —
        primary author first, then co-authors. `url` is None when that
        person doesn't have a public profile (template falls back to the
        About page)."""
        if not self.show_author_name:
            return []
        return [
            (p.name, p.get_absolute_url() if p.show_on_about else None)
            for p in self._byline_people if p.name.strip()
        ]


class Quote(models.Model):
    """A spotlighted, newsworthy quote — editorially curated, not tied to a
    fixed publishing cadence. Optional fields (source, related_article) are
    blank-friendly so quotes migrated from the legacy `sitat` table, which
    never captured that context, remain valid without edits."""

    name = models.CharField('speaker name', max_length=100)
    title = models.CharField('speaker title', max_length=150, blank=True)
    quote_text = models.TextField()
    source = models.CharField(
        max_length=200, blank=True,
        help_text='Where/when it was said, e.g. "Press conference in Baku" or "Truth Social post".',
    )
    photo = models.ImageField(upload_to='quotes/', blank=True, max_length=255)
    related_article = models.ForeignKey(
        Article, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotes',
    )
    quote_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-quote_date', '-id']

    def __str__(self):
        return f'{self.name}: {self.quote_text[:50]}'
