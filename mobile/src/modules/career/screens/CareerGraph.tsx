import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
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

  const coords = points.map((v, i) => `${xScale(i)},${yScale(v)}`);
  const areaPath = `M${xScale(0)},${yScale(0)} ${coords.map((c, i) => (i === 0 ? '' : `L${c}`)).join(' ')} L${xScale(points.length - 1)},${PAD.top + CHART_H} L${xScale(0)},${PAD.top + CHART_H} Z`;

  const linePath = coords.map((c, i) => (i === 0 ? `M${c}` : `L${c}`)).join(' ');

  const baselineY = yScale(0);
  const upperPath = points.reduce<string[]>(
    (acc, v, i) => {
      const y = yScale(v);
      if (i === 0) acc.push(`M${xScale(0)},${baselineY} L${xScale(0)},${y}`);
      else acc.push(`L${xScale(i)},${y}`);
      return acc;
    },
    []
  );
  upperPath.push(`L${xScale(points.length - 1)},${baselineY} Z`);

  const lowerPath = points.reduce<string[]>(
    (acc, v, i) => {
      const y = yScale(v);
      if (i === 0) acc.push(`M${xScale(0)},${baselineY} L${xScale(0)},${y}`);
      else acc.push(`L${xScale(i)},${y}`);
      return acc;
    },
    []
  );
  lowerPath.push(`L${xScale(points.length - 1)},${baselineY} Z`);

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

        {/* Area fills — color segments between points */}
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

        {/* Line */}
        <Path d={linePath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" />

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
              {/* Labels every other point if too many */}
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
