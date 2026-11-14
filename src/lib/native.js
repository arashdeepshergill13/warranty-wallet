// Bridge to the small Swift plugin in plugins/wallet-native. It gives the app
// Apple's document scanner, on-device text recognition and Face ID. In a web
// browser none of these exist, so every call here degrades quietly.

import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
const WalletNative = registerPlugin('WalletNative');

export async function scannerAvailable() {
  if (!isNative) return false;
  try {
    return Boolean((await WalletNative.isScannerAvailable()).available);
  } catch {
    return false;
  }
}

// -> { cancelled: true } | { pages: [{ image: base64Jpeg, lines: [...] }] }
// Throws an error with code 'CAMERA_DENIED' when camera access is switched off.
export async function scanDocument() {
  const result = await WalletNative.scanDocument({ maxPages: 3 });
  if (result.cancelled) return { cancelled: true };
  return { pages: Array.isArray(result.pages) ? result.pages : [] };
}

// -> [{ text, x, y, w, h }]; empty when text recognition is not available.
export async function recognizeText(base64Jpeg) {
  if (!isNative) return [];
  try {
    const result = await WalletNative.recognizeText({ image: base64Jpeg });
    return Array.isArray(result.lines) ? result.lines : [];
  } catch {
    return [];
  }
}

// -> { available, kind: 'faceID' | 'touchID' | 'passcode' | 'none' }
export async function lockStatus() {
  if (!isNative) return { available: false, kind: 'none' };
  try {
    const result = await WalletNative.lockStatus();
    return { available: Boolean(result.available), kind: result.kind || 'none' };
  } catch {
    return { available: false, kind: 'none' };
  }
}

// -> true when the person proved it is them (Face ID, Touch ID or passcode).
// If the phone has no passcode at all there is nothing to check against, so
// the app opens rather than locking the person out of their own receipts.
export async function unlock(reason) {
  if (!isNative) return true;
  try {
    const result = await WalletNative.authenticate({ reason });
    return result.available === false ? true : Boolean(result.success);
  } catch {
    return false;
  }
}

// Hides the app's contents in the iOS app switcher.
export async function setPrivacyScreen(enabled) {
  if (!isNative) return;
  try {
    await WalletNative.setPrivacyScreen({ enabled: Boolean(enabled) });
  } catch {
    // not available on this platform
  }
}

export async function openAppSettings() {
  if (!isNative) return;
  try {
    await WalletNative.openSettings();
  } catch {
    // ignore
  }
}

export function lockLabel(kind) {
  if (kind === 'faceID') return 'Face ID';
  if (kind === 'touchID') return 'Touch ID';
  return 'passcode';
}
