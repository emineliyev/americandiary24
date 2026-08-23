from django.contrib import admin

from .models import ContactMessage, Page, SiteSettings


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'is_active', 'updated_at')
    search_fields = ('title', 'body')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'subject', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('name', 'email', 'subject', 'message')
    readonly_fields = ('name', 'email', 'subject', 'message', 'created_at')


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Contact', {'fields': ('contact_email', 'contact_whatsapp', 'contact_address')}),
        ('Analytics & Ads', {'fields': ('ga_measurement_id', 'adsense_publisher_id', 'ads_txt_content')}),
        ('SEO', {'fields': ('default_meta_description', 'google_site_verification', 'default_share_image')}),
    )

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
