/**
 * chartMath — small helpers shared by the SVG charts.
 *
 * Pure functions, no React, so they are easy to reason about (and to test).
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A Catmull-Rom style smooth path through the points.
 *
 * The reference design draws soft, rounded trend lines rather than hard
 * polylines, so every chart uses this.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${round(points[0].x)},${round(points[0].y)}`;
  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${round(cp1x)},${round(cp1y)} ${round(cp2x)},${round(cp2y)} ${round(p2.x)},${round(p2.y)}`;
  }
  return d;
}

/** A straight polyline path (used where a hard line reads better). */
export function linePath(points: Point[]): string {
  if (points.length === 0) return '';
  return (
    'M' + points.map((p) => `${round(p.x)},${round(p.y)}`).join(' L')
  );
}

/**
 * An estimate of the drawn length of a smooth path.
 *
 * Used as a fallback when the platform cannot report the real path length.
 */
export function estimateLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.max(1, total);
}

/** Map a series of values into chart points. */
export function toPoints(
  values: number[],
  width: number,
  height: number,
  paddingTop = 6,
  paddingBottom = 6,
): Point[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerH = Math.max(1, height - paddingTop - paddingBottom);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length > 1 ? i * stepX : width / 2,
    y: paddingTop + innerH - ((v - min) / span) * innerH,
  }));
}

/** The value at a given y (inverse of `toPoints`). */
export function valueAtY(
  y: number,
  height: number,
  min: number,
  max: number,
  paddingTop = 6,
  paddingBottom = 6,
): number {
  const innerH = Math.max(1, height - paddingTop - paddingBottom);
  const ratio = (paddingTop + innerH - y) / innerH;
  return min + ratio * (max - min);
}

/** Two decimals, no trailing noise. */
export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
