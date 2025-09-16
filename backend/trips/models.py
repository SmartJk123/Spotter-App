from django.db import models
from django.db.models import JSONField
from django.db.models.deletion import CASCADE


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

    client_id = models.CharField(max_length=64, db_index=True)  # id from frontend
    payload = models.JSONField()  # entire trip plan (route, stops, dailyLogs, etc.)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.client_id} - {self.created_at:%Y-%m-%d %H:%M}"


class DailyLog(models.Model):
    """
    Stores the daily log sheet entries for a specific trip.
    """

    trip = models.ForeignKey(Trip, on_delete=CASCADE, related_name="daily_logs")
    log_data = JSONField(blank=True, null=True)

    def __str__(self):
        return f"Daily Log for Trip ID: {self.trip.id}"

