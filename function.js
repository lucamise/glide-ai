window.function = function (useBrowserGeolocation, outputFormat, updateInterval) {
	// DYNAMIC VALUES
	useBrowserGeolocation = useBrowserGeolocation?.value ?? "true";
	outputFormat = outputFormat?.value ?? "lat,lng"; // "lat,lng" or "lng,lat" or "json"
	updateInterval = updateInterval?.value ? parseInt(updateInterval.value) : 1000;
	
	// If browser geolocation is disabled, return empty string
	if (useBrowserGeolocation !== "true") {
		return "";
	}
	
	// Return HTML that automatically gets location from device and displays coordinates
	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			background: #f5f5f5;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 12px;
			padding: 24px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
			max-width: 400px;
			width: 100%;
		}
		.header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 16px;
		}
		.header-icon {
			width: 24px;
			height: 24px;
			color: #4285f4;
		}
		.header-title {
			font-size: 18px;
	  font-weight: 600;
			color: #1a1a1a;
		}
		.coordinates {
			font-size: 16px;
			color: #1a1a1a;
			text-align: center;
			line-height: 1.8;
			font-family: 'Monaco', 'Courier New', monospace;
			background: #f8f9fa;
			padding: 16px;
			border-radius: 8px;
			margin-bottom: 12px;
			word-break: break-all;
			min-height: 60px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.coordinates.empty {
			color: #999;
		}
		.status {
			font-size: 13px;
			color: #666;
			text-align: center;
			display: flex;
			align-items: center;
			justify-content: center;
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
			width: 16px;
			height: 16px;
		}
		.details {
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid #e5e5e5;
			font-size: 12px;
			color: #666;
			display: flex;
			justify-content: space-between;
		}
		.detail-item {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.detail-label {
			color: #999;
		}
		.detail-value {
			color: #333;
			font-weight: 500;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
			</svg>
			<div class="header-title">Location Tracker</div>
		</div>
		<div id="coordinates" class="coordinates empty">Getting location...</div>
		<div id="status" class="status waiting">
			<svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>Requesting location...</span>
		</div>
		<div id="details" class="details" style="display: none;">
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
	<script>
		let watchId = null;
		let lastCoordinates = null;
		let updateCount = 0;
		
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
			const detailsEl = document.getElementById('details');
			const accuracyEl = document.getElementById('accuracy');
			const updatesEl = document.getElementById('updates');
			
			// Update coordinates display
			coordinatesEl.textContent = formatted;
			coordinatesEl.classList.remove('empty');
			
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
			detailsEl.style.display = 'flex';
			
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
			
			// Start watching for continuous updates
			watchId = navigator.geolocation.watchPosition(
				onLocationSuccess,
				onLocationError,
				{
					enableHighAccuracy: true,
					timeout: ${updateInterval},
					maximumAge: 0
				}
			);
			
			console.log('✅ Location tracking started - Updates every ${updateInterval}ms');
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
