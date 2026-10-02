import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { Body, Button, Card, CategoryIcon, Divider, IconButton, Ionicons, Row, SectionHeader, Segmented, Txt } from '@/components/ui';
import type { Category, CategoryType } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { useColors } from '@/theme/ThemeProvider';

export default function CategoriesScreen() {
  const c = useColors();
  const { categories } = useData();
  const [type, setType] = useState<CategoryType>('expense');
  const ofType = categories.filter((x) => x.type === type);
  const active = ofType.filter((x) => x.isActive);
  const archived = ofType.filter((x) => !x.isActive);
  const open = (cat?: Category) => router.push({ pathname: '/categories/edit', params: cat ? { id: cat.id } : { type } });

  const list = (items: Category[], muted = false) => (
    <Card style={{ paddingVertical: 4 }}>
      {items.map((cat, i) => (
        <View key={cat.id}>
          {i > 0 && <Divider />}
          <PressableScale onPress={() => open(cat)} scaleTo={0.98} style={{ opacity: muted ? 0.6 : 1 }}>
            <Row style={{ paddingVertical: 10 }} gap={12}>
              <CategoryIcon icon={cat.icon} color={cat.color} />
              <Txt style={{ flex: 1, fontWeight: '600' }}>{cat.name}</Txt>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Row>
          </PressableScale>
        </View>
      ))}
    </Card>
  );

  return (
    <Body>
      <Stack.Screen options={{ headerRight: () => <IconButton name="add" onPress={() => open()} /> }} />
      <Segmented
        options={[
          { value: 'expense', label: 'Chi tiêu' },
          { value: 'income', label: 'Thu nhập' },
        ]}
        value={type}
        onChange={setType}
      />
      {active.length > 0 ? list(active) : <Txt variant="muted">Chưa có danh mục nào.</Txt>}
      <Button title="Thêm danh mục" icon="add" variant="secondary" onPress={() => open()} />
      {archived.length > 0 && (
        <>
          <SectionHeader title="Đã lưu trữ" />
          {list(archived, true)}
        </>
      )}
    </Body>
  );
}
