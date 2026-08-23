from rest_framework import serializers

from core.models import MediaAsset

from .models import Article, Author, Category, Tag


def _apply_media_asset(instance, field_name, asset_id):
    """Resolves a write-only `<field>_asset_id` (see AuthorSerializer.
    avatar_asset_id / ArticleSerializer.image_asset_id) into the actual
    ImageField by pointing it at the same already-uploaded MediaAsset file
    — the file is never re-uploaded/duplicated, just referenced, mirroring
    what news/api_views.py's retired per-parent upload endpoints used to do
    directly. `asset_id=None` clears the field."""
    if asset_id is None:
        setattr(instance, field_name, '')
    else:
        asset = MediaAsset.objects.get(pk=asset_id)
        setattr(instance, field_name, asset.file.name)
    instance.save(update_fields=[field_name])


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'order', 'is_active']


class AuthorSerializer(serializers.ModelSerializer):
    # Write-only — set via the Media Library (upload or pick-existing) on
    # the admin panel's own Save, not a separate upload call, so an avatar
    # can be attached to a brand-new (not-yet-saved) journalist profile.
    avatar_asset_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Author
        fields = [
            'id', 'name', 'slug', 'avatar', 'avatar_asset_id', 'user', 'title', 'bio', 'email', 'phone',
            'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url',
            'youtube_url', 'telegram_url', 'other_social_url',
            'show_on_about', 'order',
        ]
        read_only_fields = ['avatar']  # set via avatar_asset_id, see create()/update() below

    def create(self, validated_data):
        asset_id = validated_data.pop('avatar_asset_id', serializers.empty)
        instance = super().create(validated_data)
        if asset_id is not serializers.empty:
            _apply_media_asset(instance, 'avatar', asset_id)
        return instance

    def update(self, instance, validated_data):
        asset_id = validated_data.pop('avatar_asset_id', serializers.empty)
        instance = super().update(instance, validated_data)
        if asset_id is not serializers.empty:
            _apply_media_asset(instance, 'avatar', asset_id)
        return instance


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']


class ArticleListSerializer(serializers.ModelSerializer):
    """Lightweight shape for the admin list view — no body, so paging
    through hundreds of articles doesn't ship megabytes of HTML."""
    category = CategorySerializer(read_only=True)
    author = AuthorSerializer(read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'category', 'author', 'status',
            'published_at', 'updated_at', 'view_count', 'image', 'deleted_at',
            'is_breaking', 'is_exclusive', 'is_editors_pick', 'is_reference',
        ]


class ArticleSerializer(serializers.ModelSerializer):
    """Full read/write shape used by the create/edit form. Category/author
    are written by primary key (category_id/author_id) and read back as
    nested objects — the standard DRF pattern for FK fields that need a
    picker on the frontend but full detail on display."""
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True,
    )
    author = AuthorSerializer(read_only=True)
    author_id = serializers.PrimaryKeyRelatedField(
        queryset=Author.objects.all(), source='author', write_only=True,
    )
    co_authors = AuthorSerializer(many=True, read_only=True)
    co_author_ids = serializers.PrimaryKeyRelatedField(
        queryset=Author.objects.all(), source='co_authors', write_only=True, many=True, required=False,
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), source='tags', write_only=True, many=True, required=False,
    )
    # Write-only — set via the Media Library (upload or pick-existing) on
    # the same Save as every other field, not a separate upload call, so
    # the image can be attached before the article is ever saved.
    image_asset_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'dek', 'body',
            'meta_title', 'meta_description',
            'image', 'image_asset_id', 'image_credit', 'youtube_id',
            'category', 'category_id', 'author', 'author_id',
            'co_authors', 'co_author_ids', 'tags', 'tag_ids',
            'status', 'published_at', 'updated_at', 'view_count',
            'is_breaking', 'is_exclusive', 'is_editors_pick', 'is_reference',
            'is_indexed', 'show_author_name',
        ]
        read_only_fields = ['image', 'view_count', 'updated_at']

    def validate_slug(self, value):
        qs = Article.objects.filter(slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An article with this slug already exists.')
        return value

    def create(self, validated_data):
        asset_id = validated_data.pop('image_asset_id', serializers.empty)
        instance = super().create(validated_data)
        if asset_id is not serializers.empty:
            _apply_media_asset(instance, 'image', asset_id)
        return instance

    def update(self, instance, validated_data):
        asset_id = validated_data.pop('image_asset_id', serializers.empty)
        instance = super().update(instance, validated_data)
        if asset_id is not serializers.empty:
            _apply_media_asset(instance, 'image', asset_id)
        return instance
