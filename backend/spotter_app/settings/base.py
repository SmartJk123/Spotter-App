import os

from decouple import config
from dj_database_url import parse as db_url
from django.conf import settings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def base_dir_join(*args):
    return os.path.join(BASE_DIR, *args)


SITE_ID = 1
STATIC_URL = "/static/"
DEBUG = True

ADMINS = (("Admin", "foo@example.com"),)

AUTH_USER_MODEL = "users.User"

ALLOWED_HOSTS = []
SECRET_KEY = "t8j_rljs@#n8o53!wz2i$!ol2l3&r18vs$0y7i^#jay#71t$9d"

DATABASES = {
    "default": config("DATABASE_URL", cast=db_url),
}

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_js_reverse",
    "webpack_loader",
    "model_utils",
    "import_export",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "django_guid",
    "common",
    "users",
    "api",
]

MIDDLEWARE = [
    "django.middleware.gzip.GZipMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django_permissions_policy.PermissionsPolicyMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
    "django_guid.middleware.guid_middleware",
]
AUTHENTICATION_BACKENDS = ("django.contrib.auth.backends.ModelBackend",)


DJANGO_GUID = {
    "GUID_HEADER_NAME": "Correlation-ID",
    "VALIDATE_GUID": True,
    "RETURN_HEADER": True,
}


ROOT_URLCONF = "spotter_app.urls"
WSGI_APPLICATION = "spotter_app.wsgi.application"

import os

from decouple import config
from dj_database_url import parse as db_url

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def base_dir_join(*args):
    return os.path.join(BASE_DIR, *args)


SITE_ID = 1
STATIC_URL = "/static/"
DEBUG = True

ADMINS = (("Admin", "foo@example.com"),)

AUTH_USER_MODEL = "users.User"

ALLOWED_HOSTS = []
SECRET_KEY = "t8j_rljs@#n8o53!wz2i$!ol2l3&r18vs$0y7i^#jay#71t$9d"
OPENROUTESERVICE_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM1MTQ1YzMyMGQ5MTRjZjQ5ODY4NGIxMzA4ZGJjYzhlIiwiaCI6Im11cm11cjY0In0="

DATABASES = {
    "default": config("DATABASE_URL", cast=db_url),
}

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_js_reverse",
    "webpack_loader",
    "model_utils",
    "import_export",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "django_guid",
    "common",
    "users",
    "api",
    "trips",
]

MIDDLEWARE = [
    "django.middleware.gzip.GZipMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django_permissions_policy.PermissionsPolicyMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
    "django_guid.middleware.guid_middleware",
]
AUTHENTICATION_BACKENDS = ("django.contrib.auth.backends.ModelBackend",)

ASGI_APPLICATION = "spotter_app.asgi.application"


DJANGO_GUID = {
    "GUID_HEADER_NAME": "Correlation-ID",
    "VALIDATE_GUID": True,
    "RETURN_HEADER": True,
}


ROOT_URLCONF = "spotter_app.urls"
WSGI_APPLICATION = "spotter_app.wsgi.application"

ASGI_APPLICATION = "myproject.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
    },
}


WEBPACK_LOADER = {
    "DEFAULT": {
        "BUNDLE_DIR_NAME": "webpack_bundles/",
        "STATS_FILE": "C:\\Users\\user\\Desktop\\spotter\\spotter_app\\webpack-stats.json",
        "POLL_INTERVAL": 0.1,
        "TIMEOUT": 40,
        "IGNORE": [r".+\.hot-update\.js", r".+\.map"],
        # These settings are crucial for development
        "ASSETS_BASE_URL": "http://localhost:3000/",
        "PUBLIC_PATH": "http://localhost:3000/frontend/webpack_bundles/",
        "CACHE": False,  # Set to True for production
    }
}
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            os.path.join(BASE_DIR, "templates")
        ],  # you can add React template dir later
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


ASGI_APPLICATION = "myproject.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
    },
}


WEBPACK_LOADER = {
    "DEFAULT": {
        "BUNDLE_DIR_NAME": "webpack_bundles/",
        "STATS_FILE": "C:\\Users\\user\\Desktop\\spotter\\spotter_app\\webpack-stats.json",
        "POLL_INTERVAL": 0.1,
        "TIMEOUT": 40,
        "IGNORE": [r".+\.hot-update\.js", r".+\.map"],
        # These settings are crucial for development
        "ASSETS_BASE_URL": "http://localhost:3000/",
        "PUBLIC_PATH": "http://localhost:3000/frontend/webpack_bundles/",
        "CACHE": False,  # Set to True for production
    }
}
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            os.path.join(BASE_DIR, "templates")
        ],  # you can add React template dir later
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

