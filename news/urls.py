from django.urls import path

from . import views

app_name = 'news'

urlpatterns = [
    path('news.php', views.article_detail, name='article'),
    path('cat.php', views.category_detail, name='category'),
    path('search.php', views.search, name='search'),
    path('exclusive/', views.exclusive_list, name='exclusive'),
    path('tag/<slug:slug>/', views.tag_detail, name='tag'),
    path('team/<slug:slug>/', views.team_detail, name='team_detail'),

    # New-style article URLs (/<category>/<article>/) — deliberately last so
    # every literal route above (news.php, cat.php, tag/..., team/... etc.)
    # gets first crack at matching; this generic 2-segment pattern would
    # otherwise shadow them.
    path('<slug:category_slug>/<slug:article_slug>/', views.article_detail_by_slug, name='article_slug'),
]
