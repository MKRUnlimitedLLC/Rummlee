import { CITIES, NEIGHBORHOODS } from "./constants.ts";

/** Sample neighborhoods we can measure. Distance copy reads this same table. */
export const SAMPLE_POINT: Record<string, [number, number]> = {
  "Park Slope, Brooklyn": [40.671, -73.977],
  "Silver Lake, Los Angeles": [34.087, -118.27],
  "Pasadena, Los Angeles": [34.147, -118.144],
  "East Austin, Austin": [30.263, -97.72],
  "Lincoln Park, Chicago": [41.921, -87.647],
  "Naperville, Chicago": [41.75, -88.153],
  "Capitol Hill, Seattle": [47.625, -122.322],
  "Decatur, Atlanta": [33.775, -84.296],
  "LoHi, Denver": [39.759, -105.011],
  "Bethesda, DC": [38.984, -77.095],
  "Arlington, DC": [38.88, -77.106],
  "Plano, Dallas": [33.019, -96.698],
  "Cambridge, Boston": [42.374, -71.11],
  "Brookline, Boston": [42.332, -71.121],
  "Scottsdale, Phoenix": [33.494, -111.926],
  "West Fargo, Fargo–Moorhead": [46.877, -96.9],
  "Uptown, Minneapolis": [44.948, -93.298],
};

/** Samples count as near the viewer only inside this radius. */
export const SAMPLE_LOCAL_MILES = 40;

function cityOf(neighborhood: string) {
  const i = neighborhood.lastIndexOf(",");
  return i === -1 ? neighborhood : neighborhood.slice(i + 1).trim();
}

function milesBetween(a: [number, number], b: [number, number]) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Nearest sample city, or null when the viewer is not near one. Does not invent a city. */
export function nearestSampleCity(lat: number, lng: number, maxMiles = SAMPLE_LOCAL_MILES) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let bestCity: string | null = null;
  let bestMiles = Infinity;
  for (const [neighborhood, point] of Object.entries(SAMPLE_POINT)) {
    const miles = milesBetween(point, [lat, lng]);
    if (miles < bestMiles) {
      bestMiles = miles;
      bestCity = cityOf(neighborhood);
    }
  }
  if (!bestCity || bestMiles > maxMiles) return null;
  return bestCity;
}

/** A saved browse city is one we already use for samples. Anything else is not a place we list. */
export function isListedCity(value: string) {
  return (CITIES as readonly string[]).includes(value);
}

/**
 * Places that match a search. Empty until the query is long enough that this
 * cannot dump the whole city catalog.
 */
export function placeSuggestions(query: string, limit = 6) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: string[] = [];
  for (const neighborhood of NEIGHBORHOODS) {
    const city = cityOf(neighborhood).toLowerCase();
    if (neighborhood.toLowerCase().includes(q) || city.includes(q)) hits.push(neighborhood);
    if (hits.length >= limit) break;
  }
  return hits;
}

export function listingInPlace(neighborhood: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return neighborhood.toLowerCase().includes(q) || cityOf(neighborhood).toLowerCase().includes(q);
}

/** City name when the query is exactly a sample city or neighborhood. Partials do not count. */
export function cityForQuery(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const city = CITIES.find((item) => item.toLowerCase() === q);
  if (city) return city;
  const neighborhood = NEIGHBORHOODS.find((item) => item.toLowerCase() === q);
  return neighborhood ? cityOf(neighborhood) : null;
}
