from django.urls import path

from . import views

app_name = 'news'

urlpatterns = [
    path('news.php', views.article_detail, name='article'),
    path('cat.php', views.category_detail, name='category'),
]
