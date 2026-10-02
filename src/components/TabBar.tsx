import { router } from 'expo-router';
import type { Tabs } from 'expo-router/js-tabs';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/ThemeProvider';

import { PressableScale, tapHaptic } from './motion';
import { Ionicons, type IconName } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  transactions: ['receipt-outline', 'receipt'],
  budgets: ['pie-chart-outline', 'pie-chart'],
  reports: ['stats-chart-outline', 'stats-chart'],
};

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.card,
          paddingBottom: Math.max(insets.bottom, 10),
          borderTopColor: c.border,
          boxShadow: c.dark ? 'none' : '0px -4px 16px rgba(15, 23, 42, 0.08)',
        },
      ]}
    >
      {state.routes.map((route, i) => {
        if (route.name === 'add') return <AddButton key={route.key} />;
        const focused = state.index === i;
        const { options } = descriptors[route.key];
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            tapHaptic();
            navigation.navigate(route.name, route.params);
          }
        };
        return <TabItem key={route.key} label={String(options.title ?? route.name)} icons={ICONS[route.name] ?? ['ellipse-outline', 'ellipse']} focused={focused} onPress={onPress} />;
      })}
    </View>
  );
}

function TabItem({ label, icons, focused, onPress }: { label: string; icons: [IconName, IconName]; focused: boolean; onPress: () => void }) {
  const c = useColors();
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [focused, p]);

  const pillStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scaleX: 0.5 + p.value * 0.5 }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -p.value * 1.5 }, { scale: 1 + p.value * 0.08 }] }));
  const color = focused ? c.link : c.textMuted;

  return (
    <PressableScale onPress={onPress} scaleTo={0.9} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
      <View style={styles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: c.primarySoft }, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Ionicons name={focused ? icons[1] : icons[0]} size={22} color={color} />
        </Animated.View>
      </View>
      <Text numberOfLines={1} style={[styles.label, { color, fontWeight: focused ? '700' : '600' }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function AddButton() {
  const c = useColors();
  return (
    <View style={styles.item}>
      <PressableScale
        accessibilityLabel="Thêm giao dịch"
        haptic
        scaleTo={0.88}
        onPress={() => router.push('/transaction')}
        style={[styles.fab, { backgroundColor: c.primary, borderColor: c.card, boxShadow: `0px 6px 14px ${c.primary}59` }]}
      >
        <Ionicons name="add" size={30} color={c.onPrimary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 15 },
  label: { fontSize: 11 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
});
