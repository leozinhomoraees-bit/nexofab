export function compactQuoteSummary(values: string[], maxLength: number, fallback: string) {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (!unique.length) return fallback;
  let summary = "";
  let included = 0;
  for (const value of unique) {
    const remaining = unique.length - included - 1;
    const suffix = remaining > 0 ? ` + ${remaining} outro(s)` : "";
    const candidate = summary ? `${summary}; ${value}` : value;
    if (`${candidate}${suffix}`.length > maxLength) break;
    summary = candidate;
    included += 1;
  }
  if (!summary) return `${unique[0].slice(0, Math.max(1, maxLength - 1))}…`.slice(0, maxLength);
  const remaining = unique.length - included;
  return `${summary}${remaining > 0 ? ` + ${remaining} outro(s)` : ""}`.slice(0, maxLength);
}
