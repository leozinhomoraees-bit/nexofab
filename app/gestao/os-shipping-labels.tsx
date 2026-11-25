"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Package, Printer, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LabelOrder = {
  id: string;
  number: number;
  title: string;
  due_at?: string | null;
  quotes?: {
    number?: number;
    customer_name?: string;
    company?: string | null;
    phone?: string | null;
    service?: string;
  } | null;
};

const notePresets = [
  "FRÁGIL · NÃO DOBRAR",
  "RETIRADA NO BALCÃO",
  "INSTALAÇÃO EXTERNA",
  "CONFERIR NA ENTREGA",
];

function escapeHtml(raw: string) {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function OsShippingLabelsDialog({
  order,
  onClose,
}: {
  order: LabelOrder;
  onClose: () => void;
}) {
  const [volumes, setVolumes] = useState("1");
  const [format, setFormat] = useState<"thermal" | "a4">("thermal");
  const [handlingNote, setHandlingNote] = useState("FRÁGIL · NÃO DOBRAR");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://nexofab.vercel.app";
    const url = `${origin}/gestao?secao=producao&os=${encodeURIComponent(order.id)}`;
    QRCode.toDataURL(url, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#081927", light: "#ffffff" },
    })
      .then((res) => { if (active) setQrDataUrl(res); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [order.id]);

  const count = Math.min(30, Math.max(1, Math.floor(Number(volumes || 1))));
  const clientName = order.quotes?.company || order.quotes?.customer_name || "Cliente";
  const contactLine = [
    order.quotes?.company && order.quotes?.customer_name ? order.quotes.customer_name : null,
    order.quotes?.phone || null,
  ].filter(Boolean).join(" · ");
  const serviceName = order.quotes?.service || order.title;
  const dueLabel = order.due_at ? new Date(order.due_at).toLocaleDateString("pt-BR") : "A combinar";

  function printLabels() {
    const popup = window.open("", "_blank", "width=880,height=760");
    if (!popup) return;

    const cardsHtml = Array.from({ length: count }, (_, idx) => {
      const vol = idx + 1;
      return `
        <article class="lbl">
          <div class="lbl-top">
            <div>
              <span class="lbl-kicker">NEXOFAB · EXPEDIÇÃO</span>
              <h1>OS-${escapeHtml(String(order.number))}</h1>
              ${order.quotes?.number ? `<small>Orçamento #${escapeHtml(String(order.quotes.number))}</small>` : ""}
            </div>
            <div class="lbl-vol">
              <span>VOLUME</span>
              <b>${vol} / ${count}</b>
            </div>
          </div>
          <div class="lbl-mid">
            <div class="lbl-info">
              <div class="lbl-block">
                <label>CLIENTE / DESTINATÁRIO</label>
                <strong>${escapeHtml(clientName)}</strong>
                ${contactLine ? `<p>${escapeHtml(contactLine)}</p>` : ""}
              </div>
              <div class="lbl-block">
                <label>SERVIÇO / CONTEÚDO</label>
                <p class="lbl-service">${escapeHtml(serviceName)}</p>
              </div>
              <div class="lbl-meta">
                <span><b>Prazo:</b> ${escapeHtml(dueLabel)}</span>
              </div>
            </div>
            ${qrDataUrl ? `<div class="lbl-qr"><img src="${qrDataUrl}" alt="QR OS-${order.number}"/><small>OS-${escapeHtml(String(order.number))}</small></div>` : ""}
          </div>
          ${handlingNote.trim() ? `<div class="lbl-note">${escapeHtml(handlingNote.trim())}</div>` : ""}
        </article>
      `;
    }).join("");

    const pageCss =
      format === "thermal"
        ? `
          @page { size: 100mm 150mm; margin: 4mm; }
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #081927; }
          .sheet { display: block; }
          .lbl {
            box-sizing: border-box;
            width: 92mm;
            min-height: 138mm;
            padding: 5mm;
            border: 1.5pt solid #081927;
            border-radius: 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
          }
          .lbl:last-child { page-break-after: auto; break-after: auto; }
        `
        : `
          @page { size: A4 portrait; margin: 8mm; }
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #081927; }
          .sheet {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6mm;
          }
          .lbl {
            box-sizing: border-box;
            min-height: 130mm;
            padding: 5mm;
            border: 1.2pt dashed #081927;
            border-radius: 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            break-inside: avoid;
          }
        `;

    popup.document.open();
    popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Etiquetas OS-${order.number}</title>
  <style>
    ${pageCss}
    .lbl-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 4mm; padding-bottom: 3mm; border-bottom: 1.5pt solid #081927; }
    .lbl-kicker { display: block; font-size: 8pt; font-weight: 800; letter-spacing: 0.1em; color: #0d6e67; }
    .lbl-top h1 { margin: 1mm 0 0; font-size: 24pt; line-height: 1; }
    .lbl-top small { font-size: 9pt; color: #475b63; }
    .lbl-vol { padding: 2.5mm 4mm; border-radius: 2mm; background: #081927; color: #ffffff; text-align: center; }
    .lbl-vol span { display: block; font-size: 7pt; font-weight: 800; letter-spacing: 0.1em; color: #c6f054; }
    .lbl-vol b { font-size: 16pt; font-weight: 900; }
    .lbl-mid { margin: 4mm 0; display: flex; justify-content: space-between; gap: 4mm; flex: 1; }
    .lbl-info { display: flex; flex-direction: column; gap: 3.5mm; min-width: 0; flex: 1; }
    .lbl-block label { display: block; font-size: 7.5pt; font-weight: 800; letter-spacing: 0.08em; color: #546b73; margin-bottom: 1mm; }
    .lbl-block strong { display: block; font-size: 13pt; line-height: 1.2; }
    .lbl-block p { margin: 1mm 0 0; font-size: 9.5pt; color: #2b3f47; }
    .lbl-service { font-size: 11pt !important; font-weight: 700; color: #081927 !important; }
    .lbl-meta { margin-top: auto; font-size: 9.5pt; color: #2b3f47; }
    .lbl-qr { text-align: center; flex: 0 0 auto; }
    .lbl-qr img { width: 24mm; height: 24mm; display: block; border: 0.8pt solid #cbd9dd; padding: 1mm; border-radius: 1.5mm; }
    .lbl-qr small { display: block; margin-top: 1mm; font-size: 8pt; font-weight: 800; }
    .lbl-note { padding: 2.5mm 3mm; border: 1.2pt solid #081927; border-radius: 2mm; background: #f2f6f7; text-align: center; font-size: 10pt; font-weight: 900; letter-spacing: 0.06em; }
    @media print { .lbl-vol { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="sheet">${cardsHtml}</main>
  <script>window.onload = function(){ window.focus(); window.print(); };</script>
</body>
</html>`);
    popup.document.close();
  }

  return (
    <div
      className="production-finalize-backdrop no-print"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="shipping-label-modal" role="dialog" aria-modal="true" aria-label={`Etiquetas de volume da OS-${order.number}`}>
        <header>
          <div>
            <small>EXPEDIÇÃO · VOLUMES</small>
            <h2>Etiquetas da OS-{order.number}</h2>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}><X /></Button>
        </header>

        <div className="shipping-label-body">
          <div className="shipping-label-controls">
            <label>
              Quantidade de volumes
              <div className="shipping-vol-row">
                <Input type="number" min="1" max="30" value={volumes} onChange={(e) => setVolumes(e.target.value)} />
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={count === n ? "active" : ""}
                    onClick={() => setVolumes(String(n))}
                  >
                    {n}×
                  </button>
                ))}
              </div>
            </label>

            <label>
              Formato de impressão
              <div className="shipping-format-row">
                <button type="button" className={format === "thermal" ? "active" : ""} onClick={() => setFormat("thermal")}>
                  <Tag />Térmica 100×150 mm
                </button>
                <button type="button" className={format === "a4" ? "active" : ""} onClick={() => setFormat("a4")}>
                  <Package />Folha A4 (4 por pág.)
                </button>
              </div>
            </label>

            <label>
              Aviso de transporte / entrega
              <Input value={handlingNote} onChange={(e) => setHandlingNote(e.target.value)} placeholder="Ex.: FRÁGIL · NÃO DOBRAR" />
              <div className="shipping-presets">
                {notePresets.map((preset) => (
                  <button key={preset} type="button" onClick={() => setHandlingNote(preset)}>{preset}</button>
                ))}
              </div>
            </label>
          </div>

          <div className="shipping-label-preview">
            <small>PRÉVIA DA ETIQUETA 1 DE {count}</small>
            <article className="shipping-preview-card">
              <div className="shipping-preview-top">
                <div>
                  <small>NEXOFAB · EXPEDIÇÃO</small>
                  <b>OS-{order.number}</b>
                </div>
                <span>
                  <small>VOLUME</small>
                  <strong>1 / {count}</strong>
                </span>
              </div>
              <div className="shipping-preview-mid">
                <div>
                  <b>{clientName}</b>
                  {contactLine && <small>{contactLine}</small>}
                  <p>{serviceName}</p>
                  <span>Prazo: {dueLabel}</span>
                </div>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={`QR Code OS-${order.number}`} width={68} height={68} />
                )}
              </div>
              {handlingNote.trim() && <div className="shipping-preview-note">{handlingNote.trim()}</div>}
            </article>
          </div>
        </div>

        <footer>
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          <Button type="button" onClick={printLabels}>
            <Printer />
            Imprimir {count} etiqueta{count > 1 ? "s" : ""}
          </Button>
        </footer>
      </section>
    </div>
  );
}
