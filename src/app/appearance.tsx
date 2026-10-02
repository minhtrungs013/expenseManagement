import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { Body, Button, Card, Field, Input, Ionicons, Row, SectionHeader, Segmented, Txt } from '@/components/ui';
import { normalizeHex } from '@/domain/validation';
import { DEFAULT_THEME, EXPENSE_PRESETS, INCOME_PRESETS, mix, PRIMARY_PRESETS, readableOn, type ThemeMode, type ThemeSettings } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

export default function AppearanceScreen() {
  const { colors: c, settings, updateTheme } = useTheme();

  return (
    <Body>
      {/* Live preview */}
      <LinearGradient colors={[c.primary, mix(c.primary, '#000000', 0.28)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
        <Txt color={c.onPrimary} style={{ opacity: 0.85 }}>
          Tổng số dư
        </Txt>
        <Txt color={c.onPrimary} style={{ fontSize: 28, fontWeight: '800' }}>
          18.500.000 ₫
        </Txt>
      </LinearGradient>
      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt>💰 Lương</Txt>
          <Txt style={{ fontWeight: '700' }} color={c.income}>
            +15.000.000 ₫
          </Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt>🍜 Ăn trưa</Txt>
          <Txt style={{ fontWeight: '700' }} color={c.expense}>
            -50.000 ₫
          </Txt>
        </Row>
      </Card>

      <SectionHeader title="Chế độ hiển thị" />
      <Segmented<ThemeMode>
        options={[
          { value: 'system', label: 'Theo máy' },
          { value: 'light', label: 'Sáng' },
          { value: 'dark', label: 'Tối' },
        ]}
        value={settings.mode}
        onChange={(mode) => updateTheme({ mode })}
      />

      <ColorPicker title="Màu chủ đạo" presets={PRIMARY_PRESETS} value={settings.primary} onChange={(primary) => updateTheme({ primary })} />
      <ColorPicker title="Màu khoản thu" presets={INCOME_PRESETS} value={settings.income} onChange={(income) => updateTheme({ income })} />
      <ColorPicker title="Màu khoản chi" presets={EXPENSE_PRESETS} value={settings.expense} onChange={(expense) => updateTheme({ expense })} />

      <Button
        title="Khôi phục màu mặc định"
        variant="secondary"
        icon="refresh"
        style={{ marginTop: 8 }}
        onPress={() => updateTheme({ primary: DEFAULT_THEME.primary, income: DEFAULT_THEME.income, expense: DEFAULT_THEME.expense } satisfies Partial<ThemeSettings>)}
      />
    </Body>
  );
}

function ColorPicker({ title, presets, value, onChange }: { title: string; presets: string[]; value: string; onChange: (hex: string) => void }) {
  const { colors: c } = useTheme();
  const [hex, setHex] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setHex(value);
  }
  const valid = normalizeHex(hex);

  return (
    <>
      <SectionHeader title={title} />
      <Card style={{ gap: 12 }}>
        <Row style={{ flexWrap: 'wrap' }} gap={10}>
          {presets.map((p) => (
            <PressableScale key={p} scaleTo={0.85} onPress={() => onChange(p)} style={[styles.swatch, { backgroundColor: p, borderColor: value === p ? c.text : 'transparent' }]}>
              {value === p && <Ionicons name="checkmark" size={20} color={readableOn(p)} />}
            </PressableScale>
          ))}
        </Row>
        <Field label="Mã màu tuỳ chỉnh (HEX)">
          <Row>
            <View style={[styles.hexPreview, { backgroundColor: valid ?? c.cardAlt, borderColor: c.border }]} />
            <Input style={{ flex: 1 }} value={hex} onChangeText={setHex} autoCapitalize="characters" autoCorrect={false} maxLength={7} placeholder="#4F46E5" />
            <Button title="Áp dụng" disabled={!valid || valid === value} onPress={() => valid && onChange(valid)} />
          </Row>
        </Field>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: 20, padding: 20 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  hexPreview: { width: 48, height: 48, borderRadius: 12, borderWidth: 1 },
});
