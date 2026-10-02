import { router } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { accountTypeMeta, DateField, groupByDay, TransactionRow } from '@/components/finance';
import { PressableScale } from '@/components/motion';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  Divider,
  EmptyState,
  Field,
  IconBadge,
  Input,
  Ionicons,
  PickerSheet,
  Row,
  Segmented,
  SelectField,
  Sheet,
  Skeleton,
  surface,
  TabScreen,
  Txt,
} from '@/components/ui';
import { summarize } from '@/domain/calc';
import { addMonths, currentMonthRange, formatDayHeader, monthRange, today, toISODate } from '@/domain/dates';
import { activeFilterCount, applyFilter, EMPTY_FILTER, type SortOrder, type TxFilter } from '@/domain/filter';
import { formatAmountInput, formatSigned, parseAmount } from '@/domain/money';
import type { Transaction, TxType } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { useColors } from '@/theme/ThemeProvider';

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'highest', label: 'Số tiền cao' },
  { value: 'lowest', label: 'Số tiền thấp' },
];

export default function TransactionsScreen() {
  const c = useColors();
  const { ready, transactions, categories, accounts } = useData();
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => applyFilter(transactions, filter, categories, accounts), [transactions, filter, categories, accounts]);
  const byDate = filter.sort === 'newest' || filter.sort === 'oldest';
  const sections = useMemo(
    () => (byDate ? groupByDay(filtered).map((g) => ({ key: g.date, title: formatDayHeader(g.date), net: g.net, data: g.items })) : [{ key: 'all', title: '', net: null as number | null, data: filtered }]),
    [filtered, byDate],
  );
  const totals = useMemo(() => summarize(filtered, { from: '0000-01-01', to: '9999-12-31' }), [filtered]);
  const filterCount = activeFilterCount(filter);
  const hasQuery = filterCount > 0 || filter.search.trim() !== '';

  // Only the first screenful animates in. Rows mounted later (scrolling, searching) appear instantly —
  // replaying entrance animations during scroll is what made long lists stutter.
  const firstPaint = useRef(true);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => (firstPaint.current = false), 800);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <TabScreen title="Giao dịch">
      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
        <Row>
          <View style={[styles.search, surface(c)]}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <Input
              value={filter.search}
              onChangeText={(search) => setFilter((f) => ({ ...f, search }))}
              placeholder="Tìm ghi chú, danh mục, số tiền…"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {filter.search !== '' && (
              <Animated.View entering={ZoomIn.duration(150)} exiting={ZoomOut.duration(120)}>
                <PressableScale hitSlop={10} onPress={() => setFilter((f) => ({ ...f, search: '' }))}>
                  <Ionicons name="close-circle" size={18} color={c.textMuted} />
                </PressableScale>
              </Animated.View>
            )}
          </View>
          <PressableScale onPress={() => setSheetOpen(true)} scaleTo={0.9} style={[styles.filterBtn, filterCount ? { backgroundColor: c.primary } : surface(c)]}>
            <Ionicons name="options-outline" size={22} color={filterCount ? c.onPrimary : c.text} />
            {filterCount > 0 && (
              <Animated.View entering={ZoomIn} style={[styles.badge, { backgroundColor: c.expense, borderColor: c.bg }]}>
                <Txt variant="small" color="#FFFFFF" style={{ fontWeight: '800', fontSize: 11, lineHeight: 14 }}>
                  {filterCount}
                </Txt>
              </Animated.View>
            )}
          </PressableScale>
        </Row>
        {hasQuery && filtered.length > 0 && (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="small">{filtered.length} giao dịch</Txt>
              <Row gap={12}>
                <Txt variant="small" color={c.income} style={{ fontWeight: '700' }}>
                  {formatSigned(totals.income)}
                </Txt>
                <Txt variant="small" color={c.expense} style={{ fontWeight: '700' }}>
                  {formatSigned(-totals.expense)}
                </Txt>
              </Row>
            </Row>
          </Animated.View>
        )}
      </View>

      {!ready ? (
        <View style={{ padding: 16 }}>
          <Skeleton height={56} count={6} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 4 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item, index }) => <DaySection section={item} animate={firstPaint.current && index < 6} index={index} />}
          ListEmptyComponent={
            hasQuery ? (
              <EmptyState icon="search-outline" title="Không tìm thấy" message="Không có giao dịch nào khớp với tìm kiếm hoặc bộ lọc." action="Xoá bộ lọc" onAction={() => setFilter(EMPTY_FILTER)} />
            ) : (
              <EmptyState icon="receipt-outline" title="Chưa có giao dịch nào" message="Bắt đầu theo dõi tiền của bạn bằng cách thêm giao dịch đầu tiên." action="Thêm giao dịch" onAction={() => router.push('/transaction')} />
            )
          }
        />
      )}

      <FilterSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} value={filter} onApply={setFilter} />
    </TabScreen>
  );
}

interface DaySectionData {
  key: string;
  title: string;
  net: number | null;
  data: Transaction[];
}

/** One day's card. Memoized: unchanged days are skipped when the list re-renders (e.g. while typing a search). */
const DaySection = memo(function DaySection({ section, animate, index }: { section: DaySectionData; animate: boolean; index: number }) {
  const c = useColors();
  const content = (
    <>
      {section.title !== '' && (
        <Row style={styles.dayHeader}>
          <Txt variant="label">{section.title}</Txt>
          {section.net != null && section.net !== 0 && (
            <Txt variant="small" style={{ fontWeight: '700' }} color={section.net > 0 ? c.income : c.textMuted}>
              {formatSigned(section.net)}
            </Txt>
          )}
        </Row>
      )}
      <Card style={{ paddingVertical: 2, marginTop: section.title ? 0 : 8 }}>
        {section.data.map((tx, i) => (
          <View key={tx.id}>
            {i > 0 && <Divider inset={52} />}
            <TransactionRow tx={tx} />
          </View>
        ))}
      </Card>
    </>
  );
  if (!animate) return <View>{content}</View>;
  return <Animated.View entering={FadeInDown.delay(index * 40).duration(260)}>{content}</Animated.View>;
}, sameSection);

/** Sections are rebuilt on every filter change; compare by content (transactions are stable objects from the snapshot). */
function sameSection(a: { section: DaySectionData; animate: boolean }, b: { section: DaySectionData; animate: boolean }) {
  const x = a.section;
  const y = b.section;
  return (
    a.animate === b.animate &&
    x.key === y.key &&
    x.title === y.title &&
    x.net === y.net &&
    x.data.length === y.data.length &&
    x.data.every((tx, i) => tx === y.data[i])
  );
}

function FilterSheet({ visible, onClose, value, onApply }: { visible: boolean; onClose: () => void; value: TxFilter; onApply: (f: TxFilter) => void }) {
  const c = useColors();
  const { accounts, categories, accountById, categoryById } = useData();
  const [draft, setDraft] = useState(value);
  const [picker, setPicker] = useState<'account' | 'category' | null>(null);
  const set = (patch: Partial<TxFilter>) => setDraft((d) => ({ ...d, ...patch }));

  // Sync the draft with the applied filter each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }

  const now = new Date();
  const lastMonth = addMonths(now.getFullYear(), now.getMonth(), -1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const presets = [
    { label: 'Tháng này', range: currentMonthRange() },
    { label: 'Tháng trước', range: monthRange(lastMonth.year, lastMonth.month) },
    { label: '30 ngày', range: { from: toISODate(thirtyDaysAgo), to: today() } },
    { label: 'Năm nay', range: { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` } },
  ];

  const typeOptions: { value: TxType | 'all'; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'expense', label: 'Chi' },
    { value: 'income', label: 'Thu' },
    { value: 'transfer', label: 'Chuyển' },
  ];

  const cat = draft.categoryId != null ? categoryById.get(draft.categoryId) : undefined;
  const acc = draft.accountId != null ? accountById.get(draft.accountId) : undefined;
  const categoryChoices = categories.filter((x) => draft.type === 'all' || x.type === draft.type);

  return (
    <Sheet visible={visible} onClose={onClose} title="Bộ lọc">
      <View style={{ gap: 14 }}>
        <Field label="Loại giao dịch">
          <Segmented options={typeOptions} value={draft.type} onChange={(type) => set({ type, categoryId: type === 'transfer' ? null : draft.categoryId })} />
        </Field>

        <Field label="Tài khoản">
          <SelectField value={acc?.name} placeholder="Tất cả tài khoản" onPress={() => setPicker('account')} />
        </Field>

        {draft.type !== 'transfer' && (
          <Field label="Danh mục">
            <SelectField value={cat ? `${cat.icon} ${cat.name}` : undefined} placeholder="Tất cả danh mục" onPress={() => setPicker('category')} />
          </Field>
        )}

        <Field label="Khoảng thời gian">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {presets.map((p) => (
              <Chip key={p.label} label={p.label} selected={draft.from === p.range.from && draft.to === p.range.to} onPress={() => set({ from: p.range.from, to: p.range.to })} />
            ))}
          </ScrollView>
          <Row>
            <View style={{ flex: 1 }}>
              <DateField value={draft.from} onChange={(from) => set({ from })} placeholder="Từ ngày" />
            </View>
            <View style={{ flex: 1 }}>
              <DateField value={draft.to} onChange={(to) => set({ to })} placeholder="Đến ngày" />
            </View>
          </Row>
        </Field>

        <Field label="Số tiền">
          <Row>
            <Input style={{ flex: 1 }} keyboardType="number-pad" placeholder="Tối thiểu" value={formatAmountInput(draft.minAmount ?? 0)} onChangeText={(t) => set({ minAmount: parseAmount(t) || null })} />
            <Input style={{ flex: 1 }} keyboardType="number-pad" placeholder="Tối đa" value={formatAmountInput(draft.maxAmount ?? 0)} onChangeText={(t) => set({ maxAmount: parseAmount(t) || null })} />
          </Row>
        </Field>

        <Field label="Sắp xếp">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={draft.sort === s.value} onPress={() => set({ sort: s.value })} />
            ))}
          </ScrollView>
        </Field>

        <Row>
          <Button title="Đặt lại" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft({ ...EMPTY_FILTER, search: draft.search })} />
          <Button
            title="Áp dụng"
            style={{ flex: 2 }}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </Row>
      </View>

      <PickerSheet
        visible={picker === 'account'}
        onClose={() => setPicker(null)}
        title="Tài khoản"
        value={draft.accountId}
        onSelect={(accountId) => set({ accountId })}
        options={[
          { value: null, label: 'Tất cả tài khoản' },
          ...accounts.map((a) => ({ value: a.id as number | null, label: a.name + (a.isActive ? '' : ' (đã lưu trữ)'), left: <IconBadge name={accountTypeMeta(a.type).icon} color={c.link} size={30} /> })),
        ]}
      />
      <PickerSheet
        visible={picker === 'category'}
        onClose={() => setPicker(null)}
        title="Danh mục"
        value={draft.categoryId}
        onSelect={(categoryId) => set({ categoryId })}
        options={[
          { value: null, label: 'Tất cả danh mục' },
          ...categoryChoices.map((x) => ({
            value: x.id as number | null,
            label: x.name + (x.isActive ? '' : ' (đã lưu trữ)'),
            sublabel: x.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
            left: <CategoryIcon icon={x.icon} color={x.color} size={30} />,
          })),
        ]}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dayHeader: { justifyContent: 'space-between', paddingTop: 14, paddingBottom: 8, paddingHorizontal: 4 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 14, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: 46, borderWidth: 0, paddingHorizontal: 0, backgroundColor: 'transparent' },
  filterBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
