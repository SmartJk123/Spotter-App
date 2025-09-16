from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DailyLog, Driver, Trip
from .serializers import DailyLogSerializer, DriverSerializer, TripSerializer


class DriverListCreateView(generics.ListCreateAPIView):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer


class DriverDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer


class TripListCreate(generics.ListCreateAPIView):
    queryset = Trip.objects.order_by("-created_at")
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

