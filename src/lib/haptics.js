// The small taps you feel under your finger in iPhone apps. Silent no-ops
// anywhere the Taptic Engine is not available.

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './native.js';

const run = (work) => {
  if (!isNative) return;
  try {
    Promise.resolve(work()).catch(() => {});
  } catch {
    // not available on this device
  }
};

export const tap = () => run(() => Haptics.impact({ style: ImpactStyle.Light }));
export const select = tap;
export const success = () => run(() => Haptics.notification({ type: NotificationType.Success }));
export const warning = () => run(() => Haptics.notification({ type: NotificationType.Warning }));
