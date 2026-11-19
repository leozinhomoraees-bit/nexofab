export function normalizeBrazilianPhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const withoutInternationalPrefix = digits.startsWith("00") ? digits.slice(2) : digits;
  if (withoutInternationalPrefix.startsWith("55") && (withoutInternationalPrefix.length === 12 || withoutInternationalPrefix.length === 13)) {
    return withoutInternationalPrefix;
  }
  if (withoutInternationalPrefix.length === 10 || withoutInternationalPrefix.length === 11) {
    return `55${withoutInternationalPrefix}`;
  }
  return "";
}

export function whatsappUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
