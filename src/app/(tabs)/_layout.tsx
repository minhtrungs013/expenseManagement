import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Tổng quan' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Giao dịch' }} />
      <Tabs.Screen name="add" options={{ title: '' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Ngân sách' }} />
      <Tabs.Screen name="reports" options={{ title: 'Báo cáo' }} />
    </Tabs>
  );
}
