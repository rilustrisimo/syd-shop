// Phone numbers arrive in whatever format people type: spaces, dashes,
// with or without +63/63, with or without the leading 0. Everything is
// stored and compared in the local 09XXXXXXXXX form.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length === 12) return '0' + digits.slice(2)
  if (digits.length === 10 && digits.startsWith('9')) return '0' + digits
  return digits
}

// PH mobile numbers only (09XXXXXXXXX after normalizing) — the welcome
// form exists to get a number staff can actually call or text.
export function isValidPhMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(raw))
}
