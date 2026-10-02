import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMoney, MonthSwitcher } from '@/components/finance';
import { Appear } from '@/components/motion';
import { Body, Button, Card, CategoryIcon, EmptyState, IconButton, ProgressBar, Row, Skeleton, statusColor, statusLabel, TabScreen, Txt } from '@/components/ui';
import { budgetProgress, budgetStatus } from '@/domain/calc';
import { monthRange } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useData } from '@/state/DataProvider';
import { useColors } from '@/theme/ThemeProvider';

export default function BudgetsScreen() {
  const c = useColors();
  const { ready, budgets, transactions, categoryById } = useData();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const range = useMemo(() => monthRange(ym.year, ym.month), [ym]);

  const items = useMemo(() => budgets.map((b) => budgetProgress(b, transactions, range)).sort((a, b) => b.percent - a.percent), [budgets, transactions, range]);
  const totalLimit = items.reduce((s, p) => s + p.budget.amount, 0);
  const totalSpent = items.reduce((s, p) => s + p.spent, 0);
  const totalPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const left = totalLimit - totalSpent;

  return (
    <TabScreen title="Ngân sách" right={<IconButton name="add" filled onPress={() => router.push('/budget-edit')} />}>
      <Body>
        <MonthSwitcher year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
        {!ready ? (
          <Skeleton height={90} count={4} />
        ) : items.length === 0 ? (
          <Appear>
            <Card>
              <EmptyState
                icon="pie-chart-outline"
                title="Chưa có ngân sách"
                message="Tạo ngân sách để kiểm soát chi tiêu hằng tháng theo từng danh mục."
                action="Tạo ngân sách"
                onAction={() => router.push('/budget-edit')}
              />
            </Card>
          </Appear>
        ) : (
          <>
            <Appear index={0}>
              <Card style={{ gap: 12 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View>
                    <Txt variant="small">{left >= 0 ? 'Còn có thể chi' : 'Đã vượt'}</Txt>
                    <AnimatedMoney value={Math.abs(left)} variant="title" color={left >= 0 ? c.text : c.expense} />
                  </View>
                  <Txt variant="h2" color={statusColor(c, budgetStatus(totalSpent, totalLimit))}>
                    {Math.round(totalPercent)}%
                  </Txt>
                </Row>
                <ProgressBar percent={totalPercent} status={budgetStatus(totalSpent, totalLimit)} height={10} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="small">Đã chi {formatMoney(totalSpent)}</Txt>
                  <Txt variant="small">Tổng {formatMoney(totalLimit)}</Txt>
                </Row>
              </Card>
            </Appear>

            {items.map((p, i) => {
              const cat = categoryById.get(p.budget.categoryId);
              const sc = statusColor(c, p.status);
              return (
                <Appear key={p.budget.id} index={i + 1}>
                  <Card style={{ gap: 12 }} onPress={() => router.push({ pathname: '/budget-edit', params: { id: p.budget.id } })}>
                    <Row gap={12}>
                      <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#64748B'} size={42} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                          {cat?.name ?? '?'}
                        </Txt>
                        <View style={[styles.status, { backgroundColor: sc + '1F' }]}>
                          <Txt variant="small" color={sc} style={{ fontWeight: '700', fontSize: 11.5 }}>
                            {statusLabel(p.status)}
                          </Txt>
                        </View>
                      </View>
                      <Txt style={{ fontWeight: '800', fontSize: 18 }} color={sc}>
                        {Math.round(p.percent)}%
                      </Txt>
                    </Row>
                    <ProgressBar percent={p.percent} status={p.status} />
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt variant="small">
                        {formatMoney(p.spent)} / {formatMoney(p.budget.amount)}
                      </Txt>
                      <Txt variant="small" color={p.remaining >= 0 ? c.textMuted : c.expense} style={{ fontWeight: '600' }}>
                        {p.remaining >= 0 ? `Còn ${formatMoney(p.remaining)}` : `Vượt ${formatMoney(-p.remaining)}`}
                      </Txt>
                    </Row>
                  </Card>
                </Appear>
              );
            })}
            <Appear index={items.length + 1}>
              <Button title="Thêm ngân sách" variant="secondary" icon="add" onPress={() => router.push('/budget-edit')} />
            </Appear>
          </>
        )}
      </Body>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
});
