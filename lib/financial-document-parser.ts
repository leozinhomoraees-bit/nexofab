import pdf from "pdf-parse/lib/pdf-parse.js";

export type ExtractedInstallment = { number: number; dueDate: string; amount: number; digitableLine?: string };
export type ExtractedFinancialDocument = {
  documentKind: "boleto" | "nota_fiscal" | "fatura" | "outro";
  supplierName: string;
  supplierDocument: string;
  documentNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number | null;
  digitableLine: string;
  installments: ExtractedInstallment[];
  confidence: number;
  needsOcr: boolean;
  warnings: string[];
  extractedTextPreview: string;
};

function compact(value?: string | null) { return (value ?? "").replace(/\s+/g, " ").trim(); }
function digits(value?: string | null) { return (value ?? "").replace(/\D/g, ""); }
function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:(?:\\w+):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i"));
  return compact(match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "));
}
function xmlBlock(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<(?:(?:\\w+):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "gi"))].map((item) => item[1]);
}
function amount(value?: string | null) {
  if (!value) return null;
  const cleaned = value.replace(/R\$\s?/gi, "").replace(/\s/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}
function isoDate(value?: string | null) {
  if (!value) return "";
  const clean = value.trim();
  const iso = clean.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = clean.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : "";
}
function nearby(text: string, labels: string[], valuePattern: string, flags = "i") {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[^\\n\\r]{0,50}?[\\s:](${valuePattern})`, flags));
    if (match?.[1]) return compact(match[1]);
  }
  return "";
}
function score(fields: Array<unknown>) { return Math.round(fields.filter(Boolean).length / fields.length * 100); }

export function parseFinancialXml(xml: string): ExtractedFinancialDocument {
  const issuer = xmlBlock(xml, "emit")[0] ?? xml;
  const supplierName = xmlValue(issuer, "xNome") || xmlValue(xml, "beneficiario") || xmlValue(xml, "cedente");
  const supplierDocument = digits(xmlValue(issuer, "CNPJ") || xmlValue(issuer, "CPF"));
  const documentNumber = xmlValue(xmlBlock(xml, "ide")[0] ?? xml, "nNF") || xmlValue(xml, "nFat") || xmlValue(xml, "numeroDocumento");
  const issueDate = isoDate(xmlValue(xml, "dhEmi") || xmlValue(xml, "dEmi") || xmlValue(xml, "dataEmissao"));
  const duplicateBlocks = xmlBlock(xml, "dup");
  const installments = duplicateBlocks.map((block, index) => ({
    number: Number(xmlValue(block, "nDup")) || index + 1,
    dueDate: isoDate(xmlValue(block, "dVenc")),
    amount: amount(xmlValue(block, "vDup")) ?? 0,
  })).filter((item) => item.amount > 0);
  const totalAmount = amount(xmlValue(xmlBlock(xml, "ICMSTot")[0] ?? xml, "vNF") || xmlValue(xml, "vLiq") || xmlValue(xml, "valorDocumento"))
    ?? (installments.length ? Math.round(installments.reduce((sum, item) => sum + item.amount, 0) * 100) / 100 : null);
  const dueDate = installments[0]?.dueDate || isoDate(xmlValue(xml, "dataVencimento") || xmlValue(xml, "vencimento"));
  const documentKind = /<(?:(?:\w+):)?NFe[\s>]/i.test(xml) ? "nota_fiscal" : /boleto|linha.?digit[aá]vel/i.test(xml) ? "boleto" : "fatura";
  const confidence = score([supplierName, supplierDocument, documentNumber, issueDate, dueDate, totalAmount]);
  const warnings: string[] = [];
  if (!supplierName) warnings.push("Fornecedor não identificado no XML.");
  if (!totalAmount) warnings.push("Valor total não identificado no XML.");
  if (!dueDate) warnings.push("Vencimento não identificado; informe antes de salvar.");
  return { documentKind, supplierName, supplierDocument, documentNumber, issueDate, dueDate, totalAmount, digitableLine: "", installments, confidence, needsOcr: false, warnings, extractedTextPreview: compact(xml).slice(0, 900) };
}

export async function parseFinancialPdf(buffer: Buffer): Promise<ExtractedFinancialDocument> {
  const parsed = await pdf(buffer);
  const text = parsed.text ?? "";
  const normalized = text.replace(/\u00a0/g, " ");
  const candidates = normalized.match(/(?:\d[ .-]?){44,50}/g) ?? [];
  const digitableLine = candidates.map(digits).find((item) => item.length === 47 || item.length === 48) ?? "";
  const supplierDocument = digits(nearby(normalized, ["CNPJ(?:\\/CPF)?(?: do)? Benefici[aá]rio", "Benefici[aá]rio[\\s\\S]{0,80}?CNPJ", "Cedente[\\s\\S]{0,80}?CNPJ"], "(?:\\d[.\\/-]?){11,18}"));
  const supplierName = nearby(normalized, ["Nome do Benefici[aá]rio", "Benefici[aá]rio", "Cedente"], "[^\\n\\r]{3,90}");
  const dueDate = isoDate(nearby(normalized, ["Data de Vencimento", "Vencimento"], "\\d{2}\\/\\d{2}\\/20\\d{2}"));
  const issueDate = isoDate(nearby(normalized, ["Data de Emiss[aã]o", "Emiss[aã]o", "Data do Documento"], "\\d{2}\\/\\d{2}\\/20\\d{2}"));
  const valueText = nearby(normalized, ["Valor Cobrado", "Valor do Documento", "Valor Documento", "Valor Total"], "(?:R\\$\\s*)?[0-9.]+,[0-9]{2}");
  const totalAmount = amount(valueText);
  const documentNumber = nearby(normalized, ["N(?:ú|u)mero do Documento", "N(?:º|o\\.)? Documento", "Nosso N(?:ú|u)mero"], "[A-Za-z0-9.\\/-]{3,40}");
  const sparse = compact(normalized).length < 80;
  const confidence = sparse ? 0 : score([supplierName, supplierDocument, documentNumber, dueDate, totalAmount, digitableLine]);
  const warnings: string[] = [];
  if (sparse) warnings.push("O PDF parece ser uma imagem digitalizada e precisa de OCR.");
  if (!supplierName) warnings.push("Confira o fornecedor: o nome não foi identificado com segurança.");
  if (!totalAmount) warnings.push("Confira o valor: ele não foi identificado com segurança.");
  if (!dueDate) warnings.push("Confira o vencimento: a data não foi identificada.");
  return {
    documentKind: digitableLine || /boleto|ficha de compensa[cç][aã]o/i.test(normalized) ? "boleto" : "fatura",
    supplierName, supplierDocument, documentNumber, issueDate, dueDate, totalAmount, digitableLine,
    installments: totalAmount && dueDate ? [{ number: 1, dueDate, amount: totalAmount, digitableLine }] : [],
    confidence, needsOcr: sparse, warnings, extractedTextPreview: compact(normalized).slice(0, 900),
  };
}
