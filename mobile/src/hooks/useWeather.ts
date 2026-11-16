/**
 * useWeather — one shared weather state for the app.
 *
 * Cached-first (instant paint), then a fresh reading on mount, on every
 * foreground, and every 30 minutes (the service itself reuses a reading for
 * three hours, so this is cheap). Every successful fetch re-pushes the widget
 * so its GPS fix + temperature are never left behind.
 *
 * The hook never throws — failures are exposed as `failure` so the UI can
 * offer "Enable location" / "Choose city" instead of showing a fake number.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  ensureLocationPermission,
  fetchWeatherForCity,
  getLastWeatherFailure,
  getWeather,
  setManualCity,
  type WeatherFailure,
  type WeatherNow,
} from '../services/weather';
import { pushSleepWidget } from '../services/sleepWidget';

const CHECK_EVERY_MS = 30 * 60 * 1000;

export interface WeatherViewController {
  weather: WeatherNow | null;
  failure: WeatherFailure | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  grantLocation: () => Promise<void>;
  useCity: (city: string) => Promise<boolean>;
}

export function useWeather(): WeatherViewController {
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [failure, setFailure] = useState<WeatherFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    try {
      const reading = await getWeather(force);
      if (!mounted.current) return;
      setWeather(reading);
      setFailure(getLastWeatherFailure());
      // A cached reading is still worth pushing to the widget (it may have
      // been installed after the reading was stored).
      if (reading) pushSleepWidget().catch(() => {});
    } catch {
      if (mounted.current) setFailure(getLastWeatherFailure() || 'no-data');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(false), CHECK_EVERY_MS);
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') load(true);
    };
    const subscription = AppState.addEventListener('change', onAppState);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const grantLocation = useCallback(async () => {
    const granted = await ensureLocationPermission();
    if (granted) await load(true);
    else if (mounted.current) setFailure('permission-denied');
  }, [load]);

  const useCity = useCallback(async (city: string) => {
    if (!city.trim()) return false;
    const reading = await fetchWeatherForCity(city);
    if (!reading) {
      if (mounted.current) setFailure(getLastWeatherFailure() || 'no-city');
      return false;
    }
    await setManualCity(city);
    if (mounted.current) {
      setWeather(reading);
      setFailure(null);
    }
    pushSleepWidget().catch(() => {});
    return true;
  }, []);

  return { weather, failure, loading, refreshing, refresh, grantLocation, useCity };
}

export default useWeather;
