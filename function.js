window.function = function (useBrowserGeolocation, outputFormat, updateInterval) {
	// DYNAMIC VALUES
	useBrowserGeolocation = useBrowserGeolocation?.value ?? "true";
	outputFormat = outputFormat?.value ?? "lat,lng"; // "lat,lng" or "lng,lat" or "json"
	updateInterval = updateInterval?.value ? parseInt(updateInterval.value) : 1000;
	
	// If browser geolocation is disabled, return empty string
	if (useBrowserGeolocation !== "true") {
		return "";
	}
	
	// Return HTML that automatically gets location from device and displays map + coordinates
	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			height: 100vh;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}
		.header {
			background: white;
			padding: 12px 16px;
			border-bottom: 1px solid #e5e5e5;
			display: flex;
			align-items: center;
			justify-content: space-between;
			z-index: 1000;
			box-shadow: 0 2px 4px rgba(0,0,0,0.05);
		}
		.header-left {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.header-icon {
			width: 20px;
			height: 20px;
			color: #4285f4;
		}
		.header-title {
			font-size: 16px;
			font-weight: 600;
			color: #1a1a1a;
		}
		.status {
			font-size: 12px;
			color: #666;
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.status.error {
			color: #dc2626;
		}
		.status.success {
			color: #16a34a;
		}
		.status.waiting {
			color: #ea580c;
		}
		.status-icon {
			width: 14px;
			height: 14px;
		}
		#map {
			flex: 1;
			width: 100%;
			z-index: 1;
		}
		.coordinates-panel {
			background: white;
			padding: 12px 16px;
			border-top: 1px solid #e5e5e5;
			box-shadow: 0 -2px 4px rgba(0,0,0,0.05);
			z-index: 1000;
		}
		.coordinates {
			font-size: 13px;
			color: #1a1a1a;
			font-family: 'Monaco', 'Courier New', monospace;
			text-align: center;
			margin-bottom: 8px;
		}
		.details {
			display: flex;
			justify-content: center;
			gap: 24px;
			font-size: 11px;
			color: #666;
		}
		.detail-item {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;
		}
		.detail-label {
			color: #999;
		}
		.detail-value {
			color: #333;
			font-weight: 500;
		}
		.loading {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: white;
			padding: 16px 24px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
			z-index: 2000;
			text-align: center;
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="header-left">
			<svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
			</svg>
			<div class="header-title">Location Tracker</div>
		</div>
		<div id="status" class="status waiting">
			<svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>Getting location...</span>
		</div>
	</div>
	<div id="map"></div>
	<div id="loading" class="loading" style="display: block;">
		<div style="margin-bottom: 8px;">📍</div>
		<div style="font-size: 14px; color: #666;">Loading map...</div>
	</div>
	<div class="coordinates-panel" style="display: none;">
		<div id="coordinates" class="coordinates">--</div>
		<div id="details" class="details">
			<div class="detail-item">
				<span class="detail-label">Accuracy</span>
				<span id="accuracy" class="detail-value">--</span>
			</div>
			<div class="detail-item">
				<span class="detail-label">Updates</span>
				<span id="updates" class="detail-value">0</span>
			</div>
		</div>
	</div>
	<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
	<script>
		let map = null;
		let marker = null;
		let circle = null;
		let watchId = null;
		let lastCoordinates = null;
		let updateCount = 0;
		
		// Initialize map
		function initMap(lat, lng) {
			if (map) {
				map.setView([lat, lng], map.getZoom());
				return;
			}
			
			// Create map
			map = L.map('map').setView([lat, lng], 16);
			
			// Add OpenStreetMap tiles (same as Vercel app)
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 19
			}).addTo(map);
			
			// Hide loading
			document.getElementById('loading').style.display = 'none';
			document.querySelector('.coordinates-panel').style.display = 'block';
		}
		
		// Update map with new location
		function updateMap(lat, lng, accuracy) {
			if (!map) {
				initMap(lat, lng);
			}
			
			// Update marker
			if (marker) {
				marker.setLatLng([lat, lng]);
			} else {
				marker = L.marker([lat, lng], {
					icon: L.divIcon({
						className: 'custom-marker',
						html: '<div style="background: #4285f4; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
						iconSize: [24, 24],
						iconAnchor: [12, 12]
					})
				}).addTo(map);
			}
			
			// Update accuracy circle
			if (circle) {
				circle.setLatLng([lat, lng]);
				circle.setRadius(accuracy);
			} else {
				circle = L.circle([lat, lng], {
					radius: accuracy,
					color: '#4285f4',
					fillColor: '#4285f4',
					fillOpacity: 0.1,
					weight: 2
				}).addTo(map);
			}
			
			// Auto-center map (smooth pan)
			map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.5 });
		}
		
		// Format coordinates based on output format
		function formatCoordinates(lat, lng, format) {
			if (format === "json") {
				return JSON.stringify({ lat: lat, lng: lng, latitude: lat, longitude: lng });
			} else if (format === "lng,lat") {
				return lng.toFixed(6) + "," + lat.toFixed(6);
			} else {
				// Default: "lat,lng"
				return lat.toFixed(6) + "," + lng.toFixed(6);
			}
		}
		
		// Update display with coordinates
		function updateCoordinates(lat, lng, accuracy) {
			updateCount++;
			const formatted = formatCoordinates(lat, lng, "${outputFormat}");
			const coordinatesEl = document.getElementById('coordinates');
			const statusEl = document.getElementById('status');
			const accuracyEl = document.getElementById('accuracy');
			const updatesEl = document.getElementById('updates');
			
			// Update map
			updateMap(lat, lng, accuracy);
			
			// Update coordinates display
			coordinatesEl.textContent = formatted;
			
			// Update status
			statusEl.innerHTML = \`
				<svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<span>Tracking active</span>
			\`;
			statusEl.className = 'status success';
			
			// Update details
			accuracyEl.textContent = Math.round(accuracy) + 'm';
			updatesEl.textContent = updateCount;
			
			lastCoordinates = formatted;
			
			// Send coordinates to Glide parent via postMessage
			if (window.parent && window.parent !== window) {
				window.parent.postMessage({
					type: 'location-coordinates',
					data: {
						coordinates: formatted,
						lat: lat,
						lng: lng,
						accuracy: accuracy,
						format: "${outputFormat}",
						updateCount: updateCount
					}
				}, '*');
			}
		}
		
		// Handle geolocation success
		function onLocationSuccess(position) {
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;
			const accuracy = position.coords.accuracy;
			updateCoordinates(lat, lng, accuracy);
		}
		
		// Handle geolocation error
		function onLocationError(error) {
			const statusEl = document.getElementById('status');
			let message = 'Location unavailable';
			if (error.code === 1) {
				message = 'Permission denied - Please allow location access';
			} else if (error.code === 2) {
				message = 'Location unavailable - Check GPS/network';
			} else if (error.code === 3) {
				message = 'Timeout - Retrying...';
			}
			statusEl.innerHTML = \`
				<svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<span>\${message}</span>
			\`;
			statusEl.className = 'status error';
			
			// Still try to get location
			setTimeout(() => {
				if (navigator.geolocation) {
					navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError);
				}
			}, 2000);
		}
		
		// Start getting location
		function startTracking() {
			if (!navigator.geolocation) {
				const statusEl = document.getElementById('status');
				statusEl.innerHTML = \`
					<svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<span>Geolocation not supported</span>
				\`;
				statusEl.className = 'status error';
				document.getElementById('loading').style.display = 'none';
				return;
			}
			
			// Get initial position
			navigator.geolocation.getCurrentPosition(
				onLocationSuccess,
				onLocationError,
				{
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0
				}
			);
			
			// Start watching for continuous updates (like Vercel app)
			watchId = navigator.geolocation.watchPosition(
				onLocationSuccess,
				onLocationError,
				{
					enableHighAccuracy: true,
					timeout: ${updateInterval},
					maximumAge: 0
				}
			);
			
			console.log('✅ Location tracking started - Using watchPosition (like Vercel app)');
		}
		
		// Start tracking when page loads
		window.addEventListener('load', startTracking);
		
		// Cleanup on unload
		window.addEventListener('beforeunload', function() {
			if (watchId !== null) {
				navigator.geolocation.clearWatch(watchId);
			}
		});
		
		// Also try immediately (in case page is already loaded)
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', startTracking);
		} else {
			startTracking();
		}
	  </script>
</body>
</html>
	  `;
	
	// Return as data URL
	const encodedHtml = encodeURIComponent(html);
	return "data:text/html;charset=utf-8," + encodedHtml;
};
