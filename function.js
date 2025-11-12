window.function = function (startingPoint, latitude, longitude, mapZoom, useBrowserGeolocation, updateInterval) {
	// DYNAMIC VALUES
	mapZoom = mapZoom?.value ? parseInt(mapZoom.value) : 16;
	useBrowserGeolocation = useBrowserGeolocation?.value ?? "true";
	updateInterval = updateInterval?.value ? parseInt(updateInterval.value) : 1000;
	
	// Parse Starting Point (Glide location column)
	let lat = null;
	let lng = null;
	
	// Try Starting Point first (Glide's location column)
	if (startingPoint?.value) {
		const sp = startingPoint.value;
		console.log('Starting Point raw value:', sp, 'Type:', typeof sp);
		
		// Starting Point can be in different formats:
		// 1. String with coordinates: "40.7128,-74.0060" or "40.7128, -74.0060"
		// 2. Object with lat/lng properties: {lat: 40.7128, lng: -74.0060}
		// 3. JSON string: '{"lat": 40.7128, "lng": -74.0060}'
		// 4. Glide location object with coordinates array: {coordinates: [lng, lat]}
		
		try {
			if (typeof sp === 'string') {
				// Try to parse as JSON first
				try {
					const parsed = JSON.parse(sp);
					if (parsed.coordinates && Array.isArray(parsed.coordinates) && parsed.coordinates.length === 2) {
						// Glide format: [longitude, latitude]
						lng = parseFloat(parsed.coordinates[0]);
						lat = parseFloat(parsed.coordinates[1]);
					} else if (parsed.lat !== undefined && parsed.lng !== undefined) {
						lat = parseFloat(parsed.lat);
						lng = parseFloat(parsed.lng);
					} else if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
						lat = parseFloat(parsed.latitude);
						lng = parseFloat(parsed.longitude);
					}
				} catch (e) {
					// Not JSON, try comma-separated format: "lat,lng" or "lng,lat"
					const parts = sp.split(',');
					if (parts.length === 2) {
						const val1 = parseFloat(parts[0].trim());
						const val2 = parseFloat(parts[1].trim());
						// Check which is which (latitude is usually -90 to 90, longitude -180 to 180)
						if (Math.abs(val1) <= 90 && Math.abs(val2) <= 180) {
							lat = val1;
							lng = val2;
						} else if (Math.abs(val2) <= 90 && Math.abs(val1) <= 180) {
							lng = val1;
							lat = val2;
						} else {
							// Default: assume lat,lng
							lat = val1;
							lng = val2;
						}
					}
				}
			} else if (typeof sp === 'object' && sp !== null) {
				// Direct object
				if (sp.coordinates && Array.isArray(sp.coordinates) && sp.coordinates.length === 2) {
					// Glide format: [longitude, latitude]
					lng = parseFloat(sp.coordinates[0]);
					lat = parseFloat(sp.coordinates[1]);
				} else if (sp.lat !== undefined && sp.lng !== undefined) {
					lat = parseFloat(sp.lat);
					lng = parseFloat(sp.lng);
				} else if (sp.latitude !== undefined && sp.longitude !== undefined) {
					lat = parseFloat(sp.latitude);
					lng = parseFloat(sp.longitude);
				}
			}
		} catch (e) {
			console.error('Error parsing Starting Point:', e);
		}
	}
	
	// Fallback to separate latitude/longitude parameters
	if ((lat === null || lng === null || isNaN(lat) || isNaN(lng)) && latitude?.value && longitude?.value) {
		lat = parseFloat(latitude.value);
		lng = parseFloat(longitude.value);
	}
	
	const hasGlideLocation = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

	// LOG SETTINGS TO CONSOLE
	console.log(
		`Starting Point: ${startingPoint?.value}\n` +
			`Latitude: ${lat}\n` +
			`Longitude: ${lng}\n` +
			`Map Zoom: ${mapZoom}\n` +
			`Use Browser Geolocation: ${useBrowserGeolocation}\n` +
			`Has Glide Location: ${hasGlideLocation}`
	);
	
	// Default location (New York City) if no coordinates provided
	const defaultLat = 40.7128;
	const defaultLng = -74.0060;

	const customCSS = `
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
	  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	  overflow: hidden;
	}
	#map { 
	  width: 100%; 
	  height: 100vh; 
	}
	#status {
	  position: absolute;
	  top: 10px;
	  left: 10px;
	  background: rgba(255, 255, 255, 0.95);
	  padding: 12px 16px;
	  border-radius: 8px;
	  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
	  z-index: 1000;
	  font-size: 13px;
	  max-width: 320px;
	}
	#coordinates {
	  position: absolute;
	  bottom: 10px;
	  left: 10px;
	  background: rgba(0, 0, 0, 0.85);
	  color: white;
	  padding: 12px 16px;
	  border-radius: 8px;
	  z-index: 1000;
	  font-size: 12px;
	  font-family: 'Monaco', 'Courier New', monospace;
	  line-height: 1.6;
	}
	.status-active { color: #16a34a; }
	.status-error { color: #dc2626; }
	.status-waiting { color: #ea580c; }
	.status-info { color: #2563eb; }
	button {
	  background: #4285f4;
	  color: white;
	  border: none;
	  padding: 8px 16px;
	  border-radius: 6px;
	  cursor: pointer;
	  font-size: 12px;
	  margin-top: 8px;
	}
	button:hover { background: #357ae8; }
	button:disabled { background: #ccc; cursor: not-allowed; }
	`;

	// HTML THAT IS RETURNED AS A RENDERABLE URL
	const originalHTML = `
	  <!DOCTYPE html>
	  <html>
	  <head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
		<style>${customCSS}</style>
	  </head>
	  <body>
		<div id="map"></div>
		<div id="status" class="status-info">📍 Loading map...</div>
		<div id="coordinates">Lat: --<br>Lng: --<br>Source: --<br>Updates: 0</div>
		
		<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
	  <script>
		  let map;
		  let marker;
		  let circle;
		  let watchId;
		  let locationHistory = [];
		  let isTracking = false;
		  let polyline;
		  let updateCount = 0;
		  let locationSource = 'none'; // 'glide', 'browser', or 'none'
		  
		  // Initialize map
		  function initMap(lat, lng) {
			if (map) {
			  map.setView([lat, lng], map.getZoom());
			  return;
			}
			
			map = L.map('map').setView([lat, lng], ${mapZoom});
			
			// OpenStreetMap tiles (free, no API key required)
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			  attribution: '© OpenStreetMap contributors',
			  maxZoom: 19
			}).addTo(map);
			
			// Create marker
			marker = L.marker([lat, lng], {
			  icon: L.divIcon({
				className: 'custom-marker',
				html: '<div style="background: #4285f4; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
				iconSize: [20, 20],
				iconAnchor: [10, 10]
			  })
			}).addTo(map);
			
			// Create accuracy circle (smaller for Glide locations)
			circle = L.circle([lat, lng], {
			  radius: 20,
			  color: '#4285f4',
			  fillColor: '#4285f4',
			  fillOpacity: 0.1,
			  weight: 2
			}).addTo(map);
			
			// Create polyline for history
			polyline = L.polyline([], {
			  color: '#4285f4',
			  weight: 3,
			  opacity: 0.5
			}).addTo(map);
		  }
		  
		  // Update location from any source
		  function updateLocationFromCoordinates(lat, lng, accuracy, source) {
			accuracy = accuracy || 20; // Default accuracy
			source = source || 'unknown';
			locationSource = source;
			updateCount++;
			
			// Store in history
			locationHistory.push({ lat, lng, accuracy, timestamp: Date.now(), source });
			
			// Update display
			const timestamp = new Date();
			document.getElementById('coordinates').innerHTML = 
			  \`Lat: \${lat.toFixed(6)}<br>
			   Lng: \${lng.toFixed(6)}<br>
			   Accuracy: \${Math.round(accuracy)}m<br>
			   Updates: \${updateCount}<br>
			   Source: \${source}<br>
			   Time: \${timestamp.toLocaleTimeString()}\`;
			
			// Update map
			if (map) {
			  map.setView([lat, lng], map.getZoom());
			  marker.setLatLng([lat, lng]);
			  circle.setLatLng([lat, lng]);
			  circle.setRadius(accuracy);
			  
			  // Update history trail
			  if (polyline) {
				const path = locationHistory.slice(-100).map(loc => [loc.lat, loc.lng]);
				polyline.setLatLngs(path);
			  }
			} else {
			  initMap(lat, lng);
			}
			
			// Update status
			document.getElementById('status').innerHTML = 
			  \`✅ Tracking active • \${updateCount} updates • Source: \${source}\`;
			document.getElementById('status').className = 'status-active';
			
			// SEND TO GLIDE VIA POSTMESSAGE
			if (window.parent && window.parent !== window) {
			  window.parent.postMessage({
				type: 'location-update',
				data: {
				  latitude: lat,
				  longitude: lng,
				  accuracy: accuracy,
				  timestamp: Date.now(),
				  source: source
				}
			  }, '*');
			}
			
			// STORE IN LOCALSTORAGE
			localStorage.setItem('lastLocation', JSON.stringify({
			  lat, lng, accuracy, 
			  timestamp: Date.now(),
			  source: source
			}));
			
			// Store history (last 100 points)
			if (locationHistory.length > 100) {
			  locationHistory = locationHistory.slice(-100);
			}
			localStorage.setItem('locationHistory', JSON.stringify(locationHistory.slice(-50)));
		  }
		  
		  // Update location from browser geolocation
		  function updateLocationFromBrowser(position) {
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;
			const accuracy = position.coords.accuracy;
			updateLocationFromCoordinates(lat, lng, accuracy, 'browser');
		  }
		  
		  // Handle browser geolocation errors
		  function handleBrowserGeolocationError(error) {
			console.error('Browser geolocation error:', error);
			if (locationSource === 'none' || locationSource === 'glide') {
			  // Only show error if we don't have Glide location
			  if (!${hasGlideLocation}) {
				let message = '❌ Browser location unavailable';
				if (error.code === 1) {
				  message = '📍 Using Glide location (browser permission denied)';
				  document.getElementById('status').innerHTML = message + '<br><small style="color: #666; font-size: 11px;">Glide location is being used as fallback.</small>';
				  document.getElementById('status').className = 'status-info';
				} else {
				  document.getElementById('status').innerHTML = message;
				  document.getElementById('status').className = 'status-error';
				}
			  }
			}
		  }
		  
		  // Start browser geolocation tracking (if enabled)
		  function startBrowserTracking() {
			if ('${useBrowserGeolocation}' !== 'true' || !navigator.geolocation) {
			  return;
			}
			
			console.log('Starting browser geolocation tracking...');
			const options = {
			  enableHighAccuracy: true,
			  timeout: 20000,
			  maximumAge: 0
			};
			
			// Get initial position
			navigator.geolocation.getCurrentPosition(
			  (position) => {
				console.log('✅ Browser location obtained:', position);
				updateLocationFromBrowser(position);
				
				// Start watching
				if (!isTracking) {
				  isTracking = true;
				  watchId = navigator.geolocation.watchPosition(
					updateLocationFromBrowser,
					handleBrowserGeolocationError,
					{ ...options, timeout: ${updateInterval} }
				  );
				}
			  },
			  handleBrowserGeolocationError,
			  options
			);
		  }
		  
		  // Listen for location updates from Glide via postMessage
		  window.addEventListener('message', function(event) {
			console.log('Received message from parent:', event.data);
			
			// Handle location update from Glide
			if (event.data && event.data.type === 'location-update' && event.data.data) {
			  const data = event.data.data;
			  if (data.latitude && data.longitude) {
				console.log('📍 Received location from Glide:', data);
				updateLocationFromCoordinates(
				  parseFloat(data.latitude),
				  parseFloat(data.longitude),
				  data.accuracy || 20,
				  'glide'
				);
			  }
			}
			
			// Handle other message types
			if (event.data && event.data.type === 'stop-tracking') {
			  if (watchId) {
				navigator.geolocation.clearWatch(watchId);
				watchId = null;
				isTracking = false;
			  }
			} else if (event.data && event.data.type === 'start-tracking') {
			  startBrowserTracking();
			} else if (event.data && event.data.type === 'get-location') {
			  // Send current location on request
			  const lastLoc = localStorage.getItem('lastLocation');
			  if (lastLoc) {
				window.parent.postMessage({
				  type: 'location-response',
				  data: JSON.parse(lastLoc)
				}, '*');
			  }
			}
		  });
		  
		  // Initialize with Glide location if available
		  function initialize() {
			if (${hasGlideLocation}) {
			  console.log('📍 Initializing with Glide location:', ${lat}, ${lng});
			  initMap(${lat}, ${lng});
			  updateLocationFromCoordinates(${lat}, ${lng}, 20, 'glide');
			  document.getElementById('status').innerHTML = '✅ Using Glide location • Waiting for updates...';
			  document.getElementById('status').className = 'status-active';
			} else {
			  console.log('📍 No Glide location, initializing with default location');
			  initMap(${defaultLat}, ${defaultLng});
			  document.getElementById('status').innerHTML = '⚠️ No location provided • Waiting for Glide location or browser permission...';
			  document.getElementById('status').className = 'status-waiting';
			}
			
			// Try browser geolocation as fallback/alternative
			if ('${useBrowserGeolocation}' === 'true') {
			  startBrowserTracking();
			}
			
			// Request location from Glide parent (if possible)
			if (window.parent && window.parent !== window) {
			  console.log('Requesting location from Glide parent...');
			  window.parent.postMessage({
				type: 'request-location'
			  }, '*');
			}
		  }
		  
		  // Start when page loads
		  window.addEventListener('load', initialize);
		  
		  // Cleanup on unload
		  window.addEventListener('beforeunload', function() {
			if (watchId) {
			  navigator.geolocation.clearWatch(watchId);
			}
		  });
	  </script>
	  </body>
	  </html>
	  `;
	var encodedHtml = encodeURIComponent(originalHTML);
	return "data:text/html;charset=utf-8," + encodedHtml;
};
