# Google Maps setup (post-deploy)

The Recommendations app uses Google Maps for the cross-category map view and (optionally) Places autocomplete.

1. Create or select a GCP project.
2. Enable **Maps Static API** (map pins), **Geocoding API**, and **Maps JavaScript API** (address lookup when adding a place) on your browser key.
3. Create an API key; restrict by HTTP referrer (`localhost:*`, your production domain) for the browser key.
4. Set billing alerts (e.g. $1) — free tier per-SKU caps apply ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)).
5. Add to env:
   - **Browser (map + client geocode):** `VITE_GOOGLE_MAPS_API_KEY` — local: `frontend/.env`; production: Appliku/runtime env (injected into the HTML shell at request time). Referrer-restricted keys work for the map and for geocoding in the browser; they cannot geocode from the Django server.
   - **Server (optional geocode):** `GOOGLE_MAPS_SERVER_API_KEY` — runtime only; IP-restricted key with Geocoding API. Omit if you rely on client-side geocode only.

Without a key, list/detail still work; the map page shows a geo entry list instead of an embedded map.
