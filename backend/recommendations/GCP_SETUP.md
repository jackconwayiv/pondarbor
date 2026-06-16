# Google Maps setup (post-deploy)

The Recommendations app uses Google Maps for the cross-category map view and (optionally) Places autocomplete.

1. Create or select a GCP project.
2. Enable **Maps Static API** (Places map pins), **Maps Embed API**, and optionally **Maps JavaScript API** and **Places API (New)**.
3. Create an API key; restrict by HTTP referrer (`localhost:*`, your production domain).
4. Set billing alerts (e.g. $1) — free tier per-SKU caps apply ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)).
5. Add to env:
   - Frontend: `VITE_GOOGLE_MAPS_API_KEY`
   - Backend (optional geocode): `GOOGLE_MAPS_SERVER_API_KEY`

Without a key, list/detail still work; the map page shows a geo entry list instead of an embedded map.
