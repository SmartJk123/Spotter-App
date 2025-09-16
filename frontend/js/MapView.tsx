import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ORS_API_KEY = process.env.REACT_APP_ORS_API_KEY as string;


interface MapViewProps {
  start: string;
  pickup: string;
  drop: string;
}

const MapView: React.FC<MapViewProps> = ({ start, pickup, drop }) => {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([0.3476, 32.5825], 6); // default Uganda/Kenya area
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapRef.current);
    }

    const fetchRoute = async () => {
      try {
        // Geocode addresses → coordinates
        const geocode = async (place: string) => {
          const res = await fetch(
            `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(
              place
            )}`
          );
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            return data.features[0].geometry.coordinates.reverse(); // [lat, lng]
          }
          throw new Error(`Could not geocode ${place}`);
        };

        const startCoord = await geocode(start);
        const pickupCoord = await geocode(pickup);
        const dropCoord = await geocode(drop);

        // Request ORS route
        const body = {
          coordinates: [
            [startCoord[1], startCoord[0]], // [lng, lat]
            [pickupCoord[1], pickupCoord[0]],
            [dropCoord[1], dropCoord[0]],
          ],
        };

        const routeRes = await fetch(
          `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: ORS_API_KEY,
            },
            body: JSON.stringify(body),
          }
        );

        const routeData = await routeRes.json();

        // Draw route
        const routeLine = L.geoJSON(routeData, {
          style: { color: "blue", weight: 5, opacity: 0.7 },
        }).addTo(mapRef.current!);

        mapRef.current!.fitBounds(routeLine.getBounds());

        // Add markers
        L.marker(startCoord).addTo(mapRef.current!).bindPopup("Start");
        L.marker(pickupCoord).addTo(mapRef.current!).bindPopup("Pickup");
        L.marker(dropCoord).addTo(mapRef.current!).bindPopup("Dropoff");

        // Simulated movement marker
        const coords = routeData.features[0].geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]]
        ); // lat, lng

        let i = 0;
        const movingMarker = L.marker(coords[0], {
          icon: L.icon({
            iconUrl:
              "https://cdn-icons-png.flaticon.com/512/684/684908.png", // truck icon
            iconSize: [30, 30],
          }),
        }).addTo(mapRef.current!);

        const move = () => {
          if (i < coords.length) {
            movingMarker.setLatLng(coords[i]);
            i++;
            requestAnimationFrame(move);
          }
        };
        move();
      } catch (err) {
        console.error("Routing error:", err);
      }
    };

    fetchRoute();
  }, [start, pickup, drop]);

  return <div id="map" className="w-full h-full"></div>;
};

export default MapView;
