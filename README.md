# Spotter App

Trip planning and ELD-style daily logs with interactive maps and saved trips.

- Frontend: React + TypeScript + Webpack + Tailwind CSS + PostCSS + Leaflet (OSM tiles)
- Backend: Django + Django REST Framework (DRF) + CORS
- Persistence: LocalStorage (client) + simple Trips API (server)

## Features

- Enter pickup and dropoff, calculate route and distance.
- Map with custom icons: Start, Pickup, Rest, Fuel, Dropoff (click for details and timestamp).
- ELD preview: per-day on/off/drive segments.
- Save trips (localStorage) and optionally persist to backend via /api/trips/.
- Trips list with delete.
- Django Admin for data inspection.

## Project structure

```
spotter_app/
├─ backend/
│  ├─ manage.py
│  ├─ spotter_app/               # Django project
│  │  ├─ settings/               # base.py (+ optional dev.py)
│  │  ├─ urls.py
│  │  ├─ asgi.py / wsgi.py
│  ├─ trips/                     # REST API: /api/trips/
│  │  ├─ models.py / views.py / urls.py / serializers.py
│  └─ requirements.txt
├─ frontend/
│  ├─ js/App.tsx                 # main UI logic
│  ├─ public/index.html
│  ├─ postcss.config.mjs
│  ├─ package.json
├─ .editorconfig / .gitattributes / .gitignore
├─ webpack.config.js / webpack-stats.json
└─ vercel.json
```

## Prerequisites

- Windows (PowerShell examples), Git
- Python 3.12+ (works on 3.13)
- Node.js 20+ and npm

## Quick start

1) Backend (Django)

```powershell
cd C:\Users\user\Desktop\spotter\spotter_app\backend
# create & activate venv if not active
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1

# install deps
pip install -r requirements.txt
# if requirements.txt is missing:
# pip install django djangorestframework django-cors-headers

# migrate and create superuser
python manage.py migrate
python manage.py createsuperuser

# run server (http://localhost:8000)
python manage.py runserver
```

2) Frontend (React)

```powershell
cd C:\Users\user\Desktop\spotter\spotter_app\frontend
npm ci
npm run dev   # http://localhost:3000
```

Open the frontend in a browser. The app calls the backend at http://localhost:8000/api by default (see App.tsx).

## Configuration

- Backend settings (development):
  - DEBUG=True, ALLOWED_HOSTS allow localhost.
  - SQLite at backend/db.sqlite3.
  - CORS enabled for dev.
- Frontend API base:
  - In App.tsx: `const API_BASE = 'http://localhost:8000/api'`.

Secrets
- Do not commit API keys. Prefer environment variables (e.g., 'MAPBOX_PUBLIC_KEY',`OPENROUTESERVICE_API_KEY`) if you add external routing/geocoding.

## Using the app

- Enter pickup and dropoff, then Calculate Trip.
- The map draws the route and places icons for:
  - S: Start, P: Pickup, R: Rest, F: Fuel, D: Dropoff.
  - Popups show location text, timestamp (if available), and lat/lon.
- Save Trip stores it locally and posts to `/api/trips/` (if backend is running).
- Open “Trips” to view or delete saved trips.

## REST API (DRF)

Base URL: `http://localhost:8000/api`

- GET /trips/ — list trips
- POST /trips/ — create trip
  - body: `{ "client_id": "uuid", "payload": { ...full TripPlan... } }`
- GET /trips/{id}/ — retrieve
- DELETE /trips/{id}/ — delete

Trip model:

```json
{
  "id": 1,
  "client_id": "b2a3…",
  "payload": {
    "route": [[lat, lon], ...],
    "stops": [{ "name": "Pickup", "kind": "pickup", "coords": [lat, lon], "location": "text", "ts": 1710000000000 }],
    "dailyLogs": [[{ "type": "Driving", "hours": 5.5 }], ...],
    "...": "other fields used by the UI"
  },
  "created_at": "2025-09-16T12:34:56Z"
}
```

## Common commands

Formatting:

```powershell
# Backend
cd backend
.\.venv\Scripts\Activate.ps1
pip install black isort
black .
isort .

# Frontend
cd ../frontend
npm run lint   # if configured
npx prettier --write "**/*.{js,jsx,ts,tsx,css,html,json,md}"
```

Tests (add as needed):

```powershell
# Django
python manage.py test
# Frontend (add vitest/jest if desired)
```

## Troubleshooting

- “ALLOWED_HOSTS if DEBUG is False”
  - Ensure dev settings set `DEBUG=True` and include localhost in `ALLOWED_HOSTS`.
- “DATABASES ENGINE value”
  - Verify `DATABASES['default']['ENGINE'] = 'django.db.backends.sqlite3'` and `NAME = db.sqlite3`.
- PowerShell venv activation
  - `Set-ExecutionPolicy -Scope Process Bypass; .\.venv\Scripts\Activate.ps1`
- 404 on /api/trips/
  - Confirm `trips` app is in `INSTALLED_APPS`, URLs include `path("api/", include("trips.urls"))`, and migrations applied.

## Deployment

- Frontend can be deployed as static assets (e.g., Vercel). Backend can be hosted on a Django-capable platform.
- Set production `ALLOWED_HOSTS`, proper `SECRET_KEY`, and a real database (PostgreSQL).
- Enable CORS only for required origins in production.

## Contributing

- Branch from `main`, open PRs. Use formatting tools above.

## License

- MIT (or your preferred license).
