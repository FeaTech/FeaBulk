/** Normalize signup mobile numbers to E.164 for an India based business. */
export function normalizeSignupPhone(raw: string): string | null {
  const value = raw.replace(/[()\s-]/g, "");
  if (/^[6-9][0-9]{9}$/.test(value)) return `+91${value}`;
  if (/^91[6-9][0-9]{9}$/.test(value)) return `+${value}`;
  if (/^0[6-9][0-9]{9}$/.test(value)) return `+91${value.slice(1)}`;
  if (/^\+[1-9][0-9]{7,14}$/.test(value)) return value;
  return null;
}
