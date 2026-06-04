export function isPlausibleKey(k: string): boolean {
  const normalized = k.trim();
  return /^sk-[A-Za-z0-9]{16,}$/.test(normalized);
}
