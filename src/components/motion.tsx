import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Timing (not spring) for presses: no overshoot wobble, same feel on every device.
const PRESS_IN = { duration: 90, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { duration: 160, easing: Easing.out(Easing.cubic) };

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
        scale.value = withTiming(scaleTo, PRESS_IN);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, PRESS_OUT);
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

/**
 * Staggered entrance for stacked sections: pass the section's index.
 * Plain timing (no spring) keeps it cheap and free of overshoot jitter.
 */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 40).duration(260)} style={style}>
      {children}
    </Animated.View>
  );
}

const COUNT_FRAME_MS = 33; // ~30 updates/s is smooth for digits and halves the JS work vs 60 fps

/**
 * Animates a number from its previous value to the new one (used for the main balance).
 * Each step re-renders only the component that calls this hook.
 */
export function useCountUp(target: number, duration = 450): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const start = current.current;
    if (start === target) return;
    const t0 = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const v = p >= 1 ? target : Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      current.current = v;
      setValue(v);
      if (p >= 1) clearInterval(timer);
    }, COUNT_FRAME_MS);
    return () => {
      clearInterval(timer);
      // If interrupted, jump to the final value so the next animation starts from the truth.
      current.current = target;
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
    return () => cancelAnimation(p);
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
