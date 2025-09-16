# backend/api/views.py

import json

import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt  # disable CSRF for API testing
def calculate_trip(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            origin = data.get("origin")
            destination = data.get("destination")

            # Ensure origin and destination exist
            if not origin or not destination:
                return JsonResponse(
                    {"error": "Missing origin or destination."}, status=400
                )

            # OpenRouteService API endpoint
            url = "https://api.openrouteservice.org/v2/directions/driving-car"
            headers = {
                "Accept": "application/json",
                "Authorization": settings.OPENROUTESERVICE_API_KEY,
                "Content-Type": "application/json",
            }
            body = {
                "coordinates": [
                    [origin["lng"], origin["lat"]],
                    [destination["lng"], destination["lat"]],
                ]
            }

            # Make request
            response = requests.post(url, headers=headers, data=json.dumps(body))
            response.raise_for_status()

            return JsonResponse(response.json(), safe=False)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON in request body."}, status=400)
        except requests.exceptions.RequestException as e:
            return JsonResponse(
                {"error": f"OpenRouteService error: {str(e)}"}, status=500
            )
        except Exception as e:
            return JsonResponse({"error": f"Unexpected error: {str(e)}"}, status=500)

    return JsonResponse({"error": "Invalid request method."}, status=405)


@csrf_exempt
def save_trip(request):
    if request.method == "POST":
        return JsonResponse({"message": "Trip saved!"})
    return JsonResponse({"error": "Invalid request"}, status=400)


def trip_history(request):
    return JsonResponse({"history": []})


@csrf_exempt
def delete_trip(request, trip_id):
    return JsonResponse({"message": f"Trip {trip_id} deleted"})

