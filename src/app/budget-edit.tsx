import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Body, Button, CategoryIcon, Field, Input, PickerSheet, SelectField, Txt } from '@/components/ui';
import { deleteBudget, saveBudget } from '@/db/repo';
import { formatAmountInput, parseAmount } from '@/domain/money';
import { useData } from '@/state/DataProvider';
import { closeScreen } from '@/state/nav';

/** Form state is initialized from loaded data, so wait until it is ready. */
export default function BudgetEditScreen() {
  const { ready } = useData();
  return ready ? <BudgetEdit /> : null;
}

function BudgetEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { budgets, categories, categoryById, mutate } = useData();
  const editing = id ? budgets.find((b) => b.id === Number(id)) : undefined;

  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null);
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const used = new Set(budgets.filter((b) => b.id !== editing?.id).map((b) => b.categoryId));
  const choices = categories.filter((c) => c.type === 'expense' && c.isActive && !used.has(c.id));
  const cat = categoryId != null ? categoryById.get(categoryId) : undefined;

  const save = async () => {
    if (categoryId == null) {
      Alert.alert('Vui lòng chọn danh mục');
      return;
    }
    setSaving(true);
    const ok = await mutate((db) => saveBudget(db, { categoryId, amount }, editing?.id), editing ? 'Đã cập nhật ngân sách' : 'Đã tạo ngân sách');
    setSaving(false);
    if (ok) closeScreen();
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert('Xoá ngân sách?', 'Giao dịch không bị ảnh hưởng.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: async () => (await mutate((db) => deleteBudget(db, editing.id), 'Đã xoá ngân sách')) && closeScreen() },
    ]);
  };

  return (
    <Body>
      <Stack.Screen options={{ title: editing ? 'Sửa ngân sách' : 'Tạo ngân sách' }} />
      <Field label="Danh mục chi tiêu">
        <SelectField
          value={cat?.name}
          placeholder="Chọn danh mục"
          onPress={() => setPickerOpen(true)}
          left={cat ? <CategoryIcon icon={cat.icon} color={cat.color} size={26} /> : undefined}
        />
      </Field>
      <Field label="Hạn mức mỗi tháng (₫)">
        <Input value={formatAmountInput(amount)} onChangeText={(t) => setAmount(parseAmount(t))} keyboardType="number-pad" placeholder="VD: 3.000.000" autoFocus={!editing} />
      </Field>
      <Txt variant="small">Ngân sách được áp dụng cho mỗi tháng. Bạn vẫn có thể ghi chi tiêu khi đã vượt ngân sách — ứng dụng chỉ cảnh báo.</Txt>
      <Button title="Lưu" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {editing && <Button title="Xoá ngân sách" variant="ghost" icon="trash-outline" onPress={remove} />}

      <PickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Danh mục"
        value={categoryId}
        onSelect={setCategoryId}
        options={choices.map((c) => ({ value: c.id, label: c.name, left: <CategoryIcon icon={c.icon} color={c.color} size={30} /> }))}
      />
    </Body>
  );
}
