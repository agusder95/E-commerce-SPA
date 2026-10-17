export const PIN_LENGTH = 6;
export const RESEND_SECONDS = 300;
export const PENDING_EMAIL_KEY = "pending-auth-email";
export const PENDING_EMAIL_EXPIRES_KEY = "pending-auth-email-expires";

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
