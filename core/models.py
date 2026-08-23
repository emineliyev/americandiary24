from django.conf import settings
from django.db import models


class MediaFolder(models.Model):
    """Flat (non-nested) organizational grouping for the admin panel's
    Media Library. Deleting a folder doesn't delete its files — they just
    become unfiled again, matching the site's no-data-loss stance."""

    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class MediaAsset(models.Model):
    """Catalog row for an uploaded image, created alongside every upload
    entry point (Article main image, Author avatar, CKEditor body images,
    and direct Media Library uploads) — see news.api_views._create_media_asset.
    Existing files uploaded before this model existed have no row and won't
    appear here; that backfill is a deliberate follow-up, not done here."""

    FORMAT_CHOICES = [('jpeg', 'JPEG'), ('png', 'PNG'), ('webp', 'WebP'), ('svg', 'SVG')]

    file = models.FileField(upload_to='uploads/%Y/%m/', max_length=255)
    original_filename = models.CharField(max_length=255, blank=True)
    folder = models.ForeignKey(MediaFolder, null=True, blank=True, on_delete=models.SET_NULL, related_name='assets')
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.original_filename or self.file.name


class Page(models.Model):
    """Editorially-managed static pages (About, Contact, Privacy Policy...).
    URLs are wired individually in core/urls.py rather than by slug alone,
    since some of them must keep exact legacy paths (about.php, contact.php,
    useus.php) so old links/indexed pages keep working."""

    title = models.CharField(max_length=150)
    slug = models.SlugField(max_length=100, unique=True)
    body = models.TextField(blank=True, help_text='HTML is allowed.')
    meta_title = models.CharField(max_length=150, blank=True)
    meta_description = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True, help_text='Unchecked pages 404 on the site and drop out of the footer, without deleting the row.')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class SiteSettings(models.Model):
    """Singleton: editable site-wide contact details, shown on the Contact
    page (and available anywhere via the site_settings context processor)."""

    contact_email = models.EmailField(blank=True)
    contact_whatsapp = models.CharField(max_length=30, blank=True)
    contact_address = models.CharField(max_length=255, blank=True)

    # Each blank by default — the public "Follow" widget only shows icons
    # for whichever of these are actually filled in, rather than linking
    # to placeholder/nonexistent profiles.
    facebook_url = models.URLField('Facebook URL', blank=True)
    twitter_url = models.URLField('X (Twitter) URL', blank=True)
    instagram_url = models.URLField('Instagram URL', blank=True)
    youtube_url = models.URLField('YouTube URL', blank=True)

    ga_measurement_id = models.CharField(
        'Google Analytics Measurement ID', max_length=20, blank=True,
        help_text='e.g. G-XXXXXXXXXX. Leave blank to disable Analytics entirely.',
    )
    adsense_publisher_id = models.CharField(
        'Google AdSense Publisher ID', max_length=20, blank=True,
        help_text='e.g. pub-1234567890123456. Enables the site-wide AdSense '
                   'auto-ads script and generates ads.txt automatically.',
    )
    ads_txt_content = models.TextField(
        'ads.txt override', blank=True,
        help_text='Leave blank to auto-generate from the Publisher ID above. '
                   'Only fill this in if Google gives you different/additional lines.',
    )

    default_meta_description = models.CharField(
        max_length=300, blank=True,
        help_text='Fallback <meta description> and social-share text for pages '
                   'that don\'t set their own (homepage, category pages, ...). '
                   'A generic sentence is used if left blank.',
    )
    google_site_verification = models.CharField(
        'Google Search Console verification', max_length=100, blank=True,
        help_text='Paste just the content value from Search Console\'s HTML tag '
                   'verification method, e.g. "abcXYZ123...". Leave blank if unused.',
    )
    default_share_image = models.ImageField(
        'Default social share image', upload_to='site/', blank=True,
        help_text='Fallback image for social share previews (Facebook/X/...) on '
                   'pages without their own image, like the homepage.',
    )

    class Meta:
        verbose_name_plural = 'site settings'

    def __str__(self):
        return 'Site settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ContactMessage(models.Model):
    """A visitor's submission through the public Contact form — reviewed
    from the admin panel's Inquiries inbox (api.views.ContactMessageViewSet).
    Created only via the public, unauthenticated api.views.ContactMessageCreateView."""

    name = models.CharField(max_length=150)
    email = models.EmailField()
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} <{self.email}>'
