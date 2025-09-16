from django.contrib import admin
from .models import Trip, DailyLog, Driver

admin.site.register(Driver)
admin.site.register(Trip)
admin.site.register(DailyLog)