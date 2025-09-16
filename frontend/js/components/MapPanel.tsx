// frontend/js/components/MapPanel.tsx
import React from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
} from "react-leaflet";

import type { TripResult } from "../api";

type Props = {
  result: TripResult | null;
};

export default function MapPanel({ result }: Props) {
  if (!result) {
    return (
      <div
        style={{
          height: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Plan a trip to see the map
      </div>
    );
  }

  // backend geometry: coordinates = [[lon, lat], ...]
  const coords: [number, number][] = result.geometry.coordinates.map((c) => [
    c[1],
    c[0],
  ]);
  const center = coords[Math.floor(coords.length / 3)] || coords[0] || [0, 0];

  return (
    <div style={{ height: 420 }}>
      <MapContainer
        center={center}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
        zoom={6}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={coords} />
        {result.fueling_stops.map((s) => (
          <CircleMarker
            key={`${s.lat},${s.lon}`}
            center={[s.lat, s.lon]}
            pathOptions={{ color: "#f39c12" }}
            radius={8}
          >
            <Popup>{s.note || "Fuel stop"}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
