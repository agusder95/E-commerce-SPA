export function userNameFromEmail(email) {
  return typeof email === 'string' ? email.trim().normalize('NFC').match(/^\p{L}+/u)?.[0] || '' : '';
}
