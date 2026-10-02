import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View, type TextProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { addMonths, formatDate, formatMonth, fromISODate, toISODate } from '@/domain/dates';
import { formatMoney, formatSigned } from '@/domain/money';
import type { AccountType, ISODate, Transaction } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { useColors } from '@/theme/ThemeProvider';

import { PressableScale, useCountUp } from './motion';
import { Button, CategoryIcon, IconBadge, IconButton, Ionicons, Row, SelectField, Sheet, Txt, type IconName } from './ui';

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: IconName }[] = [
  { value: 'cash', label: 'Tiền mặt', icon: 'cash-outline' },
  { value: 'bank', label: 'Ngân hàng', icon: 'business-outline' },
  { value: 'ewallet', label: 'Ví điện tử', icon: 'wallet-outline' },
  { value: 'credit', label: 'Thẻ tín dụng', icon: 'card-outline' },
  { value: 'investment', label: 'Đầu tư', icon: 'trending-up-outline' },
  { value: 'other', label: 'Khác', icon: 'ellipsis-horizontal-circle-outline' },
];

export function accountTypeMeta(type: AccountType) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[5];
}

/** Signed amount from the user's point of view; transfers are neutral (0 sign). */
export function txSign(tx: Transaction): 1 | -1 | 0 {
  return tx.type === 'income' ? 1 : tx.type === 'expense' ? -1 : 0;
}

export function TransactionRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  const c = useColors();
  const { categoryById, accountById } = useData();

  let title: string;
  let subtitle: string;
  let icon;
  if (tx.type === 'transfer') {
    const from = accountById.get(tx.fromAccountId!)?.name ?? '?';
    const to = accountById.get(tx.toAccountId!)?.name ?? '?';
    title = tx.note || 'Chuyển tiền';
    subtitle = `${from} → ${to}`;
    icon = <IconBadge name="swap-horizontal" color={c.transfer} />;
  } else {
    const cat = categoryById.get(tx.categoryId!);
    title = tx.note || cat?.name || '?';
    subtitle = tx.note ? `${cat?.name ?? '?'} · ${accountById.get(tx.accountId!)?.name ?? '?'}` : (accountById.get(tx.accountId!)?.name ?? '?');
    icon = <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#64748B'} />;
  }

  const sign = txSign(tx);
  const amountText = sign === 0 ? formatSigned(tx.amount).replace('+', '') : formatSigned(sign * tx.amount);
  const amountColor = sign > 0 ? c.income : sign < 0 ? c.text : c.transfer;

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={styles.txRow}>
      {icon}
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1} style={{ fontWeight: '600' }}>
          {title}
        </Txt>
        <Txt variant="small" numberOfLines={1}>
          {subtitle}
        </Txt>
      </View>
      <Txt style={{ fontWeight: '700' }} color={amountColor}>
        {amountText}
      </Txt>
    </PressableScale>
  );
}

export function MonthSwitcher({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const go = (delta: number) => {
    const n = addMonths(year, month, delta);
    onChange(n.year, n.month);
  };
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <IconButton name="chevron-back" onPress={() => go(-1)} filled />
      <Animated.View key={`${year}-${month}`} entering={FadeIn.duration(250)}>
        <Txt variant="h2">{formatMonth(year, month)}</Txt>
      </Animated.View>
      <IconButton name="chevron-forward" onPress={() => go(1)} filled />
    </Row>
  );
}

export function DateField({ value, onChange, placeholder = 'Chọn ngày' }: { value: ISODate | null; onChange: (d: ISODate) => void; placeholder?: string }) {
  const c = useColors();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? fromISODate(value) : new Date());

  const open = () => {
    const current = value ? fromISODate(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onValueChange: (_e, date) => onChange(toISODate(date)),
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  };

  return (
    <>
      <SelectField
        value={value ? formatDate(value) : undefined}
        placeholder={placeholder}
        onPress={open}
        left={<Ionicons name="calendar-outline" size={18} color={c.textMuted} />}
      />
      {Platform.OS === 'ios' && (
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} title="Chọn ngày">
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            locale="vi-VN"
            accentColor={c.primary}
            themeVariant={c.dark ? 'dark' : 'light'}
            onValueChange={(_e, date) => setDraft(date)}
          />
          <Button
            title="Xong"
            onPress={() => {
              onChange(toISODate(draft));
              setIosOpen(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

/** Groups a sorted transaction list into day sections. */
export function groupByDay(txs: Transaction[]): { date: ISODate; items: Transaction[]; net: number }[] {
  const groups: { date: ISODate; items: Transaction[]; net: number }[] = [];
  for (const tx of txs) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== tx.date) {
      g = { date: tx.date, items: [], net: 0 };
      groups.push(g);
    }
    g.items.push(tx);
    g.net += txSign(tx) * tx.amount;
  }
  return groups;
}

/** Money text that counts up/down to its new value. */
export function AnimatedMoney({ value, signed, ...rest }: TextProps & { value: number; signed?: boolean; variant?: 'display' | 'title' | 'h2' | 'body'; color?: string }) {
  const v = useCountUp(value);
  return <Txt {...rest}>{signed ? formatSigned(v) : formatMoney(v)}</Txt>;
}

const styles = StyleSheet.create({
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 60 },
});
