// Bump this when the privacy notice changes in a way students should re-read;
// every student is then asked to acknowledge it again on their next visit.
export const PRIVACY_VERSION = 1;

// True when the stored acknowledgement covers the current notice.
export function privacyAcknowledged(storedVersion: number | null | undefined): boolean {
  return typeof storedVersion === "number" && storedVersion >= PRIVACY_VERSION;
}
