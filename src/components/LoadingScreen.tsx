import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Must match the native splash in app.json (expo-splash-screen plugin) so the hand-off is seamless.
const LOGO_SIZE = 120;
const BG = { light: '#F3F4F6', dark: '#0B0D12' };
const BRAND = '#4F46E5';
/** Keep the screen up at least this long so it reads as intentional instead of flashing. */
const MIN_VISIBLE_MS = 700;

/**
 * Full-screen loader shown while the database and saved settings load.
 * Takes over from the native splash, then zooms and fades into the app once `ready` is true.
 */
export function LoadingScreen({ ready, error, onFinish }: { ready: boolean; error?: string | null; onFinish: () => void }) {
  const dark = useColorScheme() === 'dark';
  const mountedAt = useRef(Date.now());
  const [leaving, setLeaving] = useState(false);

  const logoScale = useSharedValue(1);
  const content = useSharedValue(0);
  const overlay = useSharedValue(1);
  const bar = useSharedValue(0);

  useEffect(() => {
    // Native splash → this screen: same background and logo, so the switch is invisible.
    SplashScreen.hideAsync().catch(() => {});
    content.value = withDelay(150, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
    logoScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 700, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) })),
      -1,
    );
    bar.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }), -1);
    return () => {
      cancelAnimation(logoScale);
      cancelAnimation(content);
      cancelAnimation(overlay);
      cancelAnimation(bar);
    };
  }, [logoScale, content, overlay, bar]);

  useEffect(() => {
    if (!ready || leaving) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => {
      setLeaving(true);
      cancelAnimation(logoScale);
      cancelAnimation(bar);
      logoScale.value = withTiming(1.15, { duration: 380, easing: Easing.out(Easing.cubic) });
      content.value = withTiming(0, { duration: 180 });
      overlay.value = withDelay(80, withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }));
    }, wait);
    return () => clearTimeout(t);
  }, [ready, leaving, logoScale, bar, content, overlay, onFinish]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ translateY: (1 - content.value) * 8 }] }));
  // Indeterminate bar: a short segment sweeping left → right.
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -48 + bar.value * 144 }] }));

  return (
    <Animated.View pointerEvents={leaving ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: dark ? BG.dark : BG.light }, overlayStyle]}>
      <Animated.View style={logoStyle}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.logo} />
      </Animated.View>
      <Animated.View style={[styles.below, contentStyle]}>
        <Text style={[styles.name, { color: dark ? '#F3F4F6' : '#111827' }]}>MoneyMate</Text>
        {error ? (
          <Text style={[styles.error, { color: dark ? '#FCA5A5' : '#DC2626' }]}>{error}</Text>
        ) : (
          <>
            <Text style={[styles.tagline, { color: dark ? '#9CA3AF' : '#6B7280' }]}>Quản lý chi tiêu cá nhân</Text>
            <View style={[styles.track, { backgroundColor: dark ? '#1F2430' : '#E5E7EB' }]}>
              <Animated.View style={[styles.barFill, barStyle]} />
            </View>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  // Positioned below the centred logo without moving it, so it lines up with the native splash.
  below: { position: 'absolute', top: '50%', marginTop: LOGO_SIZE / 2 + 24, alignItems: 'center', gap: 6, paddingHorizontal: 32 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  tagline: { fontSize: 13.5 },
  error: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  track: { width: 96, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 14 },
  barFill: { width: 48, height: 4, borderRadius: 2, backgroundColor: BRAND },
});
