import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    // freezeOnBlur: hidden tabs don't re-render when data changes; they catch up when shown again.
    <Tabs screenOptions={{ headerShown: false, animation: 'fade', freezeOnBlur: true }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Tổng quan' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Giao dịch' }} />
      <Tabs.Screen name="add" options={{ title: '' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Ngân sách' }} />
      <Tabs.Screen name="reports" options={{ title: 'Báo cáo' }} />
    </Tabs>
  );
}
