
import os
import sys
from decouple import config

if __name__ == "__main__":
    settings_module = config("DJANGO_SETTINGS_MODULE", default="spotter_app.settings")

    if len(sys.argv) > 1 and sys.argv[1] == "test":
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "spotter_app.settings.test")
    else:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
