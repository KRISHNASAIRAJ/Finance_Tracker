/**
 * CareerGraph — SVG line chart rendering career event trends over time.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { CareerEvent } from '../store';
import { colors } from '../../../shared/theme/colors';

interface Props {
  events: CareerEvent[];
}

const WIDTH = Dimensions.get('window').width - 80;
const HEIGHT = 160;
const PAD = { top: 10, right: 20, bottom: 30, left: 10 };
const CHART_W = WIDTH - PAD.left - PAD.right;
const CHART_H = HEIGHT - PAD.top - PAD.bottom;

function catmullRomToBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): string {
  const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
  const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
  const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
  const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
  return `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
}

export default function CareerGraph({ events }: Props) {
  if (events.length < 2) return null;

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const values = sorted.map((e) => (e.type === 'up' ? 1 : e.type === 'down' ? -1 : 0));

  let cumulative = 0;
  const points = values.map((v) => {
    cumulative += v;
    return cumulative;
  });

  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const range = max - min || 1;

  const xScale = (i: number) => PAD.left + (i / (points.length - 1)) * CHART_W;
  const yScale = (v: number) => PAD.top + CHART_H - ((v - min) / range) * CHART_H;

  const coords: [number, number][] = points.map((v, i) => [xScale(i), yScale(v)]);

  function buildSmoothPath(data: [number, number][]): string {
    if (data.length === 1) return `M${data[0][0]},${data[0][1]}`;
    if (data.length === 2) return `M${data[0][0]},${data[0][1]} L${data[1][0]},${data[1][1]}`;

    let path = `M${data[0][0]},${data[0][1]}`;

    const extended: [number, number][] = [
      [data[0][0] - (data[1][0] - data[0][0]), data[0][1] - (data[1][1] - data[0][1])],
      ...data,
      [data[data.length - 1][0] + (data[data.length - 1][0] - data[data.length - 2][0]),
       data[data.length - 1][1] + (data[data.length - 1][1] - data[data.length - 2][1])],
    ];

    for (let i = 1; i < extended.length - 2; i++) {
      path += ` ${catmullRomToBezier(extended[i - 1], extended[i], extended[i + 1], extended[i + 2])}`;
    }

    return path;
  }

  const smoothLinePath = buildSmoothPath(coords);

  const baselineY = yScale(0);

  const dateLabels = sorted.map((e) => {
    const d = new Date(e.date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  return (
    <View style={styles.wrapper}>
      <Svg width={WIDTH} height={HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.success} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.success} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="areaRedGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.error} stopOpacity={0.25} />
            <Stop offset="1" stopColor={colors.error} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Baseline */}
        <Line
          x1={PAD.left}
          y1={baselineY}
          x2={PAD.left + CHART_W}
          y2={baselineY}
          stroke={colors.border}
          strokeWidth={StyleSheet.hairlineWidth}
          strokeDasharray="4,4"
        />

        {/* Area fill under the curve — colored segments */}
        {points.map((v, i) => {
          if (i === 0) return null;
          const prevV = points[i - 1];
          const x1 = xScale(i - 1);
          const x2 = xScale(i);
          const y1 = yScale(v);
          const y2 = yScale(prevV);
          const isUp = v > prevV || (v === prevV && v > 0);
          const isDown = v < prevV || (v === prevV && v < 0);
          const fillColor = isUp ? colors.success : isDown ? colors.error : colors.border;

          return (
            <Path
              key={i}
              d={`M${x1},${baselineY} L${x1},${y2} L${x2},${y1} L${x2},${baselineY} Z`}
              fill={fillColor}
              opacity={0.25}
            />
          );
        })}

        {/* Smooth curve line */}
        <Path d={smoothLinePath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((v, i) => {
          const dotColor =
            sorted[i].type === 'up'
              ? colors.success
              : sorted[i].type === 'down'
                ? colors.error
                : colors.secondary;
          return (
            <React.Fragment key={i}>
              <Circle cx={xScale(i)} cy={yScale(v)} r={5} fill={dotColor} stroke={colors.background} strokeWidth={1.5} />
              {(points.length <= 8 || i % 2 === 0 || i === points.length - 1) && (
                <SvgText
                  key={`l${i}`}
                  x={xScale(i)}
                  y={HEIGHT - 4}
                  fontSize={9}
                  fill={colors.onSurfaceVariant}
                  textAnchor="middle"
                >
                  {dateLabels[i]}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
});
