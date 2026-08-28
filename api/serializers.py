from django.contrib.auth.models import Group, User
from rest_framework import serializers

from core.models import ContactMessage, MediaAsset, MediaFolder, Page, SiteSettings
from news.serializers import _apply_media_asset

ROLE_CHOICES = ['Administrator', 'Baş Redaktor', 'Redaktor', 'Müəllif']


class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = ['id', 'title', 'slug', 'body', 'meta_title', 'meta_description', 'is_active', 'updated_at']
        # Every Page's URL is wired individually by slug in core/urls.py
        # (some keep exact legacy paths like useus.php) — renaming one here
        # would silently 404 its real route, so slug is edit-locked. Rows
        # themselves are also fixed (see PageViewSet): this is an editor for
        # the existing static pages, not a free-form page builder.
        read_only_fields = ['slug', 'updated_at']


class SiteSettingsSerializer(serializers.ModelSerializer):
    # Write-only — set via the Media Library (upload or pick-existing) on
    # the same Save as every other field, same convention as
    # ArticleSerializer.image_asset_id / AuthorSerializer.avatar_asset_id.
    default_share_image_asset_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = SiteSettings
        fields = [
            'contact_email', 'contact_whatsapp', 'contact_address',
            'facebook_url', 'twitter_url', 'instagram_url', 'youtube_url',
            'ga_measurement_id', 'adsense_publisher_id', 'ads_txt_content',
            'default_meta_description', 'homepage_meta_title', 'google_site_verification',
            'default_share_image', 'default_share_image_asset_id',
        ]
        read_only_fields = ['default_share_image']  # set via default_share_image_asset_id, see update() below

    def update(self, instance, validated_data):
        asset_id = validated_data.pop('default_share_image_asset_id', serializers.empty)
        instance = super().update(instance, validated_data)
        if asset_id is not serializers.empty:
            _apply_media_asset(instance, 'default_share_image', asset_id)
        return instance


class ContactMessageSerializer(serializers.ModelSerializer):
    """Admin-panel Inquiries inbox. Only `is_read` is writable (PATCH to
    mark read/unread) — the submitted content itself is never editable."""

    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'subject', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'name', 'email', 'subject', 'message', 'created_at']


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    """Public-facing: the Contact page form only ever submits these four
    fields — id/is_read/created_at are server-assigned."""

    class Meta:
        model = ContactMessage
        fields = ['name', 'email', 'subject', 'message']


class MediaFolderSerializer(serializers.ModelSerializer):
    # Annotated via Count('assets') in MediaFolderViewSet.get_queryset — not
    # a real model field, so the sidebar can show counts without an N+1.
    asset_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = MediaFolder
        fields = ['id', 'name', 'order', 'asset_count']


class MediaAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaAsset
        fields = [
            'id', 'file', 'original_filename', 'folder', 'format',
            'width', 'height', 'size_bytes', 'uploaded_by', 'created_at',
        ]
        # `file`/`format`/dimensions/size are only ever set by the upload
        # pipeline (MediaAssetViewSet.create -> _create_media_asset), never
        # accepted as raw client input — PATCH only touches name/folder.
        read_only_fields = ['file', 'format', 'width', 'height', 'size_bytes', 'uploaded_by', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """Admin-panel login accounts. `role` is a thin view over Django Groups
    (one group per user, same convention `current_user` already reads) and
    `password` is write-only — required on create, optional on update so
    editing a profile doesn't force a password reset every time."""

    # Not a real model field — Group membership, read via to_representation()
    # and written via create()/update() below.
    role = serializers.ChoiceField(choices=ROLE_CHOICES, write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'role', 'password', 'date_joined',
        ]
        read_only_fields = ['date_joined']

    def validate_password(self, value):
        if not value and self.instance is None:
            raise serializers.ValidationError('A password is required for new users.')
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        groups = list(instance.groups.values_list('name', flat=True))
        data['role'] = 'Administrator' if instance.is_superuser else (groups[0] if groups else 'Müəllif')
        return data

    def create(self, validated_data):
        role = validated_data.pop('role')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set([Group.objects.get(name=role)])
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if role:
            instance.groups.set([Group.objects.get(name=role)])
        return instance
