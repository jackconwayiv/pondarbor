# Google Maps setup (post-deploy)

Recommenda uses Google Maps for the interactive places map and address lookup when adding a place.

1. Create or select a GCP project.
2. On your **browser key**, enable only these standard SKUs (no premium add-ons):
   - **Maps JavaScript API** (interactive vector map, Advanced Markers, InfoWindows)
   - **Geocoding API** (address lookup in the add form)
3. Create a **Map ID** for Advanced Markers: Google Cloud Console → APIs & Services → Google Maps Platform → **Map Management** → Create map ID (type: JavaScript, vector). Set `VITE_GOOGLE_MAPS_MAP_ID` in env. Without it, the app falls back to `DEMO_MAP_ID` (fine for local dev; production may show a development watermark).
4. Create an API key; restrict by HTTP referrer (`localhost:*`, your production domain).
5. Set billing alerts (e.g. $1) — Google Maps Platform includes a monthly credit; Dynamic Maps bill per map load ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)).
6. Add to env:
   - **Browser (map + client geocode):** `VITE_GOOGLE_MAPS_API_KEY` — local: `frontend/.env`; production: Appliku/runtime env (injected into the HTML shell at request time). Referrer-restricted keys work for the map and for geocoding in the browser; they cannot geocode from the Django server.
   - **Map ID (Advanced Markers):** `VITE_GOOGLE_MAPS_MAP_ID` — optional; same injection pattern as the API key.
   - **Server (optional geocode):** `GOOGLE_MAPS_SERVER_API_KEY` — runtime only; IP-restricted key with Geocoding API. Omit if you rely on client-side geocode only.

**Not required:** Maps Static API, Places API (New), Routes, Street View, or other premium products.

Without a key, list/detail still work; the places tab shows the list without an embedded map.
