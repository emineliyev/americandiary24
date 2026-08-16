from django.contrib import admin

from .models import Page, SiteSettings


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'updated_at')
    search_fields = ('title', 'body')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Contact', {'fields': ('contact_email', 'contact_whatsapp', 'contact_address')}),
        ('Analytics & Ads', {'fields': ('ga_measurement_id', 'adsense_publisher_id', 'ads_txt_content')}),
    )

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
