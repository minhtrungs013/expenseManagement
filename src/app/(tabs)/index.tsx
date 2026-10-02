import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { accountTypeMeta, AnimatedMoney, TransactionRow } from '@/components/finance';
import { Appear, PressableScale } from '@/components/motion';
import {
  Body,
  Card,
  CategoryIcon,
  Divider,
  EmptyState,
  IconBadge,
  IconButton,
  Ionicons,
  ProgressBar,
  Row,
  SectionHeader,
  Skeleton,
  statusColor,
  surface,
  TabScreen,
  Txt,
  type IconName,
} from '@/components/ui';
import { budgetProgress, summarize, totalBalance } from '@/domain/calc';
import { currentMonthRange, formatLongDate, today } from '@/domain/dates';
import { formatCompact } from '@/domain/money';
import type { TxType } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { mix } from '@/theme/colors';
import { useColors } from '@/theme/ThemeProvider';

export default function Dashboard() {
  const c = useColors();
  const { ready, accounts, transactions, budgets, balances, categoryById } = useData();

  const month = useMemo(currentMonthRange, []);
  const summary = useMemo(() => summarize(transactions, month), [transactions, month]);
  const total = totalBalance(accounts, balances);
  const activeAccounts = accounts.filter((a) => a.isActive);
  const topBudgets = useMemo(
    () =>
      budgets
        .map((b) => budgetProgress(b, transactions, month))
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 3),
    [budgets, transactions, month],
  );
  const recent = transactions.slice(0, 6);
  const fg = c.onPrimary;

  return (
    <TabScreen title="Tổng quan" subtitle={formatLongDate(today())} right={<IconButton name="settings-outline" filled onPress={() => router.push('/settings')} />}>
      <Body>
        {!ready ? (
          <Skeleton height={150} count={3} />
        ) : (
          <>
            {/* 1–3. Total balance, income & expense this month */}
            <Appear index={0}>
              <LinearGradient colors={[c.primary, mix(c.primary, '#000000', 0.28)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={[styles.blob, { top: -60, right: -40, backgroundColor: fg }]} />
                <View style={[styles.blob, { bottom: -80, left: -50, width: 180, height: 180, backgroundColor: fg }]} />
                <Txt color={fg} style={{ opacity: 0.8, fontWeight: '600' }}>
                  Tổng số dư
                </Txt>
                <AnimatedMoney value={total} variant="display" color={fg} style={{ marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit />
                <View style={[styles.heroStats, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                  <HeroStat icon="arrow-down" label="Thu tháng này" value={summary.income} color={fg} />
                  <View style={[styles.heroDivider, { backgroundColor: fg }]} />
                  <HeroStat icon="arrow-up" label="Chi tháng này" value={summary.expense} color={fg} />
                </View>
                <Row style={{ marginTop: 12, justifyContent: 'space-between' }}>
                  <Txt variant="small" color={fg} style={{ opacity: 0.8 }}>
                    Chênh lệch tháng này
                  </Txt>
                  <AnimatedMoney value={summary.net} signed color={fg} style={{ fontWeight: '800' }} />
                </Row>
              </LinearGradient>
            </Appear>

            {/* Quick add */}
            <Appear index={1}>
              <Row gap={10}>
                <QuickAction type="expense" icon="arrow-up" label="Chi tiêu" color={c.expense} />
                <QuickAction type="income" icon="arrow-down" label="Thu nhập" color={c.income} />
                <QuickAction type="transfer" icon="swap-horizontal" label="Chuyển" color={c.transfer} />
              </Row>
            </Appear>

            <Appear index={2}>
              <SectionHeader title="Tài khoản" action="Quản lý" onAction={() => router.push('/accounts')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 10 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 6 }}>
                {activeAccounts.map((a) => {
                  const bal = balances.get(a.id) ?? 0;
                  return (
                    <PressableScale key={a.id} onPress={() => router.push({ pathname: '/accounts/edit', params: { id: a.id } })} style={[styles.accountCard, surface(c)]}>
                      <IconBadge name={accountTypeMeta(a.type).icon} color={c.link} bg={c.primarySoft} size={36} />
                      <Txt variant="small" numberOfLines={1} style={{ marginTop: 10 }}>
                        {a.name}
                      </Txt>
                      <AnimatedMoney value={bal} style={{ fontWeight: '800', fontSize: 16 }} color={bal < 0 ? c.expense : c.text} numberOfLines={1} adjustsFontSizeToFit />
                    </PressableScale>
                  );
                })}
                <PressableScale onPress={() => router.push('/accounts/edit')} style={[styles.accountCard, styles.addAccount, { borderColor: c.border }]}>
                  <Ionicons name="add" size={26} color={c.textMuted} />
                  <Txt variant="small">Thêm</Txt>
                </PressableScale>
              </ScrollView>
            </Appear>

            {/* 5. Am I staying within my budget? */}
            <Appear index={3}>
              <SectionHeader title="Ngân sách tháng này" action={budgets.length ? 'Xem tất cả' : 'Tạo mới'} onAction={() => router.push(budgets.length ? '/budgets' : '/budget-edit')} />
              <View style={{ marginTop: 10 }}>
                {topBudgets.length === 0 ? (
                  <Card onPress={() => router.push('/budget-edit')}>
                    <Row gap={12}>
                      <IconBadge name="pie-chart-outline" color={c.link} bg={c.primarySoft} />
                      <Txt variant="muted" style={{ flex: 1 }}>
                        Đặt hạn mức chi tiêu cho từng danh mục để không tiêu quá tay.
                      </Txt>
                      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                    </Row>
                  </Card>
                ) : (
                  <Card style={{ gap: 16 }}>
                    {topBudgets.map((p) => {
                      const cat = categoryById.get(p.budget.categoryId);
                      return (
                        <View key={p.budget.id} style={{ gap: 8 }}>
                          <Row gap={10}>
                            <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#64748B'} size={32} />
                            <View style={{ flex: 1 }}>
                              <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                                {cat?.name}
                              </Txt>
                              <Txt variant="small">
                                {formatCompact(p.spent)} / {formatCompact(p.budget.amount)}
                              </Txt>
                            </View>
                            <Txt style={{ fontWeight: '800' }} color={statusColor(c, p.status)}>
                              {Math.round(p.percent)}%
                            </Txt>
                          </Row>
                          <ProgressBar percent={p.percent} status={p.status} />
                        </View>
                      );
                    })}
                  </Card>
                )}
              </View>
            </Appear>

            <Appear index={4}>
              <SectionHeader title="Giao dịch gần đây" action={recent.length ? 'Xem tất cả' : undefined} onAction={() => router.push('/transactions')} />
              <View style={{ marginTop: 10 }}>
                {recent.length === 0 ? (
                  <Card>
                    <EmptyState
                      icon="receipt-outline"
                      title="Chưa có giao dịch nào"
                      message="Bắt đầu theo dõi tiền của bạn bằng cách thêm giao dịch đầu tiên."
                      action="Thêm giao dịch"
                      onAction={() => router.push('/transaction')}
                    />
                  </Card>
                ) : (
                  <Card style={{ paddingVertical: 4 }}>
                    {recent.map((tx, i) => (
                      <View key={tx.id}>
                        {i > 0 && <Divider inset={52} />}
                        <TransactionRow tx={tx} onPress={() => router.push({ pathname: '/transaction', params: { id: tx.id } })} />
                      </View>
                    ))}
                  </Card>
                )}
              </View>
            </Appear>
          </>
        )}
      </Body>
    </TabScreen>
  );
}

function HeroStat({ icon, label, value, color }: { icon: 'arrow-down' | 'arrow-up'; label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Row gap={6}>
        <View style={[styles.heroIcon, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
          <Ionicons name={icon} size={12} color={color} />
        </View>
        <Txt variant="small" color={color} style={{ opacity: 0.85 }}>
          {label}
        </Txt>
      </Row>
      <AnimatedMoney value={value} color={color} style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1} adjustsFontSizeToFit />
    </View>
  );
}

function QuickAction({ type, icon, label, color }: { type: TxType; icon: IconName; label: string; color: string }) {
  const c = useColors();
  return (
    <PressableScale haptic onPress={() => router.push({ pathname: '/transaction', params: { type } })} style={[styles.quick, surface(c)]}>
      <View style={[styles.quickIcon, { backgroundColor: color + '1F' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Txt variant="small" color={c.text} style={{ fontWeight: '700' }}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 20, overflow: 'hidden' },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, opacity: 0.08 },
  heroStats: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, marginTop: 16, gap: 12 },
  heroDivider: { width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch', opacity: 0.3 },
  heroIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quick: { flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 8 },
  quickIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  accountCard: { width: 150, borderRadius: 18, padding: 14 },
  addAccount: { width: 90, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'transparent' },
});
