from django.urls import path

from . import views

app_name = 'core'

urlpatterns = [
    path('', views.home, name='home'),
    path('index.php', views.home, name='home_legacy'),

    # Legacy URLs preserved so old links/indexed pages keep working.
    path('about.php', views.page_detail, {'slug': 'about'}, name='about'),
    path('contact.php', views.page_detail, {'slug': 'contact'}, name='contact'),
    path('useus.php', views.page_detail, {'slug': 'terms-of-use'}, name='terms'),
    path('reklam.php', views.page_detail, {'slug': 'advertise'}, name='advertise'),

    # New pages — no legacy equivalent existed on the old site.
    path('privacy-policy/', views.page_detail, {'slug': 'privacy-policy'}, name='privacy'),
    path('cookie-policy/', views.page_detail, {'slug': 'cookie-policy'}, name='cookies'),
]
