import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { Body, Button, CategoryIcon, Field, Input, Ionicons, Row, Segmented, Txt } from '@/components/ui';
import { deleteCategory, saveCategory, setCategoryActive } from '@/db/repo';
import type { CategoryType } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { closeScreen } from '@/state/nav';
import { CATEGORY_COLORS } from '@/theme/colors';
import { useColors } from '@/theme/ThemeProvider';

const ICONS = [
  '🍜', '☕', '🍺', '🛒', '🛍️', '👕', '🏠', '💡', '💧', '📱', '🌐', '🧾',
  '🛵', '🚗', '⛽', '🚌', '✈️', '🏨', '🎬', '🎮', '🎵', '⚽', '💊', '🏥',
  '📚', '🎓', '👶', '🐶', '🎁', '💄', '💇', '🔧', '💰', '💻', '📈', '🏦',
  '💳', '🎀', '❤️', '👨‍👩‍👧', '📦', '⭐',
];

/** Form state is initialized from loaded data, so wait until it is ready. */
export default function CategoryEditScreen() {
  const { ready } = useData();
  return ready ? <CategoryEdit /> : null;
}

function CategoryEdit() {
  const c = useColors();
  const params = useLocalSearchParams<{ id?: string; type?: CategoryType }>();
  const { categories, transactions, mutate } = useData();
  const editing = params.id ? categories.find((x) => x.id === Number(params.id)) : undefined;
  const usedCount = editing ? transactions.filter((t) => t.categoryId === editing.id).length : 0;

  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<CategoryType>(editing?.type ?? (params.type === 'income' ? 'income' : 'expense'));
  const [icon, setIcon] = useState(editing?.icon ?? '📦');
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await mutate((db) => saveCategory(db, { name, type, icon, color }, editing?.id), editing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
    setSaving(false);
    if (ok) closeScreen();
  };

  const toggleArchive = async () => {
    if (!editing) return;
    if (await mutate((db) => setCategoryActive(db, editing.id, !editing.isActive), editing.isActive ? 'Đã lưu trữ danh mục' : 'Đã khôi phục danh mục')) closeScreen();
  };

  const remove = () => {
    if (!editing) return;
    if (usedCount > 0) {
      Alert.alert('Không thể xoá', `Danh mục này có ${usedCount} giao dịch. Hãy lưu trữ để giữ lại lịch sử.`);
      return;
    }
    Alert.alert('Xoá danh mục?', 'Ngân sách của danh mục này (nếu có) cũng sẽ bị xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: async () => (await mutate((db) => deleteCategory(db, editing.id), 'Đã xoá danh mục')) && closeScreen() },
    ]);
  };

  return (
    <Body>
      <Stack.Screen options={{ title: editing ? 'Sửa danh mục' : 'Thêm danh mục' }} />
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <CategoryIcon icon={icon} color={color} size={72} />
        <Txt variant="h2">{name || 'Tên danh mục'}</Txt>
      </View>

      {(!editing || usedCount === 0) && (
        <Segmented
          options={[
            { value: 'expense', label: 'Chi tiêu' },
            { value: 'income', label: 'Thu nhập' },
          ]}
          value={type}
          onChange={setType}
        />
      )}

      <Field label="Tên">
        <Input value={name} onChangeText={setName} placeholder="VD: Cà phê" maxLength={50} />
      </Field>

      <Field label="Biểu tượng">
        <View style={styles.grid}>
          {ICONS.map((e) => (
            <PressableScale key={e} scaleTo={0.85} onPress={() => setIcon(e)} style={[styles.iconCell, { backgroundColor: icon === e ? color + '33' : c.card, borderColor: icon === e ? color : c.border }]}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </PressableScale>
          ))}
        </View>
        <Input value={icon} onChangeText={(t) => setIcon(t.slice(0, 8))} placeholder="Hoặc nhập emoji bất kỳ" />
      </Field>

      <Field label="Màu">
        <Row style={{ flexWrap: 'wrap' }}>
          {CATEGORY_COLORS.map((col) => (
            <PressableScale key={col} scaleTo={0.85} onPress={() => setColor(col)} style={[styles.swatch, { backgroundColor: col }]}>
              {color === col && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
            </PressableScale>
          ))}
        </Row>
      </Field>

      <Button title="Lưu" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {editing && (
        <>
          <Button title={editing.isActive ? 'Lưu trữ danh mục' : 'Khôi phục danh mục'} variant="secondary" icon={editing.isActive ? 'archive-outline' : 'refresh'} onPress={toggleArchive} />
          <Button title="Xoá danh mục" variant="ghost" icon="trash-outline" onPress={remove} />
        </>
      )}
    </Body>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
