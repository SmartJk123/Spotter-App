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

class TripListCreate(generics.ListCreateAPIView):
    queryset = Trip.objects.order_by('-created_at')
    serializer_class = TripSerializer

class TripRetrieveDestroy(generics.RetrieveDestroyAPIView):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer

class DailyLogListCreateView(generics.ListCreateAPIView):
    queryset = DailyLog.objects.all()
    serializer_class = DailyLogSerializer

class DailyLogDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DailyLog.objects.all()
    serializer_class = DailyLogSerializer
