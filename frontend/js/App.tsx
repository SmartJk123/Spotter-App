// ...existing code...
import React, { useState, useEffect, useRef, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';


// Mapbox public access token provided by user
const MAPBOX_TOKEN = "pk.eyJ1Ijoic21hcnQtam95IiwiYSI6ImNtZmxraGR1dDA1NDUyanM3bHk4aWxpMm4ifQ.2YbRJmP1WddvIZw9WHGLSA";

// Type definitions for geocoding suggestions
interface GeocodeSuggestion {
    properties: {
        label: string;
    };
    geometry: {
        coordinates: [number, number]; // [lon, lat]
    };
}

// Type for a trip plan to improve code clarity and type safety
interface TripPlan {
    id: string;
    currentLocation: string;
    pickupLocation: string;
    dropoffLocation: string;
    currentCycleUsed: string;
    route: [number, number][]; // Now an array of coordinates
    stops: { name: string; location: string; details: string; }[];
    totalMiles: number;
    dailyLogs: { type: string; hours: number; }[][];
    timestamp: number;
}

export const App = () => {
    // Calculate trip plan: geocode, fetch route, and set trip plan
    const handleCalculateTrip = async () => {
        setValidationError('');
        setIsLoading(true);
        try {
            if (!currentCoords || !pickupCoords || !dropoffCoords) {
                setValidationError('Please select all locations from suggestions.');
                setIsLoading(false);
                return;
            }
            // Fetch route from current to pickup, then pickup to dropoff
            const route1 = await fetchRoute(currentCoords, pickupCoords);
            const route2 = await fetchRoute(pickupCoords, dropoffCoords);
            if (!route1 || !route2) {
                setValidationError('Failed to calculate route. Please try a different location.');
                setIsLoading(false);
                return;
            }
            const fullRoute = route1.routeCoordinates.concat(route2.routeCoordinates.slice(1));
            const totalMiles = route1.totalMiles + route2.totalMiles;
            // Mock stops and daily logs for now
            const stops = [
                { name: 'Pickup', location: pickupLocation, details: '1 hour for pickup' },
                { name: 'Rest Stop', location: 'Memphis, TN', details: '10 hours off-duty rest' },
                { name: 'Dropoff', location: dropoffLocation, details: '1 hour for drop-off' }
            ];
            const dailyLogs = [
                [ { type: 'Driving', hours: 8 }, { type: 'Off Duty', hours: 2 }, { type: 'Driving', hours: 3 }, { type: 'Off Duty', hours: 11 } ],
                [ { type: 'Driving', hours: 8 }, { type: 'On Duty (not driving)', hours: 2 }, { type: 'Driving', hours: 3 }, { type: 'Off Duty', hours: 11 } ]
            ];
            const tripData: Omit<TripPlan, 'id'> = {
                currentLocation,
                pickupLocation,
                dropoffLocation,
                currentCycleUsed,
                route: fullRoute as [number, number][],
                stops,
                totalMiles,
                dailyLogs,
                timestamp: Date.now()
            };
            setTimeout(() => {
                setTripPlan({ ...tripData, id: crypto.randomUUID() });
                setIsLoading(false);
            }, 1000);
        } catch (error) {
            console.error('Route fetching error:', error);
            setValidationError('Failed to calculate route. An unexpected error occurred.');
            setIsLoading(false);
        }
    };
    const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

    const [currentLocation, setCurrentLocation] = useState<string>('');
    const [pickupLocation, setPickupLocation] = useState<string>('');
    const [dropoffLocation, setDropoffLocation] = useState<string>('');
    const [currentCycleUsed, setCurrentCycleUsed] = useState<string>('');
    const [validationError, setValidationError] = useState<string>('');
    const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<string>('form');
    const [tripHistory, setTripHistory] = useState<TripPlan[]>([]);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
    const [tripToDeleteId, setTripToDeleteId] = useState<string | null>(null);

    const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
    const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
    const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);

    const [currentSuggestions, setCurrentSuggestions] = useState<GeocodeSuggestion[]>([]);
    const [pickupSuggestions, setPickupSuggestions] = useState<GeocodeSuggestion[]>([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState<GeocodeSuggestion[]>([]);

    const mainMapRef = useRef<L.Map | null>(null);
    const currentTimer = useRef<NodeJS.Timeout | null>(null);
    const pickupTimer = useRef<NodeJS.Timeout | null>(null);
    const dropoffTimer = useRef<NodeJS.Timeout | null>(null);
    const mapMarkers = useRef<L.LayerGroup<any> | null>(null);

    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('spotterTripHistory');
            if (storedHistory) {
                const parsedHistory: TripPlan[] = JSON.parse(storedHistory);
                setTripHistory(parsedHistory.sort((a, b) => b.timestamp - a.timestamp));
            }
        } catch (e) {
            console.error("Failed to parse trip history from localStorage", e);
        }
    }, []);

    // Mapbox geocoding for global coverage
    const geocodeLocation = async (query: string): Promise<GeocodeSuggestion[] | null> => {
        if (!query) return null;
        try {
            const url = `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Geocoding failed with status: ${response.status}`);
            const data = await response.json();
            // Mapbox returns features with geometry.coordinates [lon, lat] and place_name
            return (data.features || []).map((f: any) => ({
                properties: { label: f.place_name },
                geometry: { coordinates: f.geometry.coordinates }
            }));
        } catch (error) {
            console.error("Geocoding error:", error);
            return null;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setInput: React.Dispatch<React.SetStateAction<string>>, setCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>, setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>, timerRef: React.MutableRefObject<NodeJS.Timeout | null>) => {
        const value = e.target.value;
        setInput(value);
        setCoords(null);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(async () => {
            const suggestions = await geocodeLocation(value);
            if (suggestions) {
                setSuggestions(suggestions);
            }
        }, 500);
    };

    const handleSuggestionClick = (suggestion: GeocodeSuggestion, setInput: React.Dispatch<React.SetStateAction<string>>, setCoords: React.Dispatch<React.SetStateAction<[number, number] | null>>, setSuggestions: React.Dispatch<React.SetStateAction<GeocodeSuggestion[]>>) => {
        setInput(suggestion.properties.label);
        setCoords([suggestion.geometry.coordinates[1], suggestion.geometry.coordinates[0]]);
        setSuggestions([]);
    };

    // Use Mapbox Directions API for routing
    const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
    const fetchRoute = async (startCoords: [number, number], endCoords: [number, number]) => {
        try {
            // Mapbox expects [lon,lat]; our coords are [lat,lon]
            const coordsStr = `${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}`;
            const url = `${MAPBOX_DIRECTIONS_URL}/${coordsStr}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Route calculation failed with status: ${response.status}`);
            const data = await response.json();
            if (data.routes && data.routes.length > 0 && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
                const route = data.routes[0];
                const totalDistanceInMiles = route.distance / 1609.34;
                return {
                    routeCoordinates: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][],
                    totalMiles: Math.round(totalDistanceInMiles),
                };
            }
            return null;

        } catch (error) {
            console.error("Route fetching error:", error);
            return null;
        }
    } // <-- end fetchRoute

    // PDF export logic
    const handleDownload = async () => {
        if (!tripPlan) return;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        // --- Spotter App Letterhead ---
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

        // --- Trip Summary Box ---
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

        // --- Map Snapshot (if available) ---
        const mapElem = document.getElementById('mini-map-container');
        if (mapElem) {
            try {
                const canvas = await html2canvas(mapElem, { backgroundColor: null });
                const imgData = canvas.toDataURL('image/png');
                doc.setDrawColor('#2563eb');
                doc.roundedRect(50, y, 300, 120, 8, 8);
                doc.addImage(imgData, 'PNG', 55, y + 5, 290, 110);
            } catch (e) {}
        }
        // Map info text
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor('#2563eb');
        doc.text('Route map with stops and rests', 60, y + 125);
        doc.setTextColor('#000');
        y += 140;

        // --- Daily Log Sheets (one per day) ---
        for (let d = 0; d < tripPlan.dailyLogs.length; d++) {
            if (d > 0) doc.addPage();
            let logY = d === 0 ? y : 100;
            // Header
            doc.setFillColor('#2563eb');
            doc.rect(40, logY, 515, 30, 'F');
            doc.setTextColor('#fff');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text('Drivers Daily Log', 55, logY + 22);
            doc.setFontSize(12);
            doc.text('Original - File at home terminal.', 400, logY + 18);
            doc.setTextColor('#000');

            // Info fields
            let fy = logY + 40;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text('From:', 55, fy);
            doc.text('To:', 200, fy);
            doc.text('Date:', 350, fy);
            doc.text('Driver Name:', 55, fy + 16);
            doc.text('Carrier:', 300, fy + 16);
            doc.text('Total Miles Driving Today:', 55, fy + 32);
            doc.text('Total Mileage Today:', 300, fy + 32);
            doc.text('Truck/Tractor and Trailer Numbers or License Plate(s):', 55, fy + 48);
            doc.text('Main Office Address:', 55, fy + 64);
            doc.text('Home Terminal Address:', 300, fy + 64);

            // Log grid
            let gridY = fy + 80;
            doc.setDrawColor('#2563eb');
            doc.setLineWidth(0.7);
            // Horizontal lines
            for (let i = 0; i <= 4; i++) {
                doc.line(55, gridY + i * 28, 540, gridY + i * 28);
            }
            // Vertical hour lines
            for (let i = 0; i <= 24; i++) {
                doc.line(55 + i * 20.2, gridY, 55 + i * 20.2, gridY + 112);
            }
            // Status labels
            const statusLabels = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (not driving)'];
            for (let i = 0; i < 4; i++) {
                doc.setFontSize(10);
                doc.text(statusLabels[i], 35, gridY + 18 + i * 28);
            }
            // Draw log lines (auto-filled)
            let hour = 0;
            for (let i = 0; i < tripPlan.dailyLogs[d].length; i++) {
                const seg = tripPlan.dailyLogs[d][i];
                const statusIdx = ['off', 'sleeper', 'driving', 'on duty (not driving)', 'on'].findIndex(s => seg.type.toLowerCase().includes(s));
                const x1 = 55 + hour * 20.2;
                const x2 = 55 + (hour + seg.hours) * 20.2;
                const y1 = gridY + 14 + statusIdx * 28;
                doc.setDrawColor(['#6b7280', '#a78bfa', '#2563eb', '#f59e42'][statusIdx] || '#000');
                doc.setLineWidth(3);
                doc.line(x1, y1, x2, y1);
                hour += seg.hours;
            }

            // Remarks and signature
            let afterGridY = gridY + 120;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Remarks:', 55, afterGridY);
            doc.setFont('helvetica', 'normal');
            doc.rect(110, afterGridY - 12, 400, 36);
            doc.text('Shipping Documents:', 55, afterGridY + 36);
            doc.text('Driver Signature:', 55, afterGridY + 52);
            doc.line(150, afterGridY + 52, 300, afterGridY + 52);

            // Footer
            doc.setFontSize(10);
            doc.setTextColor('#2563eb');
            doc.text('Spotter App - Plan your trip, stay compliant, drive safe!', 55, 800);
            doc.setTextColor('#000');
        }

        doc.save('drivers_daily_log.pdf');
    };


    const handleSaveTrip = () => {
        if (!tripPlan) {
            setValidationError('No trip plan to save. Please calculate a trip first.');
            return;
        }
        const newHistory = [...tripHistory, { ...tripPlan, id: crypto.randomUUID() }];
        localStorage.setItem('spotterTripHistory', JSON.stringify(newHistory));
        setTripHistory(newHistory);
        setValidationError('Trip saved locally!');
    };

    const confirmDeleteTrip = (id: string) => {
        setTripToDeleteId(id);
        setIsConfirmModalOpen(true);
    };

    const handleDeleteTrip = () => {
        if (!tripToDeleteId) return;
        const newHistory = tripHistory.filter(trip => trip.id !== tripToDeleteId);
        localStorage.setItem('spotterTripHistory', JSON.stringify(newHistory));
        setTripHistory(newHistory);
        setIsConfirmModalOpen(false);
        setTripToDeleteId(null);
    };



    const renderELDLog = (tripDay: number, schedule: { type: string; hours: number; }[]) => {
        const chartWidth = 600;
        const chartHeight = 200;
        const padding = { top: 20, right: 20, bottom: 30, left: 100 };
        const timeScale = chartWidth / 24;
        const statusMap: { [key: string]: number } = {
            'Off Duty': 0,
            'Sleeper Berth': 1,
            'Driving': 2,
            'On Duty (not driving)': 3
        };
        const statusLabels = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (not driving)'];
        const statusScale = (chartHeight - padding.top - padding.bottom) / (statusLabels.length - 1);

        let pathData = `M ${padding.left} ${chartHeight - padding.bottom - (statusMap[schedule[0]?.type] || 0) * statusScale}`;
        let cumulativeTime = 0;

        schedule.forEach((segment, index) => {
            const startX = padding.left + cumulativeTime * timeScale;
            const endX = padding.left + (cumulativeTime + segment.hours) * timeScale;
            const y = chartHeight - padding.bottom - (statusMap[segment.type] || 0) * statusScale;

            if (index > 0) {
                const prevY = chartHeight - padding.bottom - (statusMap[schedule[index - 1]?.type] || 0) * statusScale;
                pathData += ` V ${prevY} H ${startX} V ${y}`;
            }
            pathData += ` H ${endX}`;
            cumulativeTime += segment.hours;
        });

        return (
            <div key={tripDay} className="eld-container mt-4 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-4">
                <h4 className="text-md font-bold mb-2 text-gray-800">Day {tripDay + 1} Log</h4>
                <svg className="eld-chart w-full h-[200px]" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
                    {/* Horizontal Grid Lines and Status Labels */}
                    {statusLabels.map((label, index) => (
                        <Fragment key={`h-${index}`}>
                            <line x1={padding.left} y1={chartHeight - padding.bottom - index * statusScale} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom - index * statusScale} className="stroke-gray-300 stroke-1" strokeDasharray="4,4" />
                            <text x={padding.left - 10} y={chartHeight - padding.bottom - index * statusScale} dominantBaseline="middle" textAnchor="end" className="fill-slate-600 text-sm font-semibold">{label}</text>
                        </Fragment>
                    ))}

                    {/* Vertical Grid Lines and Time Labels */}
                    {[...Array(25)].map((_, i) => (
                        <Fragment key={`v-${i}`}>
                            <line x1={padding.left + i * timeScale} y1={padding.top} x2={padding.left + i * timeScale} y2={chartHeight - padding.bottom} className="stroke-gray-300 stroke-1" strokeDasharray="4,4" />
                            <text x={padding.left + i * timeScale} y={chartHeight - padding.bottom + 15} textAnchor="middle" className="fill-slate-600 text-xs">{i % 12 === 0 ? (i === 0 || i === 24 ? 'Midnight' : i) : i}</text>
                        </Fragment>
                    ))}

                    {/* Status Line Graph */}
                    <path d={pathData} className="stroke-blue-600 stroke-[3] fill-none transition-all duration-1000 ease-in-out" />
                </svg>
            </div>
        );
    };

    // Custom React header removed; using static HTML header from public/index.html

    const renderFormPage = () => (
        <div className="flex flex-col lg:flex-row justify-center items-stretch space-y-8 lg:space-y-0 lg:space-x-8 p-4 lg:p-12 w-full max-w-7xl mx-auto">
            <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl border border-gray-200 transition-all duration-400 hover:transform hover:-translate-y-1 hover:shadow-2xl p-8 w-full lg:w-1/2 flex flex-col space-y-6">
                <p className="text-center text-gray-600 mb-6">Input your trip details to get a professional route and ELD log plan.</p>
                <div className="space-y-4">
                    <div className="relative">
                        <label htmlFor="currentLocation" className="block text-sm font-medium text-gray-700">Current Location</label>
                        <input type="text" id="currentLocation" value={currentLocation} onChange={(e) => handleInputChange(e, setCurrentLocation, setCurrentCoords, setCurrentSuggestions, currentTimer)} placeholder="e.g., Chicago, IL" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black" />
                        {currentSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                {currentSuggestions.map((s, i) => (
                                    <li key={i} className="p-2 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSuggestionClick(s, setCurrentLocation, setCurrentCoords, setCurrentSuggestions)}>
                                        {s.properties.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="relative">
                        <label htmlFor="pickupLocation" className="block text-sm font-medium text-gray-700">Pickup Location</label>
                        <input type="text" id="pickupLocation" value={pickupLocation} onChange={(e) => handleInputChange(e, setPickupLocation, setPickupCoords, setPickupSuggestions, pickupTimer)} placeholder="e.g., Dallas, TX" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black" />
                        {pickupSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                {pickupSuggestions.map((s, i) => (
                                    <li key={i} className="p-2 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSuggestionClick(s, setPickupLocation, setPickupCoords, setPickupSuggestions)}>
                                        {s.properties.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="relative">
                        <label htmlFor="dropoffLocation" className="block text-sm font-medium text-gray-700">Dropoff Location</label>
                        <input type="text" id="dropoffLocation" value={dropoffLocation} onChange={(e) => handleInputChange(e, setDropoffLocation, setDropoffCoords, setDropoffSuggestions, dropoffTimer)} placeholder="e.g., New York, NY" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black" />
                        {dropoffSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                {dropoffSuggestions.map((s, i) => (
                                    <li key={i} className="p-2 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSuggestionClick(s, setDropoffLocation, setDropoffCoords, setDropoffSuggestions)}>
                                        {s.properties.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                        <label htmlFor="currentCycleUsed" className="block text-sm font-medium text-gray-700">Current Cycle Used (Hrs)</label>
                        <input type="number" id="currentCycleUsed" value={currentCycleUsed} onChange={(e) => setCurrentCycleUsed(e.target.value)} placeholder="e.g., 25" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition duration-150 p-2 border-2 text-black" />
                    </div>
                </div>
                {validationError && <p className="text-red-500 text-sm mt-2 text-center">{validationError}</p>}
                <button onClick={handleCalculateTrip} disabled={isLoading || !currentCoords || !pickupCoords || !dropoffCoords} className="w-full mt-6 py-3 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:from-gray-400 disabled:to-gray-600 disabled:cursor-not-allowed">
                            {isLoading ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-2 border-white"></div>
                                    <span>Calculating...</span>
                                </div>
                            ) : 'Calculate Trip'}
                        </button>
                    </div>

                    <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl border border-gray-200 transition-all duration-400 hover:transform hover:-translate-y-1 hover:shadow-2xl w-full lg:w-1/2 p-8 flex flex-col space-y-6">
                        {!tripPlan && !isLoading && (
                            <div className="flex-1 flex items-center justify-center text-center p-8">
                                <p className="text-lg text-gray-500">
                                    Enter your trip details on the left and click "Calculate Trip" to generate your route and ELD logs.
                                </p>
                            </div>
                        )}
                        {tripPlan && (
                            <Fragment>
                                <h2 className="text-2xl font-bold text-center text-blue-800">Trip Plan Output</h2>
                                <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-semibold text-blue-700">Route Map</h3>
                                        <button onClick={handleSaveTrip} className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2">
                                            Save Trip
                                        </button>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-1 mb-3">
                                        Optimized route showing pickup, dropoff, and rest stops.
                                    </p>
                                    <div id="mini-map-container" className="w-full h-64 bg-gray-100 rounded-lg cursor-pointer" onClick={() => tripPlan && setCurrentPage('map')}></div>
                                    <p className="text-center text-sm text-gray-500 mt-2 italic">Click the map to enlarge.</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-semibold text-blue-700">ELD Daily Logs</h3>
                                        <button onClick={handleDownload} className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2">
                                            <span>Download</span>
                                        </button>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-1 mb-3">
                                        Daily log sheets with filled-out hours of service.
                                    </p>
                                    <div className="space-y-4 cursor-pointer" onClick={() => tripPlan && setCurrentPage('log')}>
                                        {tripPlan.dailyLogs.map((log, index) => (
                                            <div key={index} className="flex justify-between items-center p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                                                <span className="font-semibold text-gray-700">Day {index + 1} Log</span>
                                                <span className="text-sm text-gray-500">Click to view details</span>
                                            </div>
                                        ))}
                                    </div>
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
                                <div key={trip.id} className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-xl p-6 border border-gray-200 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-blue-700">Trip from {trip.currentLocation} to {trip.dropoffLocation}</h3>
                                        <p className="text-sm text-gray-500 mt-1">Saved on {new Date(trip.timestamp).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex space-x-4">
                                        <button onClick={() => {
                                            setTripPlan(trip);
                                            setCurrentPage('form');
                                        }} className="py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                                            View
                                        </button>
                                        <button onClick={() => confirmDeleteTrip(trip.id)} className="py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
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
                <div className="p-4 lg:p-12 w-full max-w-7xl mx-auto">
                    <button onClick={() => setCurrentPage('form')} className="mb-6 py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        &larr; Back to Trip
                    </button>
                    <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl p-8 border border-gray-200">
                        <h2 className="text-3xl font-bold text-center text-blue-800 mb-6">Detailed Route Map</h2>
                        <p className="text-lg text-center text-gray-600 mb-4">Route from {tripPlan?.pickupLocation} to {tripPlan?.dropoffLocation}</p>
                        <div id="full-map-container" className="w-full h-[600px] rounded-xl overflow-hidden mb-8"></div>
                        {/* Trip Summary Section */}
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
                                        {tripPlan.stops.map((stop, idx) => (
                                            <li key={idx} className="mb-1">
                                                <span className="font-semibold">{stop.name}:</span> {stop.location} <span className="text-gray-500">({stop.details})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <div className="bg-white rounded-lg shadow p-4 border border-blue-100">
                                        <span className="block font-semibold text-blue-700">Cycle Used</span>
                                        <span className="text-lg">{tripPlan.currentCycleUsed} hrs</span>
                                    </div>
                                    <div className="bg-white rounded-lg shadow p-4 border border-blue-100">
                                        <span className="block font-semibold text-blue-700">Days (ELD Logs)</span>
                                        <span className="text-lg">{tripPlan.dailyLogs.length}</span>
                                    </div>
                                    <div className="bg-white rounded-lg shadow p-4 border border-blue-100">
                                        <span className="block font-semibold text-blue-700">Estimated Duration</span>
                                        <span className="text-lg">{
                                            (() => {
                                                const drivingHours = tripPlan.totalMiles / 55;
                                                const fuelStops = Math.max(1, Math.ceil(tripPlan.totalMiles / 1000));
                                                const estHours = drivingHours + 1 + 1 + fuelStops;
                                                const estDays = Math.ceil(estHours / 8);
                                                return estDays > 1 ? `${estDays} days` : `${Math.round(estHours)} hrs`;
                                            })()
                                        }</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );

            const renderLogPage = () => (
                <div className="p-4 lg:p-12 w-full max-w-7xl mx-auto">
                    <button onClick={() => setCurrentPage('form')} className="mb-6 py-2 px-4 rounded-md text-white font-bold transition duration-300 ease-in-out transform bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        &larr; Back to Trip
                    </button>
                    <div className="bg-white bg-opacity-80 backdrop-blur-lg shadow-lg rounded-3xl p-8 border border-gray-200">
                        <h2 className="text-3xl font-bold text-center text-blue-800 mb-6">Daily ELD Logs</h2>
                        <p className="text-lg text-center text-gray-600 mb-4">Logs for trip from {tripPlan?.currentLocation} to {tripPlan?.dropoffLocation}</p>
                        {tripPlan?.dailyLogs.map((log, index) => renderELDLog(index, log))}
                    </div>
                </div>
            );

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
                                <p className="mb-6 text-gray-600">Are you sure you want to delete this trip from your history? This action cannot be undone.</p>
                                <div className="flex space-x-4">
                                    <button onClick={handleDeleteTrip} className="py-2 px-6 rounded-md text-white font-bold bg-red-500 hover:bg-red-600 transition-colors">
                                        Yes, Delete
                                    </button>
                                    <button onClick={() => setIsConfirmModalOpen(false)} className="py-2 px-6 rounded-md text-white font-bold bg-gray-500 hover:bg-gray-600 transition-colors">
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
