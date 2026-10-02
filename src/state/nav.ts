import { router } from 'expo-router';

/** Closes a form screen; falls back to Home when there is nothing to go back to (e.g. opened via deep link). */
export function closeScreen(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
