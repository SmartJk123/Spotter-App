from django.db import models
from django.db.models.deletion import CASCADE
from django.db.models import JSONField

class Driver(models.Model):
    """
    Stores information about a driver.
    """
    name = models.CharField(max_length=255)
    employee_id = models.CharField(max_length=50, unique=True)
    current_cycle_hours = models.FloatField(default=0.0)
    current_location = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class Trip(models.Model):
    """
    Stores details for each trip a driver takes.
    """
    driver = models.ForeignKey(Driver, on_delete=CASCADE, related_name='trips')
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used = models.FloatField()
    total_miles = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Using JSONField to store unstructured data like routes and stops
    route = JSONField(blank=True, null=True)
    stops = JSONField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Trip for {self.driver.name} from {self.pickup_location} to {self.dropoff_location}"

class DailyLog(models.Model):
    """
    Stores the daily log sheet entries for a specific trip.
    """
    trip = models.ForeignKey(Trip, on_delete=CASCADE, related_name='daily_logs')
    log_data = JSONField(blank=True, null=True)

    def __str__(self):
        return f"Daily Log for Trip ID: {self.trip.id}"
