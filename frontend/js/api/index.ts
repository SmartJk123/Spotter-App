// frontend/js/api/index.ts
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

export interface TripInput {
  current_location: string; // "lat,lon" or address depending on backend
  pickupLocation: string;
  dropoffLocation: string;
  current_cycle_used_hours: number;
}

export interface FuelStop {
  lat: number;
  lon: number;
  note?: string;
}

export interface DailySheet {
  day: number;
  driving_hours: number;
  on_duty_hours: number;
  duty_segments: { type: string; hours: number }[];
}

export interface TripResult {
  distance_miles: number;
  duration_hours: number;
  geometry: {
    type: "LineString";
    coordinates: number[][]; // [lon, lat]
  };
  fueling_stops: FuelStop[];
  daily_sheets: DailySheet[];
}

/**
 * POST /api/route/  (expected backend route)
 * If backend is not ready, use mock response.
 */
export async function planTrip(input: TripInput): Promise<TripResult> {
  const useMock = process.env.REACT_APP_USE_MOCK === "true";

  if (useMock) {
    // Mock response for development/testing
    return {
      distance_miles: 320.4,
      duration_hours: 6.3,
      geometry: {
        type: "LineString",
        coordinates: [
          [-74.006, 40.7128],
          [-75.1652, 39.9526],
          [-77.0369, 38.9072],
        ],
      },
      fueling_stops: [{ lat: 39.5, lon: -75.8, note: "Fuel at station A" }],
      daily_sheets: [
        {
          day: 1,
          driving_hours: 10,
          on_duty_hours: 14,
          duty_segments: [
            { type: "driving", hours: 10 },
            { type: "on_duty", hours: 4 },
          ],
        },
      ],
    };
  }

  // Call backend if not using mock
  const res = await api.post<TripResult>("/api/route/", input);
  return res.data;
}

