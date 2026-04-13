export function normalizeCouponCode(code: string) {
  return code.trim().replace(/\s+/g, "-").toUpperCase();
}
