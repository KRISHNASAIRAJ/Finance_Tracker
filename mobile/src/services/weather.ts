/**
 * weather — the live weather from Open-Meteo (free, no API key, no signup).
 *
 * The location comes from the phone's GPS (expo-location). The coordinates
 * are rounded to 2 decimals (~1 km) — good enough for a forecast and it keeps
 * the exact position private. If the location permission is denied the app
 * falls back to a manually picked city (Open-Meteo geocoding) and then to the
 * last cached reading.
 *
 * Degrades gracefully: on iOS / Expo Go (no native module) every call returns
 * the cached value or null — never throws.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeatherIcon = 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';

export interface WeatherNow {
  /** The current temperature in °C. */
  tempC: number;
  /** The "feels like" temperature in °C. */
  feelsLikeC: number;
  /** The relative humidity in %. */
  humidity: number;
  /** "Partly cloudy" — the human readable condition. */
  condition: string;
  /** The icon that matches the condition. */
  icon: WeatherIcon;
  /** Day or night at the location. */
  isDay: boolean;
  /** The daily low in °C. */
  minC: number;
  /** The daily high in °C. */
  maxC: number;
  /** The chance of precipitation in %. */
  precipChance: number;
  /** The rounded latitude. */
  lat: number;
  /** The rounded longitude. */
  lon: number;
  /** A short place name ("Bengaluru") — empty when unknown. */
  placeName: string;
  /** When this reading was fetched (epoch ms). */
  fetchedAt: number;
}

const CACHE_KEY = 'meridian_weather_cache';
const CITY_KEY = 'meridian_weather_city';
const POSITION_KEY = 'meridian_weather_position';
/** A fresh reading is reused for an hour. */
const FRESH_MS = 60 * 60 * 1000;
/** The cached reading is still shown as a fallback for a day. */
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
/** A GPS fix is never awaited for longer than this. */
const LOCATION_TIMEOUT_MS = 10 * 1000;
/** A cached position is good enough for half an hour. */
const POSITION_MAX_AGE_MS = 30 * 60 * 1000;
/** The network call never waits longer than this. */
const FORECAST_TIMEOUT_MS = 8 * 1000;

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * The WMO weather codes → a label and an icon.
 * https://open-meteo.com/en/docs
 */
export function weatherCodeToLabel(code: number): { label: string; icon: WeatherIcon } {
  const raw = Number(code);
  // An unknown reading is "cloudy", never "clear sky".
  if (!Number.isFinite(raw)) return { label: 'Cloudy', icon: 'cloud' };
  const c = Math.round(raw);
  // The WMO codes run from 0 to 99 — anything else is unknown.
  if (c < 0 || c > 99) return { label: 'Cloudy', icon: 'cloud' };
  if (c === 0) return { label: 'Clear sky', icon: 'sun' };
  if (c === 1) return { label: 'Mainly clear', icon: 'sun' };
  if (c === 2) return { label: 'Partly cloudy', icon: 'cloud' };
  if (c === 3) return { label: 'Overcast', icon: 'cloud' };
  if (c === 45 || c === 48) return { label: 'Fog', icon: 'cloud' };
  if (c >= 51 && c <= 57) return { label: 'Drizzle', icon: 'rain' };
  if (c >= 61 && c <= 67) return { label: 'Rain', icon: 'rain' };
  if (c >= 71 && c <= 77) return { label: 'Snow', icon: 'snow' };
  if (c >= 80 && c <= 82) return { label: 'Showers', icon: 'rain' };
  if (c === 85 || c === 86) return { label: 'Snow showers', icon: 'snow' };
  if (c >= 95) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Cloudy', icon: 'cloud' };
}

/** "28°" — the temperature the widgets and the home card show. */
export function formatTemp(tempC: number): string {
  if (!Number.isFinite(tempC)) return '—';
  return `${Math.round(tempC)}°`;
}

async function readCache(): Promise<WeatherNow | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherNow;
    if (!parsed || typeof parsed.tempC !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(weather: WeatherNow): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(weather));
  } catch {
    /* best-effort */
  }
}

/**
 * The last reading — no GPS, no network. The widget paints with it right
 * away and refreshes in the background, so the weather never holds the
 * widget (or the app) up.
 */
export async function getCachedWeather(): Promise<WeatherNow | null> {
  return await readCache();
}

/** The manually picked city (the fallback when there is no GPS). */
export async function getManualCity(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(CITY_KEY)) || '';
  } catch {
    return '';
  }
}

export async function setManualCity(city: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CITY_KEY, city.trim());
  } catch {
    /* best-effort */
  }
}

/** A position (rounded to ~1 km) with the time it was taken. */
interface StoredPosition {
  lat: number;
  lon: number;
  at: number;
}

/** The shape of a position we care about (the expo-location object). */
type PositionLike =
  | { coords?: { latitude?: number; longitude?: number } | null }
  | null
  | undefined;

/** Round the coordinates to ~1 km — good enough for a forecast. */
function roundCoords(coords?: {
  latitude?: number;
  longitude?: number;
} | null): { lat: number; lon: number } | null {
  const lat = Number(coords?.latitude);
  const lon = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

async function readPositionCache(): Promise<{ lat: number; lon: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPosition;
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
    if (Date.now() - Number(parsed.at) > POSITION_MAX_AGE_MS) return null;
    return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    return null;
  }
}

async function writePositionCache(pos: { lat: number; lon: number }): Promise<void> {
  try {
    const stored: StoredPosition = { lat: pos.lat, lon: pos.lon, at: Date.now() };
    await AsyncStorage.setItem(POSITION_KEY, JSON.stringify(stored));
  } catch {
    /* best-effort */
  }
}

/**
 * Resolve a promise, but never wait longer than `ms`.
 *
 * The weather must never hold the app up — a slow GPS or a slow network has
 * to fall back to the cached values instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/**
 * The GPS position (rounded to ~1 km), or null when it is not available.
 *
 * The order matters — the user must never wait minutes for the weather:
 *   1. the LAST KNOWN position (instant, no GPS lock needed)
 *   2. a fresh fix, but never longer than 10 s
 *   3. the position cached 30 minutes ago
 */
async function getGpsPosition(): Promise<{ lat: number; lon: number } | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    // Lazy require: the module is missing in Expo Go / on a build without it.
    const { Location } = require('expo-location');
    // Only ask for the permission when it is not granted yet.
    let status = (await Location.getForegroundPermissionsAsync())?.status;
    if (status !== 'granted') {
      status = (await Location.requestForegroundPermissionsAsync())?.status;
    }
    if (status !== 'granted') return await readPositionCache();

    // 1. The last known position — instant.
    try {
      const last = await withTimeout<PositionLike>(
        Location.getLastKnownPositionAsync({
          maxAge: POSITION_MAX_AGE_MS,
          requiredAccuracy: 2000,
        }),
        3000
      );
      const rounded = roundCoords(last?.coords);
      if (rounded) {
        await writePositionCache(rounded);
        return rounded;
      }
    } catch {
      /* no last known position */
    }

    // 2. A fresh fix — but never longer than 10 s.
    const fresh = await withTimeout<PositionLike>(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      LOCATION_TIMEOUT_MS
    );
    const rounded = roundCoords(fresh?.coords);
    if (rounded) {
      await writePositionCache(rounded);
      return rounded;
    }

    // 3. The cached position.
    return await readPositionCache();
  } catch {
    return await readPositionCache();
  }
}

/** Look the coordinates up in the Open-Meteo geocoder (for the manual city). */
async function geocodeCity(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  if (!city) return null;
  try {
    const url = `${OPEN_METEO_GEOCODE}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await withTimeout(fetch(url), FORECAST_TIMEOUT_MS);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const hit = json?.results?.[0];
    if (!hit) return null;
    return {
      lat: Math.round(Number(hit.latitude) * 100) / 100,
      lon: Math.round(Number(hit.longitude) * 100) / 100,
      name: hit.name || city,
    };
  } catch {
    return null;
  }
}

/** The forecast for the given coordinates. */
async function fetchForecast(
  lat: number,
  lon: number,
  placeName: string
): Promise<WeatherNow | null> {
  try {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day',
      'daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      'timezone=auto',
      'forecast_days=1',
    ].join('&');
    const res = await withTimeout(
      fetch(`${OPEN_METEO_FORECAST}?${params}`),
      FORECAST_TIMEOUT_MS
    );
    if (!res || !res.ok) return null;
    const json = await res.json();
    const current = json?.current;
    if (!current) return null;
    const daily = json?.daily || {};
    const { label, icon } = weatherCodeToLabel(current.weather_code);
    return {
      tempC: Number(current.temperature_2m) || 0,
      feelsLikeC: Number(current.apparent_temperature) || 0,
      humidity: Number(current.relative_humidity_2m) || 0,
      condition: label,
      icon,
      isDay: current.is_day === 1 || current.is_day === true,
      minC: Number(daily.temperature_2m_max?.[0] ?? daily.temperature_2m_min?.[0] ?? 0),
      maxC: Number(daily.temperature_2m_max?.[0] ?? 0),
      precipChance: Number(daily.precipitation_probability_max?.[0] ?? 0),
      lat,
      lon,
      placeName,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * The current weather.
 *
 * The order: a fresh reading (GPS → the manual city) → the cached reading
 * (up to a day old) → null.
 */
export async function getWeather(force = false): Promise<WeatherNow | null> {
  const cached = await readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;

  // 1. The GPS.
  const gps = await getGpsPosition();
  if (gps) {
    const weather = await fetchForecast(gps.lat, gps.lon, cached?.placeName || '');
    if (weather) {
      await writeCache(weather);
      return weather;
    }
  }

  // 2. The manually picked city.
  const city = await getManualCity();
  if (city) {
    const hit = await geocodeCity(city);
    if (hit) {
      const weather = await fetchForecast(hit.lat, hit.lon, hit.name);
      if (weather) {
        await writeCache(weather);
        return weather;
      }
    }
  }

  // 3. The last known reading (up to a day old).
  if (cached && Date.now() - cached.fetchedAt < STALE_MAX_MS) return cached;
  return null;
}

/** The one-line summary the home card and the widget show. */
export function weatherSummary(weather: WeatherNow | null): string {
  if (!weather) return '—';
  const range = weather.maxC > weather.minC
    ? ` · ${formatTemp(weather.minC)}/${formatTemp(weather.maxC)}`
    : '';
  return `${formatTemp(weather.tempC)}${range}`;
}
