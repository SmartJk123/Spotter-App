# backend/api/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path("calculate-trip/", views.calculate_trip, name="calculate_trip"),
    path("save-trip/", views.save_trip, name="save_trip"),
    path("trip-history/", views.trip_history, name="trip_history"),
    path("delete-trip/<int:trip_id>/", views.delete_trip, name="delete_trip"),
]
