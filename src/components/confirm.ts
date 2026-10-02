import { Alert, Platform } from 'react-native';

/** Yes/cancel confirmation that also works in the browser preview (Alert is a no-op on web). */
export function confirmAction(title: string, message: string, confirmText: string, onConfirm: () => void, destructive = false): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Huỷ', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
