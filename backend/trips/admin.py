from django.contrib import admin

from .models import DailyLog, Driver, Trip

admin.site.register(Driver)
admin.site.register(Trip)
admin.site.register(DailyLog)

