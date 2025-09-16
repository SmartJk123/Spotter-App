# backend/spotter_app/urls.py

import django_js_reverse.views
from django.contrib import admin
from django.urls import include, path
from django.http import HttpResponse
from drf_spectacular.views import (SpectacularAPIView, SpectacularRedocView,
                                   SpectacularSwaggerView)
from rest_framework.routers import DefaultRouter

from common.routes import routes as common_routes
from users.routes import routes as users_routes

router = DefaultRouter()

routes = common_routes + users_routes
for route in routes:
    router.register(route["regex"], route["viewset"], basename=route["basename"])

urlpatterns = [
    path("", lambda r: HttpResponse("Spotter backend OK"), name="root"),
    path("admin/", admin.site.urls),
    path("jsreverse/", django_js_reverse.views.urls_js, name="js_reverse"),
    # API
    path("api/", include(router.urls)),
    # drf-spectacular
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path("api/trips/", include("trips.urls")), # Correctly link trips
]
