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
    avatar = models.ImageField(upload_to='authors/', blank=True)

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
    image = models.ImageField(upload_to='articles/', blank=True)
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
