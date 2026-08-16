from django.urls import path

from . import views

app_name = 'news'

urlpatterns = [
    path('news.php', views.article_detail, name='article'),
    path('cat.php', views.category_detail, name='category'),
    path('search.php', views.search, name='search'),
    path('tag/<slug:slug>/', views.tag_detail, name='tag'),
]
