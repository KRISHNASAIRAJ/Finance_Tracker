/**
 * weather — the live fetch path (GPS, permission, cache and failures).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Location } from 'expo-location';

import {
  clearWeatherCache,
  getLastWeatherFailure,
  getWeather,
  fetchWeatherForCity,
  type WeatherNow,
} from '../weather';

jest.mock('expo-location', () => ({
  Location: {
    getForegroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    getProviderStatusAsync: jest.fn(),
    getLastKnownPositionAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
    Accuracy: { Balanced: 3 },
  },
}));

const loc = Location as unknown as {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  getProviderStatusAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

const forecast = (overrides: Record<string, unknown> = {}) => ({
  current: {
    temperature_2m: 28.4,
    apparent_temperature: 30.1,
    relative_humidity_2m: 62,
    weather_code: 2,
    is_day: 1,
  },
  daily: {
    temperature_2m_min: [21],
    temperature_2m_max: [33],
    precipitation_probability_max: [10],
  },
  ...overrides,
});

function mockFetchForecast(body: unknown = forecast(), ok = true) {
  (global.fetch as unknown as jest.Mock) = jest.fn(async (url: string) => ({
    ok,
    json: async () => (url.includes('geocoding') ? { results: [{ latitude: 12.97, longitude: 77.59, name: 'Bengaluru' }] } : body),
  }));
}

function grantGps(lat = 12.97, lon = 77.59) {
  loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  loc.getProviderStatusAsync.mockResolvedValue({ locationServicesEnabled: true });
  loc.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: lat, longitude: lon } });
  loc.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: lat, longitude: lon } });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  grantGps();
  mockFetchForecast();
});

describe('getWeather', () => {
  it('reuses a fresh reading without touching the network', async () => {
    const cached: WeatherNow = {
      tempC: 26, feelsLikeC: 27, humidity: 50, condition: 'Clear sky', icon: 'sun',
      isDay: true, minC: 20, maxC: 30, precipChance: 0, lat: 12.97, lon: 77.59,
      placeName: 'Bengaluru', fetchedAt: Date.now(),
    };
    await AsyncStorage.setItem('meridian_weather_cache', JSON.stringify(cached));
    const result = await getWeather();
    expect(result?.tempC).toBe(26);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('force refresh bypasses the cache and fetches from GPS', async () => {
    await AsyncStorage.setItem('meridian_weather_cache', JSON.stringify({
      tempC: 26, fetchedAt: Date.now(),
    }));
    const result = await getWeather(true);
    expect(result?.tempC).toBe(28.4);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getLastWeatherFailure()).toBeNull();
  });

  it('takes min/max from the right daily arrays', async () => {
    const result = await getWeather(true);
    expect(result?.minC).toBe(21);
    expect(result?.maxC).toBe(33);
  });

  it('rejects a bogus temperature instead of inventing a reading', async () => {
    mockFetchForecast(forecast({ current: { temperature_2m: null } }));
    const result = await getWeather(true);
    expect(result).toBeNull();
    expect(getLastWeatherFailure()).toBe('network-error');
  });

  it('reports a denied permission and offers no fake number', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const result = await getWeather(true);
    expect(result).toBeNull();
    expect(getLastWeatherFailure()).toBe('permission-denied');
  });

  it('falls back to a manually picked city when GPS is denied', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await AsyncStorage.setItem('meridian_weather_city', 'Bengaluru');
    const result = await getWeather(true);
    expect(result?.placeName).toBe('Bengaluru');
    expect(getLastWeatherFailure()).toBeNull();
  });

  it('fetchWeatherForCity stores a city reading for later', async () => {
    const result = await fetchWeatherForCity('Bengaluru');
    expect(result?.tempC).toBe(28.4);
    const cached = await AsyncStorage.getItem('meridian_weather_cache');
    expect(JSON.parse(cached!).tempC).toBe(28.4);
  });

  it('clearWeatherCache removes the stored reading', async () => {
    await AsyncStorage.setItem('meridian_weather_cache', JSON.stringify({ tempC: 26 }));
    await clearWeatherCache();
    expect(await AsyncStorage.getItem('meridian_weather_cache')).toBeNull();
  });
});
