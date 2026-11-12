/**
 * weather — the Open-Meteo weather codes.
 */
import { weatherCodeToLabel, formatTemp, weatherSummary } from '../weather';

describe('weatherCodeToLabel', () => {
  it('maps the WMO codes to a label and an icon', () => {
    expect(weatherCodeToLabel(0)).toEqual({ label: 'Clear sky', icon: 'sun' });
    expect(weatherCodeToLabel(1)).toEqual({ label: 'Mainly clear', icon: 'sun' });
    expect(weatherCodeToLabel(2)).toEqual({ label: 'Partly cloudy', icon: 'cloud' });
    expect(weatherCodeToLabel(3)).toEqual({ label: 'Overcast', icon: 'cloud' });
    expect(weatherCodeToLabel(45).icon).toBe('cloud');
    expect(weatherCodeToLabel(61).icon).toBe('rain');
    expect(weatherCodeToLabel(65).label).toBe('Rain');
    expect(weatherCodeToLabel(71).icon).toBe('snow');
    expect(weatherCodeToLabel(80).icon).toBe('rain');
    expect(weatherCodeToLabel(95).icon).toBe('storm');
    expect(weatherCodeToLabel(99).icon).toBe('storm');
  });

  it('falls back to something sane for an unknown code', () => {
    expect(weatherCodeToLabel(1234).icon).toBe('cloud');
    expect(weatherCodeToLabel(Number.NaN).label).toBe('Cloudy');
  });
});

describe('formatTemp', () => {
  it('rounds to a whole degree', () => {
    expect(formatTemp(28.4)).toBe('28°');
    expect(formatTemp(28.6)).toBe('29°');
    expect(formatTemp(Number.NaN)).toBe('—');
  });
});

describe('weatherSummary', () => {
  it('shows the temperature and the range', () => {
    const summary = weatherSummary({
      tempC: 28.4,
      feelsLikeC: 30,
      humidity: 60,
      condition: 'Partly cloudy',
      icon: 'cloud',
      isDay: true,
      minC: 21,
      maxC: 31,
      precipChance: 20,
      lat: 12.97,
      lon: 77.59,
      placeName: 'Bengaluru',
      fetchedAt: 0,
    });
    expect(summary).toBe('28° · 21°/31°');
  });

  it('is a dash without a reading', () => {
    expect(weatherSummary(null)).toBe('—');
  });
});
