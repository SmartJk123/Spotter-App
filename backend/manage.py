import os
import sys

def main():
    # Always use dev settings by default; can override with --settings or env
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "spotter_app.settings.dev")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
