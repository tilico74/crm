"""Configuração do Django. Todo valor variável vem do .env (ADR-001)."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost"]),
    DJANGO_CORS_ALLOWED_ORIGINS=(list, []),
)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

PROJECT_APPS = [
    "apps.core",
    "apps.usuarios",
    "apps.clientes",
    "apps.catalogo",
    "apps.crm",
    "apps.vendas",
    "apps.servicos",
    "apps.comissoes",
    "apps.estoque",
    "apps.financeiro",
    "apps.fiscal",
    "apps.migracao",
]

INSTALLED_APPS = [
    # Unfold precisa vir antes do django.contrib.admin.
    "unfold",
    "unfold.contrib.filters",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "storages",
    *PROJECT_APPS,
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="db"),
        "PORT": env("POSTGRES_PORT", default="5432"),
    }
}

# IDs são BIGINT, iguais aos da MarketUP (ADR-004).
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Definido antes da primeira migração: trocar depois exige refazer o banco.
AUTH_USER_MODEL = "usuarios.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
LOCALE_PATHS = [BASE_DIR / "locale"]
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Arquivos: S3/MinIO quando S3_BUCKET estiver preenchido; senão, disco local.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
if env("S3_BUCKET", default=""):
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("S3_BUCKET"),
            "endpoint_url": env("S3_ENDPOINT_URL", default=None),
            "access_key": env("S3_ACCESS_KEY"),
            "secret_key": env("S3_SECRET_KEY"),
        },
    }

CORS_ALLOWED_ORIGINS = env("DJANGO_CORS_ALLOWED_ORIGINS")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.Paginacao",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "RDX CRM/ERP",
    "VERSION": "0.1.0",
}

CELERY_BROKER_URL = env("REDIS_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TIMEZONE = TIME_ZONE

# Cores do painel montadas com os tokens RDX (context/design-system/cores-e-tokens.md).
# Claro usa primary-600 em botões e links; escuro usa primary-400/500.
UNFOLD = {
    "SITE_TITLE": "RDX",
    "SITE_HEADER": "RDX CRM/ERP",
    "COLORS": {
        "base": {
            "50": "#F6F9FB",  # surface
            "100": "#EDF2F5",
            "200": "#DFE6EB",  # line
            "300": "#C9D3DA",  # secondary (escuro)
            "400": "#9AA7B2",  # ink-muted (escuro)
            "500": "#5A6773",  # ink-muted
            "600": "#4A5560",  # secondary-light (escuro)
            "700": "#2B363F",  # line (escuro)
            "800": "#26323C",  # secondary
            "900": "#182027",  # surface-raised (escuro)
            "950": "#0F1418",  # surface (escuro)
        },
        "primary": {
            "50": "#EEF8FE",
            "100": "#D1EDFC",  # primary-light
            "200": "#A0DEFF",  # primary-dark (escuro)
            "300": "#5FCBFF",  # primary (escuro)
            "400": "#22B6F1",  # brand-cyan (escuro)
            "500": "#00ABE5",  # brand-cyan
            "600": "#006C93",  # primary
            "700": "#005473",  # primary-dark
            "800": "#00435C",
            "900": "#0B3346",  # primary-light (escuro)
            "950": "#072230",
        },
        "font": {
            "subtle-light": "var(--color-base-500)",
            "subtle-dark": "var(--color-base-400)",
            "default-light": "var(--color-base-600)",
            "default-dark": "var(--color-base-300)",
            "important-light": "#1A1F24",  # ink
            "important-dark": "#E8EEF2",  # ink (escuro)
        },
    },
}
