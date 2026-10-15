"""
Django settings for the Truck Routing API.

A stateless JSON API: no models, no database, no auth/sessions. Just DRF
APIViews that call providers (ORS, weather) and compute responses per
docs/API.md. Keys come from the environment (.env).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# Match the contract exactly (GET /api/places, no trailing slash).
APPEND_SLASH = False

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "routing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = []
WSGI_APPLICATION = "config.wsgi.application"

# Everything is UTC on the wire (docs/API.md). Keep Django in UTC so DRF's
# DateTimeField doesn't shift parsed instants into a local zone.
TIME_ZONE = "UTC"
USE_TZ = True

# No models -> no database.
DATABASES = {}

# CORS: allow the Vite dev server (any origin in debug; explicit list in prod).
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o
]

STATIC_URL = "static/"

REST_FRAMEWORK = {
    # Wire format is camelCase + JSON only (no browsable API, no DB-backed auth).
    "DEFAULT_RENDERER_CLASSES": [
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
    # No contrib.auth installed -> don't resolve request.user to AnonymousUser.
    "UNAUTHENTICATED_USER": None,
}

# Provider config (read by the services). Defaults are keyless/synthetic.
ORS_API_KEY = os.environ.get("ORS_API_KEY", "")
ROUTING_PROVIDER = os.environ.get("ROUTING_PROVIDER", "synthetic")  # "synthetic" | "ors"
WEATHER_PROVIDER = os.environ.get("WEATHER_PROVIDER", "synthetic")  # "synthetic" | "open_meteo"
