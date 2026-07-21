import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Cross-platform alert.
 *
 * React Native's `Alert.alert` is a no-op on React Native Web, which makes
 * validation/errors silently disappear in the browser. This helper falls back
 * to the DOM `window.alert` / `window.confirm` on web so users always get
 * feedback, while behaving exactly like `Alert.alert` on native.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  // No buttons / single button → simple alert, then run the button handler.
  if (!buttons || buttons.length <= 1) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    buttons?.[0]?.onPress?.();
    return;
  }

  // Multiple buttons → confirm(). OK = first non-cancel action, Cancel = cancel action.
  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b.style !== 'cancel') || buttons[0];

  const confirmed =
    typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(text)
      : true;

  if (confirmed) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
