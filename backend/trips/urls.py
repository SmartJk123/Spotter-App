from django.contrib import admin
from django.urls import path, include
from .views import TripListCreate, TripRetrieveDestroy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('trips.urls')),  # add this
    path('trips/', TripListCreate.as_view(), name='trip-list'),
    path('trips/<int:pk>/', TripRetrieveDestroy.as_view(), name='trip-detail'),
]
