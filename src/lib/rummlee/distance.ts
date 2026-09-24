import { placeName } from "./format";

const POINT: Record<string, [number, number]> = {
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

/** Street of the handoff spot. Shown only after someone pays. */
export const SPOT_ADDRESS: Record<string, string> = {
  "partner-slope": "400 7th Ave, Brooklyn",
  "partner-silverlake": "3000 Glendale Blvd, Los Angeles",
  "partner-austin": "1801 E 51st St, Austin",
  "partner-lincoln": "2400 N Clark St, Chicago",
  "partner-seattle": "500 E Pine St, Seattle",
  "partner-decatur": "150 E Ponce de Leon, Decatur",
  "partner-bethesda": "7101 Democracy Blvd, Bethesda",
  "partner-plano": "7200 Bishop Rd, Plano",
  "partner-harvard": "1 Broadway, Cambridge",
  "partner-scottsdale": "7373 E Camelback Rd, Scottsdale",
  "partner-denver": "1701 Boulder St, Denver",
  "partner-westfargo": "1300 13th Ave E, West Fargo",
  "partner-uptown": "3000 Hennepin Ave, Minneapolis",
  "public-meadows": "1850 Silver Lake Blvd, Los Angeles",
  "public-austin": "4550 Mueller Blvd, Austin",
  "public-lincoln": "2391 N Stockton Dr, Chicago",
  "public-calanderson": "1635 11th Ave, Seattle",
  "public-decatur": "509 N McDonough St, Decatur",
  "public-bethesda": "7400 Arlington Rd, Bethesda",
  "public-plano": "6701 W Parker Rd, Plano",
  "public-harvard": "449 Broadway, Cambridge",
  "public-scottsdale": "3939 N Drinkwater Blvd, Scottsdale",
  "public-naperville": "523 S Webster St, Naperville",
  "public-westfargo": "109 3rd St E, West Fargo",
  "public-uptown": "2800 E Lake of the Isles Pkwy, Minneapolis",
};

function milesBetween(a: [number, number], b: [number, number]) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function roughMiles(miles: number) {
  if (miles < 1.25) return "About a mile";
  if (miles < 10) return `About ${Math.max(2, Math.round(miles))} miles`;
  if (miles < 50) return `About ${Math.round(miles / 5) * 5} miles`;
  return `About ${Math.round(miles / 10) * 10} miles`;
}

/** Rough distance from the viewer’s neighborhood. Never a street. */
export function roughDistance(fromNeighborhood: string | null | undefined, toNeighborhood: string) {
  const there = placeName(toNeighborhood);
  const from = POINT[fromNeighborhood ?? ""];
  const to = POINT[toNeighborhood];
  if (!from || !to) return `In ${there}`;
  return `${roughMiles(milesBetween(from, to))} · ${there}`;
}

/** Official partner stores. Used only to check “close,” then thrown away. */
export const PARTNER_POINT: Record<string, [number, number]> = {
  "partner-slope": [40.668, -73.98],
  "partner-silverlake": [34.098, -118.26],
  "partner-austin": [30.305, -97.72],
  "partner-lincoln": [41.926, -87.648],
  "partner-seattle": [47.615, -122.322],
  "partner-decatur": [33.775, -84.296],
  "partner-bethesda": [39.022, -77.146],
  "partner-plano": [33.019, -96.698],
  "partner-harvard": [42.363, -71.084],
  "partner-scottsdale": [33.502, -111.929],
  "partner-denver": [39.759, -105.011],
  "partner-westfargo": [46.877, -96.9],
  "partner-uptown": [44.948, -93.298],
};

export const STORE_CLOSE_MILES = 0.4;

export function milesFromStore(spotId: string, lat: number, lng: number) {
  const point = PARTNER_POINT[spotId];
  if (!point || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return milesBetween(point, [lat, lng]);
}
