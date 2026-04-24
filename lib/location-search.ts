import type { RoutePoint } from '@/lib/route-utils';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export type LocationSuggestion = {
  id: string;
  name: string;
  address: string;
  featureType: string;
  coordinates?: RoutePoint;
};

export type RetrievedLocation = {
  label: string;
  address: string;
  point: RoutePoint;
};

type NominatimItem = {
  place_id?: number;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  addresstype?: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    road?: string;
    house_number?: string;
  };
};

function buildSearchUrl(params: Record<string, string | null | undefined>) {
  const url = new URL(NOMINATIM_SEARCH_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}

function parsePoint(item: Pick<NominatimItem, 'lat' | 'lon'>) {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return {
    latitude,
    longitude,
  };
}

function buildPrimaryLabel(item: NominatimItem) {
  return (
    item.name ||
    item.address?.suburb ||
    item.address?.neighbourhood ||
    item.address?.quarter ||
    item.address?.city_district ||
    item.address?.city ||
    item.address?.town ||
    item.address?.village ||
    item.address?.municipality ||
    item.address?.road ||
    'Unnamed place'
  );
}

function buildSecondaryLabel(item: NominatimItem) {
  if (item.display_name) {
    return item.display_name;
  }

  const roadLabel = [item.address?.house_number, item.address?.road].filter(Boolean).join(' ').trim();

  return [
    roadLabel,
    item.address?.suburb || item.address?.neighbourhood || item.address?.quarter || item.address?.city_district,
    item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || item.address?.county,
    item.address?.state,
    item.address?.country,
  ]
    .filter(Boolean)
    .join(', ');
}

function mapItemToSuggestion(item: NominatimItem) {
  const stableId = String(item.osm_id ?? item.place_id ?? `${item.lat}-${item.lon}`);

  return {
    id: stableId,
    name: buildPrimaryLabel(item),
    address: buildSecondaryLabel(item),
    featureType: item.addresstype || item.type || 'place',
    coordinates: parsePoint(item),
  } satisfies LocationSuggestion;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function dedupeSuggestions(items: LocationSuggestion[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${normalizeText(item.name)}:${normalizeText(item.address)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function requestSearch(params: Record<string, string | null | undefined>) {
  const response = await fetch(
    buildSearchUrl({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
      'accept-language': 'en',
      ...params,
    }),
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Nominatim search request failed with ${response.status}`);
  }

  return (await response.json()) as NominatimItem[];
}

export function createSearchSessionToken() {
  return `dd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchLocationSuggestions(query: string, _sessionToken: string, origin?: RoutePoint, limit = 8) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const results = await requestSearch({
    q: trimmedQuery,
    countrycodes: 'tz',
    limit: String(limit),
    dedupe: '1',
    lat: origin ? String(origin.latitude) : null,
    lon: origin ? String(origin.longitude) : null,
  });

  return dedupeSuggestions(results.map(mapItemToSuggestion)).slice(0, limit);
}

export async function retrieveLocationSuggestion(
  suggestion: Pick<LocationSuggestion, 'name' | 'address'>,
  _sessionToken: string,
  origin?: RoutePoint
) {
  const results = await requestSearch({
    q: `${suggestion.name}, ${suggestion.address}`,
    countrycodes: 'tz',
    limit: '1',
    dedupe: '1',
    lat: origin ? String(origin.latitude) : null,
    lon: origin ? String(origin.longitude) : null,
  });

  const item = results[0];
  const point = item ? parsePoint(item) : undefined;
  if (!item || !point) {
    throw new Error('The selected destination could not be resolved.');
  }

  return {
    label: buildPrimaryLabel(item),
    address: buildSecondaryLabel(item),
    point,
  } satisfies RetrievedLocation;
}

export async function resolveTypedLocation(query: string, origin?: RoutePoint) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Enter a location first.');
  }

  const attempts = [
    {
      q: trimmedQuery,
      countrycodes: 'tz',
      limit: '1',
      dedupe: '1',
      lat: origin ? String(origin.latitude) : null,
      lon: origin ? String(origin.longitude) : null,
    },
    {
      q: trimmedQuery,
      limit: '1',
      dedupe: '1',
      lat: origin ? String(origin.latitude) : null,
      lon: origin ? String(origin.longitude) : null,
    },
  ];

  for (const params of attempts) {
    const item = (await requestSearch(params))[0];
    const point = item ? parsePoint(item) : undefined;
    if (!item || !point) {
      continue;
    }

    return {
      label: buildPrimaryLabel(item),
      address: buildSecondaryLabel(item),
      point,
      suggestion: mapItemToSuggestion(item),
    };
  }

  throw new Error('We could not match that location yet. Add an area, street, junction, building, or landmark.');
}
