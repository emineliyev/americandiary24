from django.db import models


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


class Author(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    avatar = models.ImageField(upload_to='authors/', blank=True, max_length=255)

    def __str__(self):
        return self.name


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
    image = models.ImageField(upload_to='articles/', blank=True, max_length=255)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='articles')
    author = models.ForeignKey(Author, on_delete=models.PROTECT, related_name='articles')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_breaking = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    is_editors_pick = models.BooleanField(default=False)
    is_indexed = models.BooleanField(
        'search-indexable',
        default=True,
        help_text='Uncheck for syndicated/wire content to exclude it from sitemap.xml and add noindex.',
    )
    show_author_name = models.BooleanField(
        default=True,
        help_text='Uncheck to display "Editorial" instead of the author\'s name on this article.',
    )

    youtube_id = models.CharField(max_length=11, blank=True)
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-published_at']

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        # URL scheme intentionally mirrors the legacy site (news.php?id=<id>)
        # so every previously indexed/shared link keeps working unchanged.
        return f'/news.php?id={self.pk}'

    @property
    def display_author_name(self):
        if self.show_author_name and self.author.name.strip():
            return self.author.name
        return 'Editorial'


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
