import { View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { formatCompact } from '@/domain/money';
import { useColors } from '@/theme/ThemeProvider';

import { useReveal } from './motion';
import { Txt } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function DonutSegment({
  progress,
  cx,
  r,
  thickness,
  color,
  start,
  len,
  gap,
  circumference,
}: {
  progress: SharedValue<number>;
  cx: number;
  r: number;
  thickness: number;
  color: string;
  start: number;
  len: number;
  gap: number;
  circumference: number;
}) {
  // Segments fan out clockwise from 12 o'clock into their final position.
  const animatedProps = useAnimatedProps(() => ({
    // Dash patterns start at 3 o'clock; shift by a quarter turn to start at 12.
    strokeDashoffset: circumference / 4 - start * progress.value,
    strokeOpacity: Math.min(1, progress.value * 2),
  }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cx}
      r={r}
      stroke={color}
      strokeWidth={thickness}
      fill="none"
      // Pattern period must equal the circumference so the part shifted before the path start wraps around.
      strokeDasharray={`${Math.max(0, len - gap)} ${circumference - Math.max(0, len - gap)}`}
      animatedProps={animatedProps}
    />
  );
}

export function DonutChart({
  data,
  size = 180,
  thickness = 24,
  centerTitle,
  centerValue,
}: {
  data: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerValue?: string;
}) {
  const c = useColors();
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  const gap = data.length > 1 ? 3 : 0;
  const progress = useReveal(900, [data.map((d) => d.value).join(',')]);

  let start = 0;
  const segments = data.map((d) => {
    const len = total > 0 ? (d.value / total) * circumference : 0;
    const seg = { ...d, start, len };
    start += len;
    return seg;
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.cardAlt} strokeWidth={thickness} fill="none" />
        {segments.map((s, i) => (
          <DonutSegment key={i} progress={progress} cx={size / 2} r={r} thickness={thickness} color={s.color} start={s.start} len={s.len} gap={gap} circumference={circumference} />
        ))}
      </Svg>
      {centerTitle && <Txt variant="small">{centerTitle}</Txt>}
      {centerValue && <Txt variant="h2" style={{ fontSize: 20 }}>{centerValue}</Txt>}
    </View>
  );
}

function Bar({ progress, x, baseY, h, width, color }: { progress: SharedValue<number>; x: number; baseY: number; h: number; width: number; color: string }) {
  const animatedProps = useAnimatedProps(() => ({ y: baseY - h * progress.value, height: h * progress.value }));
  return <AnimatedRect x={x} width={width} rx={Math.min(4, width / 2)} fill={color} animatedProps={animatedProps} />;
}

export function BarChart({
  buckets,
  width,
  height = 190,
}: {
  buckets: { label: string; income: number; expense: number }[];
  width: number;
  height?: number;
}) {
  const c = useColors();
  const top = 12;
  const bottom = 24;
  const left = 40;
  const chartH = height - top - bottom;
  const chartW = Math.max(0, width - left);
  const max = Math.max(1, ...buckets.flatMap((b) => [b.income, b.expense]));
  const groupW = chartW / Math.max(1, buckets.length);
  const barW = Math.max(4, Math.min(14, groupW / 3.2));
  const baseY = top + chartH;
  const progress = useReveal(800, [buckets.map((b) => `${b.income}:${b.expense}`).join(',')]);

  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((t) => {
        const y = top + chartH * (1 - t);
        return (
          <G key={t}>
            <Line x1={left} x2={width} y1={y} y2={y} stroke={c.border} strokeWidth={1} strokeDasharray={t === 0 ? undefined : '4 4'} />
            <SvgText x={left - 8} y={y + 4} fontSize={10} fill={c.textMuted} textAnchor="end">
              {formatCompact(max * t)}
            </SvgText>
          </G>
        );
      })}
      {buckets.map((b, i) => {
        const cx = left + groupW * i + groupW / 2;
        return (
          <G key={b.label + i}>
            <Bar progress={progress} x={cx - barW - 1.5} baseY={baseY} h={(b.income / max) * chartH} width={barW} color={c.income} />
            <Bar progress={progress} x={cx + 1.5} baseY={baseY} h={(b.expense / max) * chartH} width={barW} color={c.expense} />
            <SvgText x={cx} y={height - 6} fontSize={10.5} fill={c.textMuted} textAnchor="middle">
              {b.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
