import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 15, stiffness: 320, mass: 0.6 };

/** Pressable that shrinks slightly while pressed — the base for every tappable surface. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = false,
  onPress,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) tapHaptic();
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Staggered entrance for stacked sections: pass the section's index. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(380).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Animates a number from its previous value to the new one (used for balances). */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (target - start) * eased);
      setValue(v);
      from.current = v;
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}

/** A value that eases from 0 to 1 once on mount (drives chart / progress reveal). */
export function useReveal(duration = 700, deps: unknown[] = []) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withTiming(1, { duration });
  }, deps); // re-reveal only when the caller's data changes
  return p;
}

const hapticsOn = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapHaptic() {
  if (hapticsOn) Haptics.selectionAsync().catch(() => {});
}

export function successHaptic() {
  if (hapticsOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function errorHaptic() {
  if (hapticsOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
