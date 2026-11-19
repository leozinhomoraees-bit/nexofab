type MaterialLabelInput = { name: string; thickness_mm?: number | null };

type MaterialOptionInput = MaterialLabelInput & {
  format?: string | null;
  width_mm?: number | null;
  usable_width_mm?: number | null;
  height_mm?: number | null;
  length_m?: number | null;
};

const decimal = (value: number, maximumFractionDigits = 3) => value.toLocaleString("pt-BR", { maximumFractionDigits });

export function materialDisplayName(material?: MaterialLabelInput | null) {
  if (!material) return "";
  const name = material.name.trim();
  const thickness = Number(material.thickness_mm ?? 0);
  if (!thickness || /\b\d+(?:[.,]\d+)?\s*mm\b/i.test(name)) return name;
  return `${name} ${thickness.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}mm`;
}

export function materialOptionLabel(material?: MaterialOptionInput | null) {
  if (!material) return "";
  const name = materialDisplayName(material);
  const format = material.format ?? "insumo";
  const width = Number(material.usable_width_mm || material.width_mm || 0);
  const height = Number(material.height_mm || 0);
  const length = Number(material.length_m || 0);

  if (format === "chapa") return `${name}${width && height ? ` · ${decimal(width)} × ${decimal(height)} mm` : ""} · chapa`;
  if (format === "rolo") return `${name}${width ? ` · largura ${decimal(width / 1000)} m` : ""}${length ? ` · rolo ${decimal(length)} m` : ""}`;
  if (format === "metro") return `${name}${width ? ` · largura ${decimal(width / 1000)} m` : ""} · metro linear`;
  if (format === "barra") return `${name}${width && height ? ` · seção ${decimal(width)} × ${decimal(height)} mm` : ""}${length ? ` · barra ${decimal(length)} m` : " · barra"}`;
  const labels: Record<string, string> = { unidade: "unidade", litro: "litro", kg: "quilo", servico: "serviço" };
  return `${name} · ${labels[format] ?? format}`;
}
