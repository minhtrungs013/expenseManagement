import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ACCOUNT_TYPES } from '@/components/finance';
import { Body, Button, Card, Chip, Field, Input, Row, Segmented, Txt } from '@/components/ui';
import { countAccountTransactions, deleteAccount, saveAccount, setAccountActive } from '@/db/repo';
import { formatAmountInput, formatMoney, parseAmount } from '@/domain/money';
import type { AccountType } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { closeScreen } from '@/state/nav';

/** Form state is initialized from loaded data, so wait until it is ready. */
export default function AccountEditScreen() {
  const { ready } = useData();
  return ready ? <AccountEdit /> : null;
}

function AccountEdit() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accounts, balances, mutate } = useData();
  const editing = id ? accounts.find((a) => a.id === Number(id)) : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<AccountType>(editing?.type ?? 'bank');
  const [initial, setInitial] = useState(Math.abs(editing?.initialBalance ?? 0));
  const [negative, setNegative] = useState((editing?.initialBalance ?? 0) < 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await mutate(
      (d) => saveAccount(d, { name, type, initialBalance: negative ? -initial : initial }, editing?.id),
      editing ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản',
    );
    setSaving(false);
    if (ok) closeScreen();
  };

  const toggleArchive = async () => {
    if (!editing) return;
    const ok = await mutate((d) => setAccountActive(d, editing.id, !editing.isActive), editing.isActive ? 'Đã lưu trữ tài khoản' : 'Đã khôi phục tài khoản');
    if (ok) closeScreen();
  };

  const remove = async () => {
    if (!editing) return;
    const n = await countAccountTransactions(db, editing.id);
    if (n > 0) {
      Alert.alert('Không thể xoá', `Tài khoản này có ${n} giao dịch. Hãy lưu trữ tài khoản để giữ lại lịch sử.`);
      return;
    }
    Alert.alert('Xoá tài khoản?', 'Không thể hoàn tác.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: async () => (await mutate((d) => deleteAccount(d, editing.id), 'Đã xoá tài khoản')) && closeScreen() },
    ]);
  };

  return (
    <Body>
      <Stack.Screen options={{ title: editing ? 'Sửa tài khoản' : 'Thêm tài khoản' }} />
      {editing && (
        <Card>
          <Txt variant="muted">Số dư hiện tại</Txt>
          <Txt style={{ fontSize: 24, fontWeight: '800' }}>{formatMoney(balances.get(editing.id) ?? 0)}</Txt>
        </Card>
      )}
      <Field label="Tên tài khoản">
        <Input value={name} onChangeText={setName} placeholder="VD: Vietcombank" maxLength={50} autoFocus={!editing} />
      </Field>
      <Field label="Loại">
        <Row style={{ flexWrap: 'wrap' }}>
          {ACCOUNT_TYPES.map((t) => (
            <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
          ))}
        </Row>
      </Field>
      <Field label="Số dư ban đầu (₫)">
        <Segmented
          options={[
            { value: 'pos', label: 'Số dư dương' },
            { value: 'neg', label: 'Đang nợ (âm)' },
          ]}
          value={negative ? 'neg' : 'pos'}
          onChange={(v) => setNegative(v === 'neg')}
        />
        <Input value={formatAmountInput(initial)} onChangeText={(t) => setInitial(parseAmount(t))} keyboardType="number-pad" placeholder="0" />
      </Field>
      <Txt variant="small">Số dư hiện tại = số dư ban đầu + thu − chi ± chuyển khoản. Ứng dụng luôn tự tính, bạn không cần nhập lại.</Txt>
      <Button title="Lưu" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {editing && (
        <>
          <Button title={editing.isActive ? 'Lưu trữ tài khoản' : 'Khôi phục tài khoản'} variant="secondary" icon={editing.isActive ? 'archive-outline' : 'refresh'} onPress={toggleArchive} />
          <Button title="Xoá tài khoản" variant="ghost" icon="trash-outline" onPress={remove} />
        </>
      )}
    </Body>
  );
}
