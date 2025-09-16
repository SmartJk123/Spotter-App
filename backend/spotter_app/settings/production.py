# # spotter_app/settings/production.py

# from .base import *

# # Ensure MIDDLEWARE is defined (imported from base)
# try:
#     MIDDLEWARE
# except NameError:
#     MIDDLEWARE = []

# # Missing Imports
# import sentry_sdk
# from sentry_sdk.integrations.django import DjangoIntegration
# # from django_guid.integrations import SentryIntegration  # Removed: module does not exist

# # Inherit and extend INSTALLED_APPS and MIDDLEWARE
# INSTALLED_APPS += [
#     "django_guid.integrations.sentry_sdk",
#     # ... any other production-only apps
# ]

# MIDDLEWARE += [
#     "django_guid.middleware.GuidMiddleware",
#     # ... any other production-only middleware
# ]

# WEBPACK_LOADER = {
#     # ... your webpack settings
# }

# SENTRY_DSN = os.getenv("SENTRY_DSN")

# if SENTRY_DSN:
#     sentry_sdk.init(
#         dsn=SENTRY_DSN,
#         integrations=[
#             DjangoIntegration(),
#         ],
#         # ... other Sentry settings
#     )

