from rest_framework import serializers

from .models import Article, Author, Category, Tag


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'order', 'is_active']


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name', 'slug', 'avatar']


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
            'published_at', 'updated_at', 'view_count', 'image',
            'is_breaking', 'is_exclusive', 'is_editors_pick',
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
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), source='tags', write_only=True, many=True, required=False,
    )

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'dek', 'body',
            'meta_title', 'meta_description',
            'image', 'youtube_id',
            'category', 'category_id', 'author', 'author_id', 'tags', 'tag_ids',
            'status', 'published_at', 'updated_at', 'view_count',
            'is_breaking', 'is_exclusive', 'is_editors_pick',
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
