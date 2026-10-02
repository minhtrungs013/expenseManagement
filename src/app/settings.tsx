import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { useToast } from '@/components/Toast';
import { Body, Card, Divider, IconBadge, Ionicons, Row, SectionHeader, Txt, type IconName } from '@/components/ui';
import { exportBackup, importBackup, resetAllData } from '@/db/repo';
import { seedDefaults } from '@/db/schema';
import { today } from '@/domain/dates';
import { AppError } from '@/domain/validation';
import { errorMessage, useData } from '@/state/DataProvider';
import { useColors, useTheme } from '@/theme/ThemeProvider';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { reloadTheme } = useTheme();
  const { mutate, transactions } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const doExport = async () => {
    setBusy('export');
    try {
      const backup = await exportBackup(db);
      const file = new File(Paths.cache, `moneymate-backup-${today()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(backup));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Lưu bản sao lưu MoneyMate', UTI: 'public.json' });
      } else {
        toast('Thiết bị không hỗ trợ chia sẻ file', 'error');
      }
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      let data: unknown;
      try {
        data = JSON.parse(await new File(result.assets[0].uri).text());
      } catch {
        throw new AppError('Không đọc được file. Hãy chọn file .json do MoneyMate xuất ra.');
      }
      Alert.alert('Khôi phục dữ liệu?', 'Toàn bộ dữ liệu hiện tại sẽ được thay thế bằng dữ liệu trong bản sao lưu.', [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Khôi phục',
          style: 'destructive',
          onPress: async () => {
            if (await mutate((d) => importBackup(d, data), 'Đã khôi phục dữ liệu')) await reloadTheme();
          },
        },
      ]);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doReset = () => {
    Alert.alert('Xoá toàn bộ dữ liệu?', `${transactions.length} giao dịch, mọi tài khoản, danh mục và ngân sách sẽ bị xoá vĩnh viễn. Hãy xuất bản sao lưu trước nếu cần.`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá hết', style: 'destructive', onPress: () => mutate((d) => resetAllData(d, seedDefaults), 'Đã xoá toàn bộ dữ liệu') },
    ]);
  };

  return (
    <Body>
      <SectionHeader title="Quản lý" />
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem icon="wallet-outline" label="Tài khoản" onPress={() => router.push('/accounts')} />
        <Divider />
        <MenuItem icon="pricetags-outline" label="Danh mục" onPress={() => router.push('/categories')} />
        <Divider />
        <MenuItem icon="pie-chart-outline" label="Ngân sách" onPress={() => router.push('/budgets')} />
      </Card>

      <SectionHeader title="Giao diện" />
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem icon="color-palette-outline" label="Màu sắc & chế độ tối" onPress={() => router.push('/appearance')} />
      </Card>

      <SectionHeader title="Dữ liệu" />
      <Txt variant="small">Dữ liệu chỉ được lưu trên điện thoại này. Hãy xuất bản sao lưu định kỳ (gửi qua Zalo, Drive, email…) để không bị mất khi đổi máy hoặc gỡ ứng dụng.</Txt>
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem icon="cloud-upload-outline" label="Xuất bản sao lưu (.json)" onPress={doExport} right={busy === 'export' ? <ActivityIndicator /> : undefined} />
        <Divider />
        <MenuItem icon="cloud-download-outline" label="Khôi phục từ bản sao lưu" onPress={doImport} right={busy === 'import' ? <ActivityIndicator /> : undefined} />
        <Divider />
        <MenuItem icon="trash-outline" label="Xoá toàn bộ dữ liệu" color={c.expense} onPress={doReset} />
      </Card>

      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Txt variant="small">MoneyMate v{Constants.expoConfig?.version ?? '1.0.0'} · Tiền tệ: VND (₫)</Txt>
      </View>
    </Body>
  );
}

function MenuItem({ icon, label, onPress, color, right }: { icon: IconName; label: string; onPress: () => void; color?: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <Row style={{ paddingVertical: 12 }} gap={12}>
        <IconBadge name={icon} color={color ?? c.link} size={34} />
        <Txt style={{ flex: 1, fontWeight: '500' }} color={color}>
          {label}
        </Txt>
        {right ?? <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
      </Row>
    </PressableScale>
  );
}
