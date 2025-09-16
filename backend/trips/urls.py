# backend/trips/urls.py

from django.urls import path
from .views import (
    TripListCreate, TripRetrieveDestroy,
    DriverListCreateView, DriverDetailView,
    DailyLogListCreateView, DailyLogDetailView,
)

urlpatterns = [
    path("trips/", TripListCreate.as_view(), name="trip-list"),
    path("trips/<int:pk>/", TripRetrieveDestroy.as_view(), name="trip-detail"),
    path("drivers/", DriverListCreateView.as_view(), name="driver-list"),
    path("drivers/<int:pk>/", DriverDetailView.as_view(), name="driver-detail"),
    path("daily-logs/", DailyLogListCreateView.as_view(), name="dailylog-list"),
    path("daily-logs/<int:pk>/", DailyLogDetailView.as_view(), name="dailylog-detail"),
]
