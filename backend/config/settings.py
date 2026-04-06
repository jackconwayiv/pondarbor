import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")

# When False, User.pre_delete blocks hard deletes (use deleted_at / account_status instead).
# Enabled automatically during `manage.py test`, or set ALLOW_USER_HARD_DELETE=true to override.
ALLOW_USER_HARD_DELETE = os.getenv("ALLOW_USER_HARD_DELETE", "").lower() in ("true", "1", "yes") or (
    len(sys.argv) >= 2 and sys.argv[1] == "test"
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-key")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# If CORS_ALLOWED_ORIGINS is set but empty in .env, the list becomes [] and preflight fails
# with "No 'Access-Control-Allow-Origin' header".
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_cors_env_raw = os.getenv("CORS_ALLOWED_ORIGINS")
if _cors_env_raw is None:
    CORS_ALLOWED_ORIGINS = list(_DEFAULT_CORS_ORIGINS)
else:
    _cors_parsed = [o.strip() for o in _cors_env_raw.split(",") if o.strip()]
    CORS_ALLOWED_ORIGINS = _cors_parsed if _cors_parsed else list(_DEFAULT_CORS_ORIGINS)

# django-cors-headers: cannot use ALLOW_ALL_ORIGINS and ALLOW_CREDENTIALS together.
# DEBUG: allow any origin (dev when SPA calls :8000 directly). Prefer Vite proxy + same-origin fetch.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = False
else:
    CORS_ALLOW_CREDENTIALS = True

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Application definition
INSTALLED_APPS = [
    # Django apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # DRF
    "rest_framework",
    "corsheaders",
    # Site apps
    "users.apps.UsersConfig",
    "quotes.apps.QuotesConfig",
    "friends.apps.FriendsConfig",
    "whatif.apps.WhatifConfig",
    "clicker.apps.ClickerConfig",
    "achievements.apps.AchievementsConfig",
    "qff.apps.QffConfig",
    "closet.apps.ClosetConfig",
    # allauth
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# This is where the React build output ends up for the single-app deploy.
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

STATICFILES_DIRS = []
if FRONTEND_DIST_DIR.exists():
    STATICFILES_DIRS.append(FRONTEND_DIST_DIR)

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Optional media settings
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Closet images (Cloudflare R2). Prefix must match uploads_presign keys: {prefix}/{user_id}/...
_closet_r2_prefix = os.getenv("CLOSET_R2_KEY_PREFIX", "closet").strip().strip("/")
CLOSET_R2_KEY_PREFIX = _closet_r2_prefix if _closet_r2_prefix else "closet"
# Public base URL for object reads (e.g. R2 custom domain). No trailing slash. Empty = no image_url in API.
CLOSET_R2_PUBLIC_BASE_URL = os.getenv("CLOSET_R2_PUBLIC_BASE_URL", "").strip().rstrip("/")
# S3 API endpoint for boto3 presign. If unset, uses https://{CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com
# Use the jurisdiction URL from R2 (e.g. EU) when Cloudflare shows a different host than the default.
CLOSET_R2_S3_ENDPOINT_URL = os.getenv("CLOSET_R2_S3_ENDPOINT_URL", "").strip().rstrip("/")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.User"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "pondarbor",
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "users.auth0_backend.Auth0TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

LOGIN_REDIRECT_URL = "/api/v1/users/me/"
LOGOUT_REDIRECT_URL = "/accounts/login/"

SITE_ID = 1

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "none"

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")
# Optional: token `iss` when it differs from https://{AUTH0_DOMAIN}/ (custom domain setups).
AUTH0_ISSUER = os.getenv("AUTH0_ISSUER")
AUTH0_ALGORITHMS = ["RS256"]

# Logs go to stderr so Gunicorn / Appliku "App Logs" shows tracebacks for 500s.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
