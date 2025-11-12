window.function = function (startingPoint, latitude, longitude, outputFormat) {
	// DYNAMIC VALUES
	outputFormat = outputFormat?.value ?? "lat,lng"; // "lat,lng" or "lng,lat" or "json"
	
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
	
	const hasValidLocation = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

	// LOG SETTINGS TO CONSOLE
	console.log(
		`Starting Point: ${startingPoint?.value}\n` +
			`Latitude: ${lat}\n` +
			`Longitude: ${lng}\n` +
			`Output Format: ${outputFormat}\n` +
			`Has Valid Location: ${hasValidLocation}`
	);
	
	// If we have valid coordinates, return them in the requested format
	if (hasValidLocation) {
		if (outputFormat === "json") {
			return JSON.stringify({ lat: lat, lng: lng, latitude: lat, longitude: lng });
		} else if (outputFormat === "lng,lat") {
			return `${lng},${lat}`;
		} else {
			// Default: "lat,lng"
			return `${lat},${lng}`;
		}
	}
	
	// Return empty string if no location found
	return "";
};
