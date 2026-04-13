const DEFAULT_RATE = (() => {
  const raw = process.env.AFFILIATE_DEFAULT_COMMISSION_RATE;
  if (!raw) return 0.3;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0.3;
  return Math.min(Math.max(parsed, 0), 1);
})();

export const DEFAULT_AFFILIATE_COMMISSION_RATE = DEFAULT_RATE;
