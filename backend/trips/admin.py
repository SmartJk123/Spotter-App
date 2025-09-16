from django.contrib import admin
from .models import Trip

@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "client_id", "created_at")
    list_filter = ("created_at",)
    search_fields = ("client_id", "id")
    ordering = ("-created_at",)

