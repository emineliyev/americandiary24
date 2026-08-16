from django.db import models


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
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class SiteSettings(models.Model):
    """Singleton: editable site-wide contact details, shown on the Contact
    page (and available anywhere via the site_settings context processor)."""

    contact_email = models.EmailField(blank=True)
    contact_whatsapp = models.CharField(max_length=30, blank=True)
    contact_address = models.CharField(max_length=255, blank=True)

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
