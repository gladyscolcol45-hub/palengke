// Turns a barangay/city name into approximate map coordinates using
// OpenStreetMap's free Nominatim search — no API key needed.
// Returns { lat, lng } or null if nothing was found / the lookup failed.
export async function geocodeAddress(barangay, city) {
  const query = [barangay, city, 'Philippines'].filter(Boolean).join(', ').trim();
  if (!query || query === 'Philippines') return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`
    );
    if (!response.ok) return null;
    const results = await response.json();
    if (results && results.length > 0) {
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    }
  } catch (e) {
    // Network hiccup or the free lookup is temporarily unavailable — not fatal,
    // the listing still saves, it just won't have a location this time.
  }
  return null;
}
