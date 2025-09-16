from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Driver, Trip, DailyLog
from .serializers import DriverSerializer, TripSerializer, DailyLogSerializer

class DriverListCreateView(generics.ListCreateAPIView):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer

class DriverDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer

class TripListCreateView(generics.ListCreateAPIView):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer

    def perform_create(self, serializer):
        driver_id = self.request.data.get('driver')
        driver = get_object_or_404(Driver, id=driver_id)
        serializer.save(driver=driver)

class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer

class DailyLogListCreateView(generics.ListCreateAPIView):
    queryset = DailyLog.objects.all()
    serializer_class = DailyLogSerializer

class DailyLogDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DailyLog.objects.all()
    serializer_class = DailyLogSerializer
