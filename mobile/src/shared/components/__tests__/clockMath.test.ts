/**
 * clockMath — the round clock maths.
 */
import {
  angleForHourHand,
  angleForHours,
  angleForMinutes,
  formatClock,
  hour12From24,
  hours24From,
  hoursFromAngle,
  minutesFromAngle,
  nearestEquivalent,
  normalizeAngle,
  periodFrom24,
} from '../clockMath';

describe('normalizeAngle', () => {
  it('wraps into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-10)).toBe(350);
    expect(normalizeAngle(-370)).toBe(350);
  });
});

describe('the angles of the values', () => {
  it('puts 12 o\'clock straight up', () => {
    expect(angleForHours(0)).toBe(0);
    expect(angleForMinutes(0)).toBe(0);
  });

  it('spreads the hours 30° apart', () => {
    expect(angleForHours(3)).toBe(90);
    expect(angleForHours(6)).toBe(180);
    expect(angleForHours(9)).toBe(270);
  });

  it('spreads the minutes 6° apart', () => {
    expect(angleForMinutes(15)).toBe(90);
    expect(angleForMinutes(30)).toBe(180);
    expect(angleForMinutes(45)).toBe(270);
  });

  it('lets the hour hand creep forward with the minutes', () => {
    expect(angleForHourHand(0, 0)).toBe(0);
    // 30 minutes = half an hour = 15°
    expect(angleForHourHand(0, 30)).toBe(15);
    expect(angleForHourHand(3, 0)).toBe(90);
  });
});

describe('the values under an angle', () => {
  it('reads the hour back', () => {
    expect(hoursFromAngle(0)).toBe(0);
    expect(hoursFromAngle(29)).toBe(1);
    expect(hoursFromAngle(90)).toBe(3);
    expect(hoursFromAngle(359)).toBe(0);
  });

  it('reads the minute back — every single minute', () => {
    expect(minutesFromAngle(0)).toBe(0);
    expect(minutesFromAngle(6)).toBe(1);
    expect(minutesFromAngle(90)).toBe(15);
    expect(minutesFromAngle(180)).toBe(30);
    expect(minutesFromAngle(359)).toBe(0);
    // The old picker could only reach 5-minute steps.
    expect(minutesFromAngle(42)).toBe(7);
  });

  it('round-trips every minute of the hour', () => {
    for (let m = 0; m < 60; m++) {
      expect(minutesFromAngle(angleForMinutes(m))).toBe(m);
    }
  });

  it('round-trips every hour', () => {
    for (let h = 0; h < 12; h++) {
      expect(hoursFromAngle(angleForHours(h))).toBe(h);
    }
  });
});

describe('nearestEquivalent', () => {
  it('takes the short way round', () => {
    // 350° → 10° is +20°, not -340°.
    expect(nearestEquivalent(10, 350)).toBe(370);
    expect(nearestEquivalent(350, 10)).toBe(-10);
    expect(nearestEquivalent(90, 90)).toBe(90);
  });
});

describe('12 / 24 hour helpers', () => {
  it('converts the hour', () => {
    expect(hour12From24(0)).toBe(0);
    expect(hour12From24(9)).toBe(9);
    expect(hour12From24(12)).toBe(0);
    expect(hour12From24(23)).toBe(11);
  });

  it('reads the period', () => {
    expect(periodFrom24(0)).toBe('AM');
    expect(periodFrom24(11)).toBe('AM');
    expect(periodFrom24(12)).toBe('PM');
    expect(periodFrom24(23)).toBe('PM');
  });

  it('goes back to 24h', () => {
    expect(hours24From(0, 'AM')).toBe(0);
    expect(hours24From(0, 'PM')).toBe(12);
    expect(hours24From(9, 'PM')).toBe(21);
    expect(hours24From(9, 'AM')).toBe(9);
  });

  it('formats the clock', () => {
    expect(formatClock(9, 30)).toBe('9:30 AM');
    expect(formatClock(21, 5)).toBe('9:05 PM');
    expect(formatClock(0, 0)).toBe('12:00 AM');
    expect(formatClock(12, 0)).toBe('12:00 PM');
  });
});
