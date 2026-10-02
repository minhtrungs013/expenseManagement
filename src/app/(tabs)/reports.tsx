import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BarChart, DonutChart } from '@/components/charts';
import { AnimatedMoney, MonthSwitcher } from '@/components/finance';
import { Appear } from '@/components/motion';
import { Body, Card, CategoryIcon, Divider, EmptyState, IconBadge, Row, SectionHeader, Segmented, Skeleton, surface, TabScreen, Txt } from '@/components/ui';
import { expensesByCategory, summarize, trend, type Granularity } from '@/domain/calc';
import { monthRange, today } from '@/domain/dates';
import { formatCompact, formatMoney } from '@/domain/money';
import { useData } from '@/state/DataProvider';
import { useColors } from '@/theme/ThemeProvider';

const GRANULARITY: { value: Granularity; label: string; count: number }[] = [
  { value: 'week', label: 'Tuần', count: 8 },
  { value: 'month', label: 'Tháng', count: 6 },
  { value: 'year', label: 'Năm', count: 5 },
];

/** Shows at most this many categories in the donut; the rest are merged into "Còn lại". */
const MAX_SLICES = 6;

export default function ReportsScreen() {
  const c = useColors();
  const { ready, transactions, categoryById } = useData();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [chartWidth, setChartWidth] = useState(0);

  const range = useMemo(() => monthRange(ym.year, ym.month), [ym]);
  const summary = useMemo(() => summarize(transactions, range), [transactions, range]);
  const byCategory = useMemo(() => expensesByCategory(transactions, range), [transactions, range]);
  const buckets = useMemo(() => {
    const g = GRANULARITY.find((x) => x.value === granularity)!;
    return trend(transactions, granularity, today(), g.count);
  }, [transactions, granularity]);

  const slices = useMemo(() => {
    const top = byCategory.slice(0, MAX_SLICES).map((x) => {
      const cat = categoryById.get(x.categoryId);
      return { key: String(x.categoryId), name: cat?.name ?? '?', icon: cat?.icon ?? '📦', color: cat?.color ?? '#64748B', value: x.total };
    });
    const rest = byCategory.slice(MAX_SLICES).reduce((s, x) => s + x.total, 0);
    if (rest > 0) top.push({ key: 'rest', name: 'Còn lại', icon: '⋯', color: '#94A3B8', value: rest });
    return top;
  }, [byCategory, categoryById]);

  return (
    <TabScreen title="Báo cáo">
      <Body>
        <MonthSwitcher year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
        {!ready ? (
          <Skeleton height={160} count={3} />
        ) : (
          <>
            {/* Income vs expense + saving rate */}
            <Appear index={0}>
              <Row gap={10}>
                <StatTile icon="arrow-down" label="Thu nhập" value={summary.income} color={c.income} />
                <StatTile icon="arrow-up" label="Chi tiêu" value={summary.expense} color={c.expense} />
              </Row>
            </Appear>
            <Appear index={1}>
              <Card style={{ gap: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="muted">Chênh lệch</Txt>
                  <AnimatedMoney value={summary.net} signed style={{ fontWeight: '800', fontSize: 17 }} color={summary.net >= 0 ? c.income : c.expense} />
                </Row>
                <Divider />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="muted">Tỷ lệ tiết kiệm</Txt>
                  <Txt style={{ fontWeight: '800', fontSize: 17 }}>{summary.savingRate == null ? '—' : `${summary.savingRate.toFixed(1)}%`}</Txt>
                </Row>
              </Card>
            </Appear>

            <Appear index={2}>
              <SectionHeader title="Chi tiêu theo danh mục" />
              <Card style={{ marginTop: 10 }}>
                {slices.length === 0 ? (
                  <EmptyState icon="pie-chart-outline" title="Chưa có chi tiêu" message="Không có khoản chi nào trong tháng này." />
                ) : (
                  <View style={{ gap: 14 }}>
                    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                      <DonutChart data={slices} centerTitle="Tổng chi" centerValue={formatCompact(summary.expense)} />
                    </View>
                    {slices.map((s) => {
                      const pct = summary.expense > 0 ? (s.value / summary.expense) * 100 : 0;
                      return (
                        <View key={s.key} style={{ gap: 6 }}>
                          <Row gap={10}>
                            <CategoryIcon icon={s.icon} color={s.color} size={30} />
                            <Txt style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                              {s.name}
                            </Txt>
                            <Txt variant="small" style={{ fontWeight: '700' }}>
                              {Math.round(pct)}%
                            </Txt>
                            <Txt style={{ fontWeight: '700', minWidth: 104, textAlign: 'right' }}>{formatMoney(s.value)}</Txt>
                          </Row>
                          <ShareBar percent={pct} color={s.color} />
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            </Appear>

            <Appear index={3}>
              <SectionHeader title="Xu hướng thu chi" />
              <Card style={{ gap: 12, marginTop: 10 }}>
                <Segmented options={GRANULARITY} value={granularity} onChange={setGranularity} />
                <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                  {chartWidth > 0 && <BarChart buckets={buckets} width={chartWidth} />}
                </View>
                <Row style={{ justifyContent: 'center' }} gap={16}>
                  <Legend color={c.income} label="Thu" />
                  <Legend color={c.expense} label="Chi" />
                </Row>
              </Card>
            </Appear>
          </>
        )}
      </Body>
    </TabScreen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="small">{label}</Txt>
    </Row>
  );
}

function StatTile({ icon, label, value, color }: { icon: 'arrow-down' | 'arrow-up'; label: string; value: number; color: string }) {
  const c = useColors();
  return (
    <View style={[styles.tile, surface(c)]}>
      <Row gap={8}>
        <IconBadge name={icon} color={color} size={28} />
        <Txt variant="small" style={{ fontWeight: '600' }}>
          {label}
        </Txt>
      </Row>
      <AnimatedMoney value={value} color={color} style={{ fontWeight: '800', fontSize: 18, marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit />
    </View>
  );
}

/** Thin bar showing a category's share of total spending; grows in on mount. */
function ShareBar({ percent, color }: { percent: number; color: string }) {
  const c = useColors();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(percent, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [percent, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={[styles.shareTrack, { backgroundColor: c.cardAlt }]}>
      <Animated.View style={[styles.shareFill, { backgroundColor: color }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 20, padding: 14 },
  shareTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginLeft: 40 },
  shareFill: { height: '100%', borderRadius: 3 },
});
