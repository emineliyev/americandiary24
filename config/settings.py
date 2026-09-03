from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

SITE_DOMAIN = env('SITE_DOMAIN', default='https://www.americandiary24.com')
SHOW_ADS = env.bool('SHOW_ADS', default=True)

# Lets Django's CSRF checks trust POSTs whose Origin matches the real site —
# needed once the site is reached over HTTPS (see also
# SECURE_PROXY_SSL_HEADER below, for the same HTTPS-behind-Nginx setup).
CSRF_TRUSTED_ORIGINS = [SITE_DOMAIN]

REDIS_URL = env('REDIS_URL', default='redis://127.0.0.1:6379/1')
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
        'KEY_PREFIX': 'amdiary',
    }
}

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'django.contrib.sitemaps',

    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',

    'core',
    'news',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Local-dev-only query profiler — never installed/loaded when DEBUG is off,
# so there's no risk of it ever showing up in production.
if DEBUG:
    INSTALLED_APPS.append('debug_toolbar')
    MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')
    INTERNAL_IPS = ['127.0.0.1']

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'core.context_processors.site_settings',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# American Diary 24 — English-language, US-based editorial (Washington, D.C. dateline).
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/New_York'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Offsite copy of create_backup's output, via rclone (a personal Google
# account authorized once with `rclone config` — a bare service account
# can't write to a regular Drive, only a paid-Workspace Shared Drive).
# GOOGLE_DRIVE_REMOTE_PATH is an rclone remote:path, e.g.
# "gdrive:AmericanDiary24Backups". Blank by default, in which case
# create_backup just skips the upload and only keeps the local copy under
# BASE_DIR/backups/. RCLONE_BINARY_PATH is only needed if rclone isn't on
# the system PATH.
GOOGLE_DRIVE_REMOTE_PATH = env('GOOGLE_DRIVE_REMOTE_PATH', default='')
RCLONE_BINARY_PATH = env('RCLONE_BINARY_PATH', default='')
# Explicit --config path so both the root-run cron job and a www-data-run
# admin panel click see the same rclone remote — see create_backup.py.
RCLONE_CONFIG_PATH = env('RCLONE_CONFIG_PATH', default='')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
    ],
    # Only the public contact-form endpoint sets throttle_classes, so this
    # rate applies there and nowhere else.
    'DEFAULT_THROTTLE_RATES': {
        'contact': '5/hour',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

# Admin panel (React/Vite) is a static build with root-relative asset paths
# (Vite's default `base: '/'`), so it's served from its own subdomain (e.g.
# admin.americandiary24.com) rather than a sub-path of the main site — its
# API calls to www.<domain>/api/v1 are therefore cross-origin in production
# too, not just in dev. CORS_ALLOWED_ORIGINS must be set either way.
CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=['http://localhost:5173'] if DEBUG else [],
)

# Production hardening — only takes effect once DEBUG=False on the VPS.
if not DEBUG:
    # Overridable so the site can be smoke-tested over plain http:// (e.g.
    # by raw IP, before DNS/SSL are live) without an infinite redirect —
    # flip back to the True default once certbot has issued a real cert.
    SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    # Nginx terminates TLS and proxies to Gunicorn over plain HTTP — without
    # this, Django can't tell the original request was HTTPS, so
    # SECURE_SSL_REDIRECT above would redirect every request forever. Only
    # trustworthy because Nginx (not the public internet) sets this header;
    # the Nginx config must include `proxy_set_header X-Forwarded-Proto $scheme;`.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Structured error logging (spec #43): 4xx/5xx and unhandled exceptions go
# to both the console (captured by systemd/journald under Gunicorn) and a
# rotating file, instead of only whatever Django prints by default. DEBUG's
# own "technical 500 page" is never shown to visitors once DEBUG=False —
# that's Django's default behavior, unaffected by this config.
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '{asctime} {levelname} {name} {message}', 'style': '{'},
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'django.log',
            'maxBytes': 5 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'error_file'],
            'level': 'INFO',
            'propagate': True,
        },
        # 4xx (404, ...) log at WARNING, 5xx/unhandled exceptions at ERROR —
        # both come through this logger.
        'django.request': {
            'handlers': ['console', 'error_file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console', 'error_file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
