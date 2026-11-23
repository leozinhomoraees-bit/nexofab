export type CsvCell = string | number | boolean | null | undefined;

function sanitizeCsvValue(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "";
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";

  let text = String(value).replace(/\r\n/g, " ").replace(/[\r\n]/g, " ");
  // Mitiga CSV formula injection em planilhas (Excel/LibreOffice)
  if (/^[=+\-@\t]/.test(text)) {
    text = `'${text}`;
  }
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const headerLine = headers.map((header) => sanitizeCsvValue(header)).join(";");
  const dataLines = rows.map((row) => row.map((cell) => sanitizeCsvValue(cell)).join(";"));
  return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}`;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
