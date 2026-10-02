import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BudgetStatus } from '@/domain/calc';
import type { Palette } from '@/theme/colors';
import { useColors } from '@/theme/ThemeProvider';

import { PressableScale, tapHaptic } from './motion';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

export const RADIUS = { sm: 10, md: 14, lg: 20 };

/** Soft shadow in light mode, hairline border in dark mode. */
export function surface(c: Palette): ViewStyle {
  return c.dark
    ? { backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }
    : {
        backgroundColor: c.card,
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      };
}

// ---------- Text ----------

type TxtVariant = 'display' | 'title' | 'h2' | 'body' | 'label' | 'muted' | 'small';

export function Txt({ variant = 'body', color, style, ...rest }: TextProps & { variant?: TxtVariant; color?: string }) {
  const c = useColors();
  const defaultColor = variant === 'muted' || variant === 'small' || variant === 'label' ? c.textMuted : c.text;
  return <Text {...rest} style={[textStyles[variant], { color: color ?? defaultColor }, style]} />;
}

const textStyles = StyleSheet.create({
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  muted: { fontSize: 14, lineHeight: 19 },
  small: { fontSize: 12.5, lineHeight: 17 },
});

// ---------- Layout ----------

/** Top-level page used by tabs (no native header). */
export function TabScreen({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.tabHeader}>
        <View style={{ flex: 1 }}>
          {subtitle && <Txt variant="small">{subtitle}</Txt>}
          <Txt variant="title" numberOfLines={1}>
            {title}
          </Txt>
        </View>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

/** Scrollable page body with standard padding. Leaves room for the floating tab bar. */
export function Body({ children, style, tabBarSpace = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; tabBarSpace?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: 16, paddingBottom: (tabBarSpace ? 96 : 32) + insets.bottom, gap: 12 }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const cardStyle = [styles.card, surface(c), style];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.98} style={cardStyle}>
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 10, minHeight: 28 }}>
      <Txt variant="h2">{title}</Txt>
      {action && (
        <PressableScale onPress={onAction} hitSlop={10} style={[styles.linkPill, { backgroundColor: c.primarySoft }]}>
          <Txt variant="small" style={{ fontWeight: '700' }} color={c.link}>
            {action}
          </Txt>
        </PressableScale>
      )}
    </Row>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  color,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  /** Overrides the primary background (e.g. red for "save expense"). */
  color?: string;
}) {
  const c = useColors();
  const bg = { primary: color ?? c.primary, secondary: c.cardAlt, danger: c.expense, ghost: 'transparent' }[variant];
  const fg = { primary: color ? '#FFFFFF' : c.onPrimary, secondary: c.text, danger: '#FFFFFF', ghost: c.expense }[variant];
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      haptic
      style={[styles.button, { backgroundColor: bg, opacity: isDisabled && !loading ? 0.45 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={8}>
          {icon && <Ionicons name={icon} size={19} color={fg} />}
          <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        </Row>
      )}
    </PressableScale>
  );
}

export function IconButton({ name, onPress, color, size = 22, filled = false }: { name: IconName; onPress: () => void; color?: string; size?: number; filled?: boolean }) {
  const c = useColors();
  return (
    <PressableScale onPress={onPress} hitSlop={8} scaleTo={0.88} style={[styles.iconButton, filled && surface(c)]}>
      <Ionicons name={name} size={size} color={color ?? c.text} />
    </PressableScale>
  );
}

// ---------- Selection ----------

/** Segmented control with a sliding indicator. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  colorFor,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colorFor?: (v: T) => string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width > 0 ? (width - 8) / options.length : 0;
  const activeBg = colorFor?.(value) ?? c.primary;
  const activeFg = colorFor ? '#FFFFFF' : c.onPrimary;

  const x = useSharedValue(index * segW);
  const bg = useSharedValue(activeBg);
  useEffect(() => {
    x.value = withTiming(index * segW, { duration: 240, easing: Easing.out(Easing.cubic) });
    bg.value = withTiming(activeBg, { duration: 220 });
  }, [index, segW, activeBg, x, bg]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], backgroundColor: bg.value }));

  return (
    <View style={[styles.segmented, { backgroundColor: c.cardAlt }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segW > 0 && <Animated.View style={[styles.segIndicator, { width: segW }, indicatorStyle]} />}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            scaleTo={0.94}
            onPress={() => {
              if (!active) tapHaptic();
              onChange(o.value);
            }}
            style={styles.segment}
          >
            <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 14, color: active ? activeFg : c.textMuted }}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress, color, icon }: { label: string; selected?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  const c = useColors();
  const accent = color ?? c.primary;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      style={[
        styles.chip,
        {
          borderColor: selected ? accent : c.border,
          backgroundColor: selected ? (color ? accent + '22' : c.primarySoft) : c.card,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? c.link : c.textMuted} />}
      <Text style={{ color: selected ? c.text : c.textMuted, fontSize: 13.5, fontWeight: selected ? '700' : '600' }}>{label}</Text>
    </PressableScale>
  );
}

// ---------- Inputs ----------

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      {children}
    </View>
  );
}

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

export function Input(props: TextInputProps) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={c.textMuted}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        { backgroundColor: c.card, borderColor: focused ? c.primary : c.border, color: c.text },
        webNoOutline,
        props.style,
      ]}
    />
  );
}

/** A tappable field that looks like an input and opens a picker. */
export function SelectField({ value, placeholder, onPress, left }: { value?: string; placeholder: string; onPress: () => void; left?: ReactNode }) {
  const c = useColors();
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={[styles.input, styles.select, { backgroundColor: c.card, borderColor: c.border }]}>
      {left}
      <Text style={{ color: value ? c.text : c.textMuted, fontSize: 15.5, flex: 1, fontWeight: value ? '600' : '400' }} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={18} color={c.textMuted} />
    </PressableScale>
  );
}

// ---------- Bottom sheet ----------

/** Bottom sheet: backdrop fades while the panel slides; animates out before unmounting. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const height = useSharedValue(600);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * height.value }] }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, backdropStyle]}>
        <PressableScale scaleTo={1} style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Đóng">
          <View />
        </PressableScale>
      </Animated.View>
      <Animated.View
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
        }}
        style={[styles.sheet, { backgroundColor: c.card, paddingBottom: 16 + insets.bottom }, panelStyle]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Txt variant="h2">{title}</Txt>
          <IconButton name="close" onPress={onClose} />
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export interface PickerOption<T> {
  value: T;
  label: string;
  sublabel?: string;
  left?: ReactNode;
}

export function PickerSheet<T>({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<T>[];
  value: T | null | undefined;
  onSelect: (v: T) => void;
}) {
  const c = useColors();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.length === 0 && <Txt variant="muted">Không có lựa chọn nào</Txt>}
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={i}
            scaleTo={0.97}
            onPress={() => {
              tapHaptic();
              onSelect(o.value);
              onClose();
            }}
            style={[styles.option, selected && { backgroundColor: c.primarySoft }]}
          >
            {o.left}
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: selected ? '700' : '500' }}>{o.label}</Txt>
              {o.sublabel && <Txt variant="small">{o.sublabel}</Txt>}
            </View>
            {selected && <Ionicons name="checkmark-circle" size={22} color={c.link} />}
          </PressableScale>
        );
      })}
    </Sheet>
  );
}

// ---------- Display ----------

export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.62, textAlign: 'center' }}>{icon}</Text>
    </View>
  );
}

export function IconBadge({ name, color, size = 40, bg }: { name: IconName; color: string; size?: number; bg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg ?? color + '1F', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

export function statusColor(c: Palette, status: BudgetStatus): string {
  return status === 'exceeded' ? c.expense : status === 'warning' ? c.warning : c.income;
}

/**
 * Horizontal fill that grows from the left. Animates a transform (scaleX) rather than width,
 * so each frame runs on the UI thread without re-running layout.
 */
export function FillBar({ percent, color, height = 8, trackColor }: { percent: number; color: string; height?: number; trackColor?: string }) {
  const c = useColors();
  const target = Math.min(100, Math.max(0, percent)) / 100;
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(scale);
  }, [target, scale]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.value }] }));
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor ?? c.cardAlt, height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, fillStyle]} />
    </View>
  );
}

export function ProgressBar({ percent, status, height = 8 }: { percent: number; status: BudgetStatus; height?: number }) {
  const c = useColors();
  return <FillBar percent={percent} color={statusColor(c, status)} height={height} />;
}

export function statusLabel(status: BudgetStatus): string {
  return { normal: 'Ổn định', warning: 'Sắp hết', exceeded: 'Vượt ngân sách' }[status];
}

export function EmptyState({ icon, title, message, action, onAction }: { icon: IconName; title: string; message: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyHalo, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={34} color={c.link} />
      </View>
      <Txt variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="muted" style={{ textAlign: 'center', maxWidth: 280 }}>
        {message}
      </Txt>
      {action && onAction && <Button title={action} icon="add" onPress={onAction} style={{ marginTop: 8, paddingHorizontal: 24 }} />}
    </View>
  );
}

/** Pulsing placeholder blocks shown while data loads. */
export function Skeleton({ height = 72, count = 3 }: { height?: number; count?: number }) {
  const c = useColors();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    // Infinite animations must be stopped explicitly, or they keep running after unmount.
    return () => cancelAnimation(o);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ gap: 12 }, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height, borderRadius: RADIUS.lg, backgroundColor: c.cardAlt }} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, minHeight: 56 },
  card: { borderRadius: RADIUS.lg, padding: 16 },
  linkPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  button: { minHeight: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: RADIUS.md, padding: 4, position: 'relative' },
  segIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: RADIUS.sm },
  segment: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1 },
  input: { borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 50, fontSize: 15.5 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, maxHeight: '82%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: RADIUS.md, marginBottom: 2 },
  progressTrack: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%', transformOrigin: 'left' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  emptyHalo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
