import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { accountTypeMeta } from '@/components/finance';
import { Body, Button, Card, Divider, IconBadge, IconButton, Ionicons, Row, SectionHeader, Txt } from '@/components/ui';
import { totalBalance } from '@/domain/calc';
import { formatMoney } from '@/domain/money';
import type { Account } from '@/domain/types';
import { useData } from '@/state/DataProvider';
import { useColors } from '@/theme/ThemeProvider';

export default function AccountsScreen() {
  const c = useColors();
  const { accounts, balances } = useData();
  const active = accounts.filter((a) => a.isActive);
  const archived = accounts.filter((a) => !a.isActive);

  const list = (items: Account[], muted = false) => (
    <Card style={{ paddingVertical: 4 }}>
      {items.map((a, i) => {
        const bal = balances.get(a.id) ?? 0;
        return (
          <View key={a.id}>
            {i > 0 && <Divider />}
            <PressableScale onPress={() => router.push({ pathname: '/accounts/edit', params: { id: a.id } })} scaleTo={0.98} style={{ opacity: muted ? 0.6 : 1 }}>
            <Row style={{ paddingVertical: 12 }} gap={12}>
              <IconBadge name={accountTypeMeta(a.type).icon} color={c.link} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '600' }} numberOfLines={1}>
                  {a.name}
                </Txt>
                <Txt variant="small">{accountTypeMeta(a.type).label}</Txt>
              </View>
              <Txt style={{ fontWeight: '700' }} color={bal < 0 ? c.expense : c.text}>
                {formatMoney(bal)}
              </Txt>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Row>
            </PressableScale>
          </View>
        );
      })}
    </Card>
  );

  return (
    <Body>
      <Stack.Screen options={{ headerRight: () => <IconButton name="add" onPress={() => router.push('/accounts/edit')} /> }} />
      <Card>
        <Txt variant="muted">Tổng số dư (tài khoản đang dùng)</Txt>
        <Txt style={{ fontSize: 28, fontWeight: '800', marginTop: 4 }}>{formatMoney(totalBalance(accounts, balances))}</Txt>
      </Card>
      {active.length > 0 ? list(active) : <Txt variant="muted">Chưa có tài khoản nào đang dùng.</Txt>}
      <Button title="Thêm tài khoản" icon="add" variant="secondary" onPress={() => router.push('/accounts/edit')} />
      {archived.length > 0 && (
        <>
          <SectionHeader title="Đã lưu trữ" />
          <Txt variant="small">Tài khoản lưu trữ không được tính vào tổng số dư nhưng vẫn giữ lịch sử giao dịch.</Txt>
          {list(archived, true)}
        </>
      )}
    </Body>
  );
}
