from django.contrib import admin

from .models import Article, Author, Category, Quote, Tag


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'is_active')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'author', 'show_author_name', 'status', 'published_at', 'view_count')
    list_filter = ('status', 'category', 'is_breaking', 'is_exclusive', 'is_editors_pick', 'show_author_name')
    search_fields = ('title', 'dek', 'body')
    prepopulated_fields = {'slug': ('title',)}
    filter_horizontal = ('tags',)


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ('name', 'title', 'quote_date', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'quote_text')
