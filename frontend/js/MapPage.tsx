import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MapView from "./MapView";

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

const MapPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();

  const start = query.get("start") || "";
  const pickup = query.get("pickup") || "";
  const drop = query.get("drop") || "";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 bg-blue-700 text-white flex justify-between items-center">
        <h1 className="text-xl font-bold">Spotter Full Map</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-red-500 px-4 py-2 rounded hover:bg-red-600"
        >
          ← Back
        </button>
      </div>

      {/* Fullscreen Map */}
      <div className="flex-1">
        <MapView start={start} pickup={pickup} drop={drop} />
      </div>
    </div>
  );
};

export default MapPage;
