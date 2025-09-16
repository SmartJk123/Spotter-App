from rest_framework import serializers
from .models import Trip

class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = ['id', 'client_id', 'payload', 'created_at']
        read_only_fields = ['id', 'created_at']
