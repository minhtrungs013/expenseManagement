import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/ThemeProvider';

import { errorHaptic, successHaptic } from './motion';

type ToastKind = 'success' | 'error';
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);
  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    counter.current += 1;
    if (kind === 'success') successHaptic();
    else errorHaptic();
    setToast({ id: counter.current, message, kind });
  }, []);
  const clear = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onDone={clear} />}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const hold = toast.kind === 'error' ? 2800 : 1500;
    y.value = withSequence(withSpring(0, { damping: 16, stiffness: 220 }), withDelay(hold, withTiming(-80, { duration: 220 })));
    opacity.value = withSequence(
      withTiming(1, { duration: 160 }),
      withDelay(hold + 120, withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(onDone)();
      })),
    );
  }, [toast.kind, y, opacity, onDone]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }] }));
  const isError = toast.kind === 'error';
  const bg = isError ? c.expense : c.dark ? '#F3F4F6' : '#111827';
  const fg = isError ? '#FFFFFF' : c.dark ? '#111827' : '#FFFFFF';

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }, style]}>
      <Animated.View style={[styles.toast, { backgroundColor: bg }]}>
        <Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={20} color={isError ? '#FFFFFF' : c.income} />
        <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
});
