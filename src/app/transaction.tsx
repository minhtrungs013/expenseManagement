import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { accountTypeMeta, DateField } from '@/components/finance';
import { PressableScale, tapHaptic } from '@/components/motion';
import { Body, Button, CategoryIcon, Chip, Field, IconBadge, IconButton, Input, PickerSheet, RADIUS, Row, Segmented, SelectField, Txt } from '@/components/ui';
import { deleteTransaction, saveTransaction } from '@/db/repo';
import { today, toISODate } from '@/domain/dates';
import { formatAmountInput, formatMoney, parseAmount } from '@/domain/money';
import type { Account, Category, TxType } from '@/domain/types';
import { MAX_AMOUNT } from '@/domain/validation';
import { useData } from '@/state/DataProvider';
import { closeScreen } from '@/state/nav';
import { useColors } from '@/theme/ThemeProvider';

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Chi tiêu' },
  { value: 'income', label: 'Thu nhập' },
  { value: 'transfer', label: 'Chuyển khoản' },
];

const SUCCESS: Record<TxType, [string, string]> = {
  expense: ['Đã thêm khoản chi', 'Đã cập nhật khoản chi'],
  income: ['Đã thêm khoản thu', 'Đã cập nhật khoản thu'],
  transfer: ['Đã chuyển tiền', 'Đã cập nhật chuyển khoản'],
};

const QUICK_AMOUNTS: { label: string; apply: (a: number) => number }[] = [
  { label: '000', apply: (a) => a * 1000 },
  { label: '+10K', apply: (a) => a + 10_000 },
  { label: '+50K', apply: (a) => a + 50_000 },
  { label: '+100K', apply: (a) => a + 100_000 },
  { label: '+500K', apply: (a) => a + 500_000 },
];

type PickerTarget = 'account' | 'from' | 'to' | null;

/** Form state is initialized from loaded data, so wait until it is ready. */
export default function TransactionFormScreen() {
  const { ready } = useData();
  return ready ? <TransactionForm /> : null;
}

function TransactionForm() {
  const c = useColors();
  const params = useLocalSearchParams<{ id?: string; type?: TxType }>();
  const { transactions, accounts, categories, balances, accountById, mutate } = useData();

  const editing = useMemo(() => (params.id ? transactions.find((t) => t.id === Number(params.id)) : undefined), [params.id, transactions]);
  const activeAccounts = accounts.filter((a) => a.isActive);

  /** Most recently used account for this type → fewer taps for repeated entries. */
  const lastAccountFor = (t: TxType): number | null => {
    const last = transactions.find((x) => x.type === t);
    const id = t === 'transfer' ? last?.fromAccountId : last?.accountId;
    return activeAccounts.find((a) => a.id === id)?.id ?? activeAccounts[0]?.id ?? null;
  };

  const initialType: TxType = editing?.type ?? (params.type === 'income' || params.type === 'transfer' ? params.type : 'expense');
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null);
  const [accountId, setAccountId] = useState<number | null>(editing?.accountId ?? (initialType !== 'transfer' ? lastAccountFor(initialType) : null));
  const [fromAccountId, setFromAccountId] = useState<number | null>(editing?.fromAccountId ?? (initialType === 'transfer' ? lastAccountFor('transfer') : null));
  const [toAccountId, setToAccountId] = useState<number | null>(editing?.toAccountId ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const amountRef = useRef<TextInput>(null);

  const changeType = (t: TxType) => {
    if (t === type) return;
    setType(t);
    setCategoryId(null);
    if (t === 'transfer') {
      setFromAccountId(accountId ?? lastAccountFor('transfer'));
    } else if (type === 'transfer') {
      setAccountId(fromAccountId ?? lastAccountFor(t));
    }
  };

  const typeColorOf = (t: TxType) => (t === 'income' ? c.income : t === 'expense' ? c.expense : c.transfer);
  const typeColor = typeColorOf(type);
  const visibleCategories = categories.filter((cat) => cat.type === type && (cat.isActive || cat.id === editing?.categoryId));

  // Accounts a picker can offer: active ones, plus an archived one already used by this transaction.
  const pickable = (current: number | null): Account[] =>
    accounts.filter((a) => a.isActive || a.id === current || [editing?.accountId, editing?.fromAccountId, editing?.toAccountId].includes(a.id));

  const accountLabel = (id: number | null) => {
    const a = id != null ? accountById.get(id) : undefined;
    return a ? `${a.name} · ${formatMoney(balances.get(a.id) ?? 0)}` : undefined;
  };
  const accountIcon = (id: number | null) => {
    const a = id != null ? accountById.get(id) : undefined;
    return a ? <IconBadge name={accountTypeMeta(a.type).icon} color={c.link} size={26} /> : null;
  };

  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  })();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await mutate(
      (db) => saveTransaction(db, { type, amount, accountId, categoryId, fromAccountId, toAccountId, note, date }, editing?.id),
      SUCCESS[type][editing ? 1 : 0],
    );
    setSaving(false);
    if (ok) closeScreen();
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert('Xoá giao dịch?', 'Số dư tài khoản sẽ được tính lại. Không thể hoàn tác.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          if (await mutate((db) => deleteTransaction(db, editing.id), 'Đã xoá giao dịch')) closeScreen();
        },
      },
    ]);
  };

  if (params.id && !editing) {
    return (
      <Body>
        <Stack.Screen options={{ title: 'Giao dịch' }} />
        <Txt variant="muted">Không tìm thấy giao dịch.</Txt>
      </Body>
    );
  }

  const pickerOptions = (current: number | null) =>
    pickable(current).map((a) => ({
      value: a.id,
      label: a.name + (a.isActive ? '' : ' (đã lưu trữ)'),
      sublabel: formatMoney(balances.get(a.id) ?? 0),
      left: <IconBadge name={accountTypeMeta(a.type).icon} color={c.link} size={32} />,
    }));

  const swapAccounts = () => {
    tapHaptic();
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editing ? 'Sửa giao dịch' : 'Thêm giao dịch' }} />
      <Body>
        <Segmented options={TYPE_OPTIONS} value={type} onChange={changeType} colorFor={typeColorOf} />

        {/* Amount */}
        <AmountBox color={typeColor} onPress={() => amountRef.current?.focus()}>
          <TextInput
            ref={amountRef}
            value={formatAmountInput(amount)}
            onChangeText={(t) => setAmount(parseAmount(t))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={typeColor + '66'}
            autoFocus={!editing}
            style={[styles.amountInput, { color: typeColor }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
            maxLength={22}
          />
          {amount > 0 && (
            <Animated.View entering={ZoomIn.duration(150)} exiting={ZoomOut.duration(120)} style={styles.clear}>
              <IconButton name="close-circle" color={c.textMuted} size={22} onPress={() => setAmount(0)} />
            </Animated.View>
          )}
          <Txt style={styles.currency} color={typeColor}>
            ₫
          </Txt>
        </AmountBox>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          {QUICK_AMOUNTS.map((q) => (
            <Chip key={q.label} label={q.label} onPress={() => setAmount((a) => Math.min(q.apply(a), MAX_AMOUNT))} />
          ))}
        </ScrollView>

        <Animated.View key={type} entering={FadeIn.duration(220)} style={{ gap: 12 }}>
          {type === 'transfer' ? (
            <View>
              <Field label="Từ tài khoản">
                <SelectField value={accountLabel(fromAccountId)} placeholder="Chọn tài khoản nguồn" onPress={() => setPicker('from')} left={accountIcon(fromAccountId)} />
              </Field>
              <View style={styles.swapRow}>
                <IconButton name="swap-vertical" filled onPress={swapAccounts} color={c.link} />
              </View>
              <Field label="Đến tài khoản">
                <SelectField value={accountLabel(toAccountId)} placeholder="Chọn tài khoản đích" onPress={() => setPicker('to')} left={accountIcon(toAccountId)} />
              </Field>
            </View>
          ) : (
            <>
              <Field label="Danh mục">
                <CategoryGrid categories={visibleCategories} selectedId={categoryId} onSelect={setCategoryId} />
              </Field>
              <Field label="Tài khoản">
                <SelectField value={accountLabel(accountId)} placeholder="Chọn tài khoản" onPress={() => setPicker('account')} left={accountIcon(accountId)} />
              </Field>
            </>
          )}
        </Animated.View>

        <Field label="Ngày">
          <DateField value={date} onChange={setDate} />
          <Row>
            <Chip label="Hôm nay" selected={date === today()} onPress={() => setDate(today())} />
            <Chip label="Hôm qua" selected={date === yesterday} onPress={() => setDate(yesterday)} />
          </Row>
        </Field>

        <Field label="Ghi chú (không bắt buộc)">
          <Input value={note} onChangeText={setNote} placeholder="VD: Ăn trưa" maxLength={200} returnKeyType="done" onSubmitEditing={save} />
        </Field>

        <Button title={editing ? 'Lưu thay đổi' : 'Lưu'} icon="checkmark" color={typeColor} onPress={save} loading={saving} style={{ marginTop: 8 }} />
        {editing && <Button title="Xoá giao dịch" variant="ghost" icon="trash-outline" onPress={remove} />}
      </Body>

      <PickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'to' ? 'Đến tài khoản' : picker === 'from' ? 'Từ tài khoản' : 'Tài khoản'}
        options={pickerOptions(picker === 'to' ? toAccountId : picker === 'from' ? fromAccountId : accountId)}
        value={picker === 'to' ? toAccountId : picker === 'from' ? fromAccountId : accountId}
        onSelect={(id) => (picker === 'to' ? setToAccountId(id) : picker === 'from' ? setFromAccountId(id) : setAccountId(id))}
      />
    </KeyboardAvoidingView>
  );
}

/** Amount card whose tint follows the transaction type color. */
function AmountBox({ color, onPress, children }: { color: string; onPress: () => void; children: React.ReactNode }) {
  const c = useColors();
  const tint = useSharedValue(color);
  useEffect(() => {
    tint.value = withTiming(color, { duration: 250 });
  }, [color, tint]);
  const style = useAnimatedStyle(() => ({ borderColor: tint.value }));
  return (
    <PressableScale onPress={onPress} scaleTo={0.99}>
      <Animated.View style={[styles.amountBox, { backgroundColor: c.card }, style]}>{children}</Animated.View>
    </PressableScale>
  );
}

const COLUMNS = 4;
const TILE_SHADOW = '0px 2px 8px rgba(15, 23, 42, 0.05)';
const GAP = 8;

/** Fixed 4-column grid: tile width is computed from the measured width, so edges always line up. */
function CategoryGrid({ categories, selectedId, onSelect }: { categories: Category[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const [width, setWidth] = useState(0);
  const tileW = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tileW > 0 &&
        categories.map((cat, i) => (
          <Animated.View key={cat.id} entering={FadeInDown.delay(i * 18).duration(240)}>
            <CategoryTile cat={cat} width={tileW} selected={cat.id === selectedId} onPress={() => onSelect(cat.id)} />
          </Animated.View>
        ))}
    </View>
  );
}

function CategoryTile({ cat, width, selected, onPress }: { cat: Category; width: number; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (selected) pop.value = withSequence(withTiming(1.1, { duration: 110 }), withTiming(1, { duration: 160 }));
  }, [selected, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <PressableScale
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      scaleTo={0.92}
      style={[
        styles.catTile,
        { width, borderColor: selected ? cat.color : 'transparent', backgroundColor: selected ? cat.color + '1A' : c.card },
        { boxShadow: selected || c.dark ? 'none' : TILE_SHADOW },
      ]}
    >
      <Animated.View style={iconStyle}>
        <CategoryIcon icon={cat.icon} color={cat.color} size={40} />
      </Animated.View>
      <Txt variant="small" color={selected ? c.text : c.textMuted} numberOfLines={1} style={{ fontWeight: selected ? '700' : '600', textAlign: 'center' }}>
        {cat.name}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  amountBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: 2, height: 92 },
  amountInput: { flex: 1, alignSelf: 'stretch', fontSize: 40, fontWeight: '800', textAlign: 'center', paddingHorizontal: 36, paddingVertical: 0, letterSpacing: -1 },
  currency: { position: 'absolute', right: 20, fontSize: 26, fontWeight: '800', opacity: 0.85 },
  clear: { position: 'absolute', left: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  catTile: { alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 4, borderRadius: RADIUS.md, borderWidth: 1.5 },
  swapRow: { alignItems: 'center', marginVertical: -2, zIndex: 1 },
});