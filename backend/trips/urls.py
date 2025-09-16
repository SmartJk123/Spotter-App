from django.urls import path
from .views import (
    DriverListCreateView, DriverDetailView,
    TripListCreateView, TripDetailView,
    DailyLogListCreateView, DailyLogDetailView
)

urlpatterns = [
    path('drivers/', DriverListCreateView.as_view(), name='driver-list'),
    path('drivers/<int:pk>/', DriverDetailView.as_view(), name='driver-detail'),
    path('trips/', TripListCreateView.as_view(), name='trip-list'),
    path('trips/<int:pk>/', TripDetailView.as_view(), name='trip-detail'),
    path('daily-logs/', DailyLogListCreateView.as_view(), name='daily-log-list'),
    path('daily-logs/<int:pk>/', DailyLogDetailView.as_view(), name='daily-log-detail'),
]
