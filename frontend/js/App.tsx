import React, { useState, useEffect, useRef, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faSave } from '@fortawesome/free-solid-svg-icons';

const MAPBOX_TOKEN =
  'pk.eyJ1Ijoic21hcnQtam95IiwiYSI6ImNtZm00d3dyZTBheXkybHM3Zm13ODJhdjEifQ.3MWD8gt5gnRrXUfVr11Owg';

const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface GeocodeSuggestion {
  properties: { label: string };
  geometry: { coordinates: [number, number] }; // [lon, lat]
}

interface TripPlan {
  id: string;
  currentLocation: string;
  pickupLocation: string;
  dropoffLocation: string;
  currentCycleUsed: string;
  route: [number, number][]; // [lat, lon] for Leaflet
  stops: { name: string; location: string; details: string }[];
  totalMiles: number;
  dailyLogs: { type: string; hours: number }[][];
  timestamp: number;
}

const ensureLatLng = (coords: [number, number]) => L.latLng(coords[0], coords[1]);

// Geocoding: locations only (no POIs). Two-pass with proximity bias.
// Lower the minimum characters to 1 so suggestions show quickly.
const geocodeLocation = async (
  query: string,
  opts?: { proximity?: [number, number]; language?: string }
): Promise<GeocodeSuggestion[] | null> => {
  if (!query || query.trim().length < 1) return [];
  try {
    const baseParams = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: 'true',
      fuzzyMatch: 'true',
      limit: '15',
      language: opts?.language || 'en',
    });
    if (opts?.proximity) {
      const [lat, lon] = opts.proximity;
      baseParams.set('proximity', `${lon},${lat}`); // Mapbox expects lon,lat
    }

    // Valid Mapbox location types (no POIs)
    const locationTypes =
      'address,place,locality,neighborhood,district,region,country,postcode';

    // Pass 1: targeted location types
    const p1 = new URLSearchParams(baseParams);
    p1.set('types', locationTypes);
    let url = `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(query)}.json?${p1.toString()}`;
    let res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    let data = await res.json();
    let features: any[] = (data.features || []).filter(
      (f: any) => !(f.place_type || []).some((t: string) => t.startsWith('poi'))
    );

    // Pass 2: broader (no explicit types) but still filter out POIs and keep only location types
    if (!features.length) {
      const p2 = new URLSearchParams(baseParams);
      p2.set('limit', '20');
      url = `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(query)}.json?${p2.toString()}`;
      res = await fetch(url);
      if (res.ok) {
        data = await res.json();
        features = (data.features || []).filter((f: any) => {
          const types: string[] = f.place_type || [];
          const isPoi = types.some((t) => t.startsWith('poi'));
          const isLocation = types.some((t) =>
            ['address', 'place', 'locality', 'neighborhood', 'district', 'region', 'country', 'postcode'].includes(t)
          );
          return !isPoi && isLocation;
        });
      }
    }

    return features.map((f: any) => ({
      properties: { label: f.place_name },
      geometry: { coordinates: f.geometry.coordinates as [number, number] }, // [lon, lat]
    }));
  } catch (e) {
    console.error('Geocoding error:', e);
    return [];
  }
};

// Routing (validates coords, overview=full, steps=true)
const fetchRoute = async (start: [number, number], end: [number, number]) => {
  try {
    const valid =
      Array.isArray(start) &&
      Array.isArray(end) &&
      start.length === 2 &&
      end.length === 2 &&
      !isNaN(start[0]) &&
      !isNaN(start[1]) &&
      !isNaN(end[0]) &&
      !isNaN(end[1]);
    if (!valid) throw new Error('Invalid coordinates provided');

    // Mapbox expects lon,lat
    const coordsStr = `${start[1]},${start[0]};${end[1]},${end[0]}`;
    const url = `${MAPBOX_DIRECTIONS_URL}/${coordsStr}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Route calculation failed: ${res.status}`);
    const data = await res.json();

    if (!data.routes?.[0]?.geometry?.coordinates?.length) return null;

    const route = data.routes[0];
    const totalMiles = Math.round(route.distance / 1609.34);
    // Convert [lon,lat] -> [lat,lon] for Leaflet
    const routeCoordinates = route.geometry.coordinates.map(
      (c: number[]) => [c[1], c[0]] as [number, number]
    );

    return { routeCoordinates, totalMiles };
  } catch (e) {
    console.error('Route fetching error:', e);
    return null;
  }
};

export const App = () => {
  // Inputs
  const [currentLocation, setCurrentLocation] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [currentCycleUsed, setCurrentCycleUsed] = useState('');
  // Expand/collapse logs
  const [expandLogs, setExpandLogs] = useState(false);

  // Validation / UI
  const [validationError, setValidationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<'form' | 'history' | 'map' | 'log'>('form');

  // Coordinates (lat, lon)
  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);

  // Suggestions
  const [currentSuggestions, setCurrentSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [pickupSuggestions, setPickupSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<GeocodeSuggestion[]>([]);

  // Trip data
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripHistory, setTripHistory] = useState<TripPlan[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [tripToDeleteId, setTripToDeleteId] = useState<string | null>(null);

  // Timers
  const currentTimer = useRef<TimeoutRef>(null);
  const pickupTimer = useRef<TimeoutRef>(null);
  const dropoffTimer = useRef<TimeoutRef>(null);

  // Maps
  const miniMapRef = useRef<L.Map | null>(null);
  const fullMapRef = useRef<L.Map | null>(null);
  const miniLayerRef = useRef<L.LayerGroup | null>(null);
  const fullLayerRef = useRef<L.LayerGroup | null>(null);

  // Use browser geolocation to bias suggestions like Google Maps
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => void 0,
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  // Load history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('spotterTripHistory');
      if (stored) {
        const parsed: TripPlan[] = JSON.parse(stored);
        setTripHistory(parsed.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (e) {
      console.error('Failed to parse trip history', e);
    }
  }, []);

  // Navigate by header links (Home/#, #trips, #reports)
  useEffect(() => {
    const apply = () => {
      switch (window.location.hash) {
        case '#trips':
          setCurrentPage('history');
          break;
        case '#reports':
          setCurrentPage('log');
          break;
        default:
          setCurrentPage('form');
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const clearTimer = (ref: React.MutableRefObject<TimeoutRef>) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = null;
  };

  // Input handler with proximity bias (min length now 1)
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>,
    setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>,
    timerRef: React.MutableRefObject<TimeoutRef>,
    proximity?: [number, number]
  ) => {
    const value = e.target.value;
    setInput(value);
    setCoords(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value || value.trim().length < 1) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const suggestions = (await geocodeLocation(value, {
        proximity,
        language: 'en',
      })) as GeocodeSuggestion[];
      setSuggestions(suggestions || []);
      // If only one confident suggestion, auto-select its coords
      if (suggestions && suggestions.length === 1) {
        const [lon, lat] = suggestions[0].geometry.coordinates;
        setCoords([lat, lon]);
      }
    }, 250);
  };

  // Accept first suggestion with Enter for quick UX
  const acceptFirstSuggestion = (
    suggestions: GeocodeSuggestion[],
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>,
    setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>
  ) => {
    if (!suggestions || suggestions.length === 0) return;
    const s = suggestions[0];
    setInput(s.properties.label);
    const [lon, lat] = s.geometry.coordinates;
    setCoords([lat, lon]);
    setSuggestions([]);
  };

  // On blur: auto-pick best location if user didn’t click a suggestion
  async function handleInputBlur(
    value: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>,
    setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>,
    proximity?: [number, number]
  ) {
    if (!value || value.trim().length < 1) return;
    const suggestions = (await geocodeLocation(value, {
      proximity,
      language: 'en',
    })) as GeocodeSuggestion[];
    if (suggestions && suggestions.length > 0) {
      const best = suggestions[0];
      setInput(best.properties.label);
      const [lon, lat] = best.geometry.coordinates;
      setCoords([lat, lon]);
      setSuggestions([]);
    }
  }

  // Handle suggestion click: set input, coords, and clear suggestions
  function handleSuggestionClick(
    suggestion: GeocodeSuggestion,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>,
    setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>
  ) {
    setInput(suggestion.properties.label);
    const [lon, lat] = suggestion.geometry.coordinates;
    setCoords([lat, lon]);
    setSuggestions([]);
  }

  // Choose best suggestion (Mapbox already ranks; prefer more specific types)
  const pickBestLocation = (items: GeocodeSuggestion[] = []) => items[0] || null;

  // Resolve coords if user typed names but didn’t pick from the list
  const resolveCoordsIfMissing = async () => {
    try {
      const result: {
        current: [number, number] | null;
        pickup: [number, number] | null;
        dropoff: [number, number] | null;
      } = { current: currentCoords, pickup: pickupCoords, dropoff: dropoffCoords };

      const needs = [
        { key: 'current' as const, text: currentLocation },
        { key: 'pickup' as const, text: pickupLocation },
        { key: 'dropoff' as const, text: dropoffLocation },
      ];

      for (const n of needs) {
        if (!result[n.key] && n.text) {
          const s = (await geocodeLocation(n.text, {
            proximity: userPosition || undefined,
            language: 'en',
          })) as GeocodeSuggestion[];
          const best = pickBestLocation(s || []);
          if (best) {
            const [lon, lat] = best.geometry.coordinates;
            result[n.key] = [lat, lon];
          }
        }
      }

      return result;
    } catch {
      return { current: null, pickup: null, dropoff: null };
    }
  };

  // Trip calculation and routing
  const handleCalculateTrip = async () => {
    setValidationError('');
    setIsLoading(true);
    try {
      const resolved = await resolveCoordsIfMissing();

      if (!resolved.current || !resolved.pickup || !resolved.dropoff) {
        setValidationError('Please enter valid locations (address, city, state, or country).');
        setIsLoading(false);
        return;
      }

      // Persist resolved coords
      setCurrentCoords(resolved.current);
      setPickupCoords(resolved.pickup);
      setDropoffCoords(resolved.dropoff);

      // Routing: current -> pickup -> dropoff
      const r1 = await fetchRoute(resolved.current, resolved.pickup);
      const r2 = await fetchRoute(resolved.pickup, resolved.dropoff);

      if (!r1 || !r2) {
        setValidationError(
          'No drivable route found between these locations. Try locations connected by road.'
        );
        setIsLoading(false);
        return;
      }

      // Merge routes
      const fullRoute = r1.routeCoordinates.concat(r2.routeCoordinates.slice(1));
      const totalMiles = r1.totalMiles + r2.totalMiles;

      // Build realistic stops and daily logs (70hrs/8days, fuel every 1000mi, 1h pickup/dropoff)
      const { stops, dailyLogs } = buildStopsAndLogs(
        fullRoute,
        totalMiles,
        pickupLocation,
        dropoffLocation
      );

      const plan: TripPlan = {
        id: crypto.randomUUID(),
        currentLocation,
        pickupLocation,
        dropoffLocation,
        currentCycleUsed,
        route: fullRoute,
        stops, // includes rest/fuel with approximate coords
        totalMiles,
        dailyLogs,
        timestamp: Date.now(),
      };

      setTripPlan(plan);
    } catch (e) {
      console.error('Route fetching error:', e);
      setValidationError('Failed to calculate route. An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!tripPlan) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    doc.setFillColor('#2563eb');
    doc.rect(40, 30, 515, 50, 'F');
    doc.setTextColor('#fff');
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Spotter App', 55, 65);
    doc.setFontSize(14);
    doc.text('Trip Plan & ELD Log Report', 400, 55);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 400, 75);
    doc.setTextColor('#000');

    let y = 100;
    doc.setDrawColor('#2563eb');
    doc.setLineWidth(1.2);
    doc.roundedRect(50, y, 495, 70, 8, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Trip Summary', 60, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Start:  ${tripPlan.currentLocation}`, 60, y + 36);
    doc.text(`Pickup: ${tripPlan.pickupLocation}`, 60, y + 50);
    doc.text(`Dropoff: ${tripPlan.dropoffLocation}`, 60, y + 64);
    doc.text(`Total Miles: ${tripPlan.totalMiles}`, 350, y + 36);
    doc.text(`Days: ${tripPlan.dailyLogs.length}`, 350, y + 50);
    doc.text(`Stops: ${tripPlan.stops.length}`, 350, y + 64);
    y += 90;

    const mapElem = document.getElementById('mini-map-container');
    if (mapElem) {
      try {
        const canvas = await html2canvas(mapElem, { backgroundColor: null });
        const imgData = canvas.toDataURL('image/png');
        doc.setDrawColor('#2563eb');
        doc.roundedRect(50, y, 300, 120, 8, 8);
        doc.addImage(imgData, 'PNG', 55, y + 5, 290, 110);
      } catch {}
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor('#2563eb');
    doc.text('Route map with stops and rests', 60, y + 125);
    doc.setTextColor('#000');

    doc.save('drivers_daily_log.pdf');
  };

  // ELD preview PDF (uses first day SVG preview)
  const handleDownloadELDPreview = async () => {
    if (!tripPlan) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    doc.setFillColor('#2563eb'); doc.rect(40, 30, 515, 50, 'F');
    doc.setTextColor('#fff'); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('ELD Logs Preview', 55, 62); doc.setTextColor('#000');

    let y = 100;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Trip', 50, y);
    doc.setFont('helvetica', 'normal'); y += 18;
    doc.text(`Start: ${tripPlan.currentLocation}`, 50, y); y += 16;
    doc.text(`Pickup: ${tripPlan.pickupLocation}`, 50, y); y += 16;
    doc.text(`Dropoff: ${tripPlan.dropoffLocation}`, 50, y); y += 16;
    doc.text(`Total Miles: ${tripPlan.totalMiles}`, 50, y); y += 24;

    const preview = document.getElementById('eld-preview-0');
    if (preview) {
      const canvas = await html2canvas(preview as HTMLElement, { backgroundColor: '#ffffff', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 50, y, 500, 220);
      y += 230;
    }

    doc.setFont('helvetica', 'bold'); doc.text('Daily Summary', 50, y); y += 16;
    doc.setFont('helvetica', 'normal');
    tripPlan.dailyLogs.forEach((day, idx) => {
      const total = Math.round(day.reduce((a, b) => a + b.hours, 0) * 100) / 100;
      doc.text(`Day ${idx + 1}: ${day.map(d => `${d.type} ${d.hours}h`).join(' | ')} (Total ${total}h)`, 50, y);
      y += 14;
    });

    doc.save('eld_logs_preview.pdf');
  };

  // React <-> header integration: handle View/Delete events from header
  useEffect(() => {
    const onView = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      try {
        const all: TripPlan[] = JSON.parse(localStorage.getItem('spotterTripHistory') || '[]');
        const t = all.find(x => x.id === id);
        if (t) {
          setTripPlan(t);
          setCurrentPage('form');
        }
      } catch {}
    };
    const onDelete = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      const all: TripPlan[] = JSON.parse(localStorage.getItem('spotterTripHistory') || '[]');
      const newHistory = all.filter(t => t.id !== id);
      localStorage.setItem('spotterTripHistory', JSON.stringify(newHistory));
      setTripHistory(newHistory);
      window.dispatchEvent(new CustomEvent('spotter:refreshTripsHeader'));
    };
    window.addEventListener('spotter:viewTrip', onView as EventListener);
    window.addEventListener('spotter:deleteTrip', onDelete as EventListener);
    return () => {
      window.removeEventListener('spotter:viewTrip', onView as EventListener);
      window.removeEventListener('spotter:deleteTrip', onDelete as EventListener);
    };
  }, []);

  // After saving/deleting a trip, refresh the header menu
  const handleSaveTrip = () => {
    if (!tripPlan) {
      setValidationError('No trip plan to save. Please calculate a trip first.');
      return;
    }
    const newHistory = [...tripHistory, { ...tripPlan, id: crypto.randomUUID() }];
    localStorage.setItem('spotterTripHistory', JSON.stringify(newHistory));
    setTripHistory(newHistory);
    setValidationError('Trip saved locally!');
    window.dispatchEvent(new CustomEvent('spotter:refreshTripsHeader'));
  };

  const handleDeleteTrip = () => {
    if (!tripToDeleteId) return;
    const newHistory = tripHistory.filter((t) => t.id !== tripToDeleteId);
    localStorage.setItem('spotterTripHistory', JSON.stringify(newHistory));
    setTripHistory(newHistory);
    setIsConfirmModalOpen(false);
    setTripToDeleteId(null);
    window.dispatchEvent(new CustomEvent('spotter:refreshTripsHeader'));
  };

  // Mini map
  useEffect(() => {
    if (tripPlan && tripPlan.route?.length) {
      setTimeout(
        () => drawRoute(miniMapRef, miniLayerRef, 'mini-map-container', tripPlan.route, tripPlan.stops as any),
        0
      );
    }
  }, [tripPlan]);

  // Full map
  useEffect(() => {
    if (currentPage === 'map' && tripPlan?.route?.length) {
      setTimeout(
        () => drawRoute(fullMapRef, fullLayerRef, 'full-map-container', tripPlan.route, tripPlan.stops as any),
        0
      );
    }
  }, [currentPage, tripPlan]);

  const renderFormPage = () => (
    <div className="flex flex-col lg:flex-row justify-center items-stretch space-y-8 lg:space-y-0 lg:space-x-8 p-4 lg:p-12 w-full max-w-7xl mx-auto">
      <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl border border-gray-200 transition-all duration-400 hover:transform hover:-translate-y-1 hover:shadow-2xl p-8 w-full lg:w-1/2 flex flex-col space-y-6">
        <p className="text-center text-gray-600 mb-6">
          Input your trip details to get a professional route and ELD log plan.
        </p>
        <div className="space-y-4">
          <div className="relative">
            <label htmlFor="currentLocation" className="block text-sm font-medium text-gray-700">
              Current Location
            </label>
            <input
              type="text"
              id="currentLocation"
              value={currentLocation}
              onChange={(e) =>
                handleInputChange(
                  e,
                  setCurrentLocation,
                  setCurrentCoords,
                  setCurrentSuggestions,
                  currentTimer,
                  userPosition || undefined
                )
              }
              onBlur={() =>
                handleInputBlur(
                  currentLocation,
                  setCurrentLocation,
                  setCurrentCoords,
                  setCurrentSuggestions,
                  userPosition || undefined
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  acceptFirstSuggestion(
                    currentSuggestions,
                    setCurrentLocation,
                    setCurrentCoords,
                    setCurrentSuggestions
                  );
                }
              }}
              placeholder="e.g., Chicago, IL"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black"
            />
            {currentSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                {currentSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="p-2 cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() =>
                      handleSuggestionClick(
                        s,
                        setCurrentLocation,
                        setCurrentCoords,
                        setCurrentSuggestions
                      )
                    }
                  >
                    {s.properties.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative">
            <label htmlFor="pickupLocation" className="block text-sm font-medium text-gray-700">
              Pickup Location
            </label>
            <input
              type="text"
              id="pickupLocation"
              value={pickupLocation}
              onChange={(e) =>
                handleInputChange(
                  e,
                  setPickupLocation,
                  setPickupCoords,
                  setPickupSuggestions,
                  pickupTimer,
                  currentCoords || userPosition || undefined
                )
              }
              onBlur={() =>
                handleInputBlur(
                  pickupLocation,
                  setPickupLocation,
                  setPickupCoords,
                  setPickupSuggestions,
                  currentCoords || userPosition || undefined
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  acceptFirstSuggestion(pickupSuggestions, setPickupLocation, setPickupCoords, setPickupSuggestions);
                }
              }}
              placeholder="e.g., Dallas, TX"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black"
            />
            {pickupSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                {pickupSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="p-2 cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() =>
                      handleSuggestionClick(s, setPickupLocation, setPickupCoords, setPickupSuggestions)
                    }
                  >
                    {s.properties.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative">
            <label htmlFor="dropoffLocation" className="block text-sm font-medium text-gray-700">
              Dropoff Location
            </label>
            <input
              type="text"
              id="dropoffLocation"
              value={dropoffLocation}
              onChange={(e) =>
                handleInputChange(
                  e,
                  setDropoffLocation,
                  setDropoffCoords,
                  setDropoffSuggestions,
                  dropoffTimer,
                  pickupCoords || currentCoords || userPosition || undefined
                )
              }
              onBlur={() =>
                handleInputBlur(
                  dropoffLocation,
                  setDropoffLocation,
                  setDropoffCoords,
                  setDropoffSuggestions,
                  pickupCoords || currentCoords || userPosition || undefined
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  acceptFirstSuggestion(dropoffSuggestions, setDropoffLocation, setDropoffCoords, setDropoffSuggestions);
                }
              }}
              placeholder="e.g., New York, NY"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black"
            />
            {dropoffSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                {dropoffSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="p-2 cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() =>
                      handleSuggestionClick(s, setDropoffLocation, setDropoffCoords, setDropoffSuggestions)
                    }
                  >
                    {s.properties.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="currentCycleUsed" className="block text-sm font-medium text-gray-700">
              Current Cycle Used (Hrs)
            </label>
            <input
              type="number"
              id="currentCycleUsed"
              value={currentCycleUsed}
              onChange={(e) => setCurrentCycleUsed(e.target.value)}
              placeholder="e.g., 25"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black"
            />
          </div>
        </div>

        {validationError && <p className="text-red-500 text-sm mt-2 text-center">{validationError}</p>}

        <button
          onClick={handleCalculateTrip}
          disabled={isLoading}
          className="w-full mt-6 py-3 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-2 border-white"></div>
              <span>Calculating...</span>
            </div>
          ) : (
            'Calculate Trip'
          )}
        </button>
      </div>

      <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl border border-gray-200 transition-all duration-400 hover:transform hover:-translate-y-1 hover:shadow-2xl w-full lg:w-1/2 p-8 flex flex-col space-y-6">
        {!tripPlan && !isLoading && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <p className="text-lg text-gray-500">
              Enter your trip details on the left and click "Calculate Trip" to generate your route
              and ELD logs.
            </p>
          </div>
        )}

        {tripPlan && (
          <Fragment>
            <h2 className="text-2xl font-bold text-center text-blue-800">Trip Plan Output</h2>

            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-blue-700">Route Map</h3>
                <div className="space-x-3">
                  <button
                    onClick={handleSaveTrip}
                    className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faSave} />
                    <span>Save Trip</span>
                  </button>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-1 mb-3">
                Optimized route showing pickup, dropoff, and rest stops.
              </p>

              {/* Map preview with an internal overlay Download button */}
              <div className="relative">
                <div
                  id="mini-map-container"
                  className="w-full h-64 bg-gray-100 rounded-lg cursor-pointer"
                  onClick={() => tripPlan && setCurrentPage('map')}
                ></div>
                <button
                  onClick={handleDownload}
                  className="absolute top-2 right-2 py-2 px-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm shadow"
                  title="Download route preview PDF"
                >
                  <FontAwesomeIcon icon={faDownload} /> Download
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-2 italic">Click the map to enlarge.</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-blue-700">ELD Daily Logs</h3>
              </div>
              <p className="text-gray-500 text-sm mt-1 mb-3">
                Daily log sheets with filled-out hours of service.
              </p>

              {tripPlan ? (
                <div>
                  {/* Preview card (Day 1) with overlay Download button */}
                  <div
                    className="relative border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                    onClick={() => setExpandLogs((v) => !v)}
                    title="Click to expand/collapse list of logs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-700">Preview • Day 1 Log</span>
                      <span className="text-sm text-gray-500">{expandLogs ? 'Hide list' : 'Show list'}</span>
                    </div>
                    <div id="eld-preview-0" className="overflow-x-auto">
                      <ELDChart dayIndex={0} segments={tripPlan.dailyLogs[0]} />
                    </div>

                    {/* Internal Download button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadELDPreview(); }}
                      className="absolute top-2 right-2 py-1.5 px-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm shadow"
                      title="Download ELD preview PDF"
                    >
                      <FontAwesomeIcon icon={faDownload} /> Download
                    </button>
                  </div>

                  {/* Expandable list of day logs */}
                  {expandLogs && (
                    <div className="mt-4 space-y-2">
                      {tripPlan.dailyLogs.map((_, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={() => setCurrentPage('log')}
                        >
                          <span className="font-semibold text-gray-700">Day {index + 1} Log</span>
                          <span className="text-sm text-gray-500">Click to view details</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">No trip yet. Calculate a trip to see ELD logs.</div>
              )}
            </div>
          </Fragment>
        )}
      </div>
    </div>
  );

  const renderHistoryPage = () => (
    <div className="flex flex-col items-center p-4 lg:p-12 w-full max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">Trip History</h2>
      {tripHistory.length === 0 ? (
        <p className="text-lg text-gray-500">No trips saved yet. Go back and calculate one!</p>
      ) : (
        <div className="space-y-4 w-full">
          {tripHistory.map((trip) => (
            <div
              key={trip.id}
              className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-xl p-6 border border-gray-200 flex justify-between items-center"
            >
              <div>
                <h3 className="text-xl font-bold text-blue-700">
                  Trip from {trip.currentLocation} to {trip.dropoffLocation}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Saved on {new Date(trip.timestamp).toLocaleDateString()}</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setTripPlan(trip);
                    setCurrentPage('form');
                  }}
                  className="py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  View
                </button>
                <button
                  onClick={() => confirmDeleteTrip(trip.id)}
                  className="py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMapPage = () => (
    <div className="p-4 lg:p-12 w-full max-w-7-7xl mx-auto">
      <button
        onClick={() => setCurrentPage('form')}
        className="mb-6 py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        &larr; Back to Trip
      </button>
      <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl p-8 border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-6">Detailed Route Map</h2>
        <p className="text-lg text-center text-gray-600 mb-4">
          Route from {tripPlan?.pickupLocation} to {tripPlan?.dropoffLocation}
        </p>
        <div id="full-map-container" className="w-full h-[600px] rounded-xl overflow-hidden mb-8"></div>

        {tripPlan && (
          <div className="mt-8 bg-blue-50 rounded-xl p-6 shadow-inner border border-blue-100">
            <h3 className="text-2xl font-bold text-blue-700 mb-4">Trip Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <span className="font-semibold text-gray-700">Start:</span> {tripPlan.currentLocation}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Pickup:</span> {tripPlan.pickupLocation}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Dropoff:</span> {tripPlan.dropoffLocation}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Total Miles:</span> {tripPlan.totalMiles}
              </div>
            </div>
            <div className="mb-4">
              <span className="font-semibold text-gray-700">Stops & Activities:</span>
              <ul className="list-disc list-inside mt-2 text-gray-800">
                {tripPlan.stops.map((s, i) => (
                  <li key={i} className="mb-1">
                    <span className="font-semibold">{s.name}:</span> {s.location}{' '}
                    <span className="text-gray-500">({s.details})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Simple ELD line-graph (24h x 4 rows)
  const ELDChart: React.FC<{ id?: string; dayIndex: number; segments: { type: string; hours: number }[] }> = ({
    id, dayIndex, segments,
  }) => {
    const width = 720, height = 200, left = 60, right = 10, top = 24, rowGap = 40;
    const rows = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (not driving)'];
    const rowIndex = (t: string) =>
      t.toLowerCase().startsWith('off') ? 0 :
      t.toLowerCase().startsWith('sleep') ? 1 :
      t.toLowerCase().startsWith('driv') ? 2 : 3;
    const rowY = (r: number) => top + r * rowGap;
    const usableW = width - left - right;

    // Build polyline segments for the day timeline
    const points: { x: number; y: number }[] = [];
    let hourCursor = 0;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const pushPoint = (h: number, r: number) => {
      const x = left + clamp(h, 0, 24) / 24 * usableW;
      const y = rowY(r);
      points.push({ x, y });
    };
    segments.forEach((seg, i) => {
      const r = rowIndex(seg.type);
      // start point
      if (i === 0) pushPoint(hourCursor, r);
      // vertical to new row (if changed)
      const last = points[points.length - 1];
      if (last && Math.abs(last.y - rowY(r)) > 0.1) points.push({ x: last.x, y: rowY(r) });
      // horizontal for duration
      hourCursor += seg.hours;
      pushPoint(hourCursor, r);
    });
    // pad to 24h on last row if needed
    if (hourCursor < 24 && points.length) {
      const lastRow = rows.findIndex((_, idx) => Math.abs(points[points.length - 1].y - rowY(idx)) < 0.1);
      pushPoint(24, lastRow >= 0 ? lastRow : 0);
    }

    return (
      <svg id={id} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x={left} y={14} fontSize="12" fill="#1f2937" fontWeight="bold">Day {dayIndex + 1} — ELD</text>
        {/* grid rows */}
        {rows.map((r, i) => (
          <g key={r}>
            <text x={8} y={rowY(i) + 4} fontSize="10" fill="#374151">{r}</text>
            <line x1={left} y1={rowY(i)} x2={width - right} y2={rowY(i)} stroke="#cbd5e1" />
          </g>
        ))}
        {/* hour grid */}
        {Array.from({ length: 25 }).map((_, h) => {
          const x = left + (h / 24) * usableW;
          return (
            <g key={`h-${h}`}>
              <line x1={x} y1={top - 8} x2={x} y2={rowY(3) + 8} stroke="#e5e7eb" />
              {h % 2 === 0 && <text x={x - 5} y={rowY(3) + 18} fontSize="9" fill="#6b7280">{h}</text>}
            </g>
          );
        })}
        {/* polyline */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  };

  // Download a single-day ELD chart
  const handleDownloadLogDay = async (dayIndex: number) => {
    const elem = document.getElementById(`eld-chart-day-${dayIndex}`);
    if (!tripPlan || !elem) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.setFillColor('#2563eb'); doc.rect(40, 30, 515, 50, 'F');
    doc.setTextColor('#fff'); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text(`ELD Log • Day ${dayIndex + 1}`, 55, 62); doc.setTextColor('#000');
    let y = 100;
    doc.text(`Trip: ${tripPlan.currentLocation} → ${tripPlan.dropoffLocation}`, 50, y);
    y += 12;
    const canvas = await html2canvas(elem as HTMLElement, { backgroundColor: '#ffffff', scale: 2 });
    const img = canvas.toDataURL('image/png');
    doc.addImage(img, 'PNG', 50, y + 10, 500, 220);
    doc.save(`eld_day_${dayIndex + 1}.pdf`);
  };

  const renderLogPage = () => (
    <div className="p-4 lg:p-12 w-full max-w-7xl mx-auto">
      <button
        onClick={() => setCurrentPage('form')}
        className="mb-6 py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        ← Back to Trip
      </button>
      <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl p-8 border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-2">Daily ELD Logs</h2>
        <p className="text-lg text-center text-gray-600 mb-6">
          Logs for trip from {tripPlan?.currentLocation} to {tripPlan?.dropoffLocation}
        </p>

        {tripPlan?.dailyLogs?.map((day, i) => (
          <div key={i} className="relative bg-gray-50 border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-800">Day {i + 1}</span>
              <button
                onClick={() => handleDownloadLogDay(i)}
                className="py-1.5 px-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm shadow"
                title="Download this day's ELD chart"
              >
                <i className="fa fa-download mr-1" /> Download
              </button>
            </div>
            <div id={`eld-chart-day-${i}`} className="overflow-x-auto">
              <ELDChart dayIndex={i} segments={day} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Confirm delete helper (used in history list)
  const confirmDeleteTrip = (id: string) => {
    setTripToDeleteId(id);
    setIsConfirmModalOpen(true);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'form':
        return renderFormPage();
      case 'history':
        return renderHistoryPage();
      case 'map':
        return renderMapPage();
      case 'log':
        return renderLogPage();
      default:
        return renderFormPage();
    }
  };

  return (
    <div className="bg-radial-gradient flex flex-col min-h-screen font-inter">
      {renderContent()}

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[1000]">
          <div className="bg-white p-8 rounded-2xl relative w-11/12 max-w-md flex flex-col items-center text-center">
            <h3 className="text-2xl font-bold mb-4 text-blue-800">Confirm Deletion</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this trip from your history? This action cannot be
              undone.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleDeleteTrip}
                className="py-2 px-6 rounded-md text-white font-bold bg-red-500 hover:bg-red-600 transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="py-2 px-6 rounded-md text-white font-bold bg-gray-500 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  console.error("Root element with id 'root' not found.");
}

// Replace the stubbed helpers below with working implementations

// filepath: c:\Users\user\Desktop\spotter\spotter_app\frontend\js\App.tsx
// IMPLEMENT buildStopsAndLogs (returns stops with optional coords/kind + daily logs)
function buildStopsAndLogs(
  fullRoute: [number, number][],
  totalMiles: number,
  pickupLocation: string,
  dropoffLocation: string
): { stops: { name: string; location: string; details: string; coords?: [number, number]; kind?: string }[]; dailyLogs: { type: string; hours: number }[][] } {
  // Haversine helpers
  const toRad = (d: number) => (d * Math.PI) / 180;
  const haversineMiles = (a: [number, number], b: [number, number]) => {
    const R = 3958.761;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const la1 = toRad(a[0]);
    const la2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const cumMiles: number[] = [0];
  for (let i = 1; i < fullRoute.length; i++) cumMiles.push(cumMiles[i - 1] + haversineMiles(fullRoute[i - 1], fullRoute[i]));
  const coordAtMile = (mile: number): [number, number] | undefined => {
    if (!fullRoute.length) return undefined;
    if (mile <= 0) return fullRoute[0];
    const total = cumMiles[cumMiles.length - 1];
    if (mile >= total) return fullRoute[fullRoute.length - 1];
    let i = 1;
    while (i < cumMiles.length && cumMiles[i] < mile) i++;
    const prev = i - 1;
    const seg = cumMiles[i] - cumMiles[prev] || 1;
    const t = (mile - cumMiles[prev]) / seg;
    const [la1, lo1] = fullRoute[prev];
    const [la2, lo2] = fullRoute[i];
    return [la1 + (la2 - la1) * t, lo1 + (lo2 - lo1) * t];
  };

  // Planning assumptions
  const mph = 55;
  const dayMaxDrive = 11; // hrs/day
  const breakAfter = 8;   // hrs -> 30-min break
  const restHours = 10;   // off-duty daily
  const fuelEvery = 1000; // miles

  const totalDriveHours = totalMiles / mph;
  const days = Math.ceil(totalDriveHours / dayMaxDrive);

  const dailyLogs: { type: string; hours: number }[][] = [];
  const stops: { name: string; location: string; details: string; coords?: [number, number]; kind?: string }[] = [
    { name: 'Pickup', location: pickupLocation, details: '1 hour for pickup', coords: fullRoute[0], kind: 'pickup' },
  ];

  let drivenMiles = 0;
  let nextFuelAt = fuelEvery;

  for (let d = 0; d < days; d++) {
    const todayDrive = Math.min(dayMaxDrive, totalDriveHours - d * dayMaxDrive);
    const day: { type: string; hours: number }[] = [];
    let remaining = todayDrive;
    let sinceBreak = 0;

    while (remaining > 0) {
      const driveNow = Math.min(remaining, breakAfter - sinceBreak);
      if (driveNow > 0) {
        day.push({ type: 'Driving', hours: Math.round(driveNow * 100) / 100 });
        drivenMiles += driveNow * mph;
        sinceBreak += driveNow;
        remaining -= driveNow;

        if (drivenMiles >= nextFuelAt && drivenMiles < totalMiles) {
          const c = coordAtMile(nextFuelAt);
          stops.push({
            name: 'Fuel',
            location: `Fuel stop at mile ${Math.round(nextFuelAt)}`,
            details: '30 minutes fuel/check',
            coords: c,
            kind: 'fuel',
          });
          day.push({ type: 'On Duty (not driving)', hours: 0.5 });
          nextFuelAt += fuelEvery;
        }
      }
      if (remaining > 0 && sinceBreak >= breakAfter) {
        day.push({ type: 'Off Duty', hours: 0.5 });
        sinceBreak = 0;
      }
    }

    // End-of-day rest (except possibly the last if done)
    day.push({ type: 'Off Duty', hours: restHours });
    const endMile = Math.min(drivenMiles, totalMiles);
    const restCoord = coordAtMile(endMile);
    stops.push({
      name: `Rest Stop (Day ${d + 1})`,
      location: `End of driving day ${d + 1}`,
      details: `${restHours} hours off-duty`,
      coords: restCoord,
      kind: 'rest',
    });

    dailyLogs.push(day);
  }

  stops.push({
    name: 'Dropoff',
    location: dropoffLocation,
    details: '1 hour for drop-off',
    coords: fullRoute[fullRoute.length - 1],
    kind: 'dropoff',
  });

  return { stops, dailyLogs };
}

// Small helper to build a colored SVG pin as a data URL
function svgPin(fill: string, label: string) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M16 1 C8 1 2 7 2 15 c0 10 14 30 14 30 s14-20 14-30 C30 7 24 1 16 1z" fill="${fill}" stroke="#1f2937" stroke-width="1.2"/>
        <circle cx="16" cy="16" r="8" fill="#ffffff" />
        <text x="16" y="20" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#111827">${label}</text>
      </g>
    </svg>
  `);
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

function makeIcon(fill: string, label: string): L.Icon {
  return L.icon({
    iconUrl: svgPin(fill, label),
    iconSize: [32, 48],
    iconAnchor: [16, 44],
    popupAnchor: [0, -40],
    className: 'spotter-pin',
  });
}

const StopIcons = {
  start: makeIcon('#7c3aed', 'S'),
  pickup: makeIcon('#10b981', 'P'),
  rest: makeIcon('#f59e0b', 'R'),
  fuel: makeIcon('#0ea5e9', 'F'),
  dropoff: makeIcon('#ef4444', 'D'),
  generic: makeIcon('#3b82f6', '•'),
};

function fmtTs(ts?: string | number | Date) {
  if (!ts) return null;
  try {
    const d = typeof ts === 'string' || typeof ts === 'number' ? new Date(ts) : ts;
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch {
    return null;
  }
}

// Replace your existing drawRoute with this version
function drawRoute(
  mapRef: React.MutableRefObject<L.Map | null>,
  layerRef: React.MutableRefObject<L.LayerGroup | null>,
  containerId: string,
  route: [number, number][],
  stops?: { coords?: [number, number]; name?: string; location?: string; details?: string; ts?: string | number; timestamp?: string | number; kind?: 'rest' | 'fuel' | 'pickup' | 'dropoff' | 'start' }[]
): void {
  // Init the map once
  if (!mapRef.current) {
    const container = document.getElementById(containerId);
    if (!container) return;
    mapRef.current = L.map(containerId, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(mapRef.current);
  }

  // Ensure layer group
  if (!layerRef.current) {
    layerRef.current = L.layerGroup().addTo(mapRef.current);
  } else {
    layerRef.current.clearLayers();
  }

  if (!route || route.length < 2) return;

  // Route polyline
  L.polyline(route.map((c) => L.latLng(c[0], c[1])), { color: '#2563eb', weight: 4 }).addTo(layerRef.current);

  // Stop markers with custom icons and popups
  if (stops && stops.length) {
    stops.forEach((s, idx) => {
      const coords = s.coords || (idx === 0 ? route[0] : idx === stops.length - 1 ? route[route.length - 1] : undefined);
      if (!coords) return;

      // Choose icon by kind, fallback by position
      const kind = s.kind || (idx === 0 ? 'pickup' : idx === stops.length - 1 ? 'dropoff' : undefined);
      const icon =
        kind === 'pickup' ? StopIcons.pickup :
        kind === 'rest' ? StopIcons.rest :
        kind === 'fuel' ? StopIcons.fuel :
        kind === 'dropoff' ? StopIcons.dropoff :
        kind === 'start' ? StopIcons.start :
        StopIcons.generic;

      const when = fmtTs((s as any).ts || (s as any).time || (s as any).timestamp);
      const title = s.name || (kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Stop');
            const html = `
              <div style="min-width:220px">
                <div style="font-weight:700;margin-bottom:4px">${title}</div>
                ${s.location ? `<div><span style="color:#6b7280">Location:</span> ${s.location}</div>` : ''}
                ${when ? `<div><span style="color:#6b7280">When:</span> ${when}</div>` : ''}
              </div>
            `;
      
            L.marker([coords[0], coords[1]], { icon })
              .addTo(layerRef.current!)
              .bindPopup(html);
          });
        }
      
        // Fit bounds to route
        if (mapRef.current && route.length > 1) {
          const bounds = L.latLngBounds(route.map((c) => L.latLng(c[0], c[1])));
          mapRef.current.fitBounds(bounds, { padding: [30, 30] });
        }
      }

