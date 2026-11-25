"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode } from "lucide-react";

export function OsQrCode({ orderId, orderNumber }: { orderId: string; orderNumber: number }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://nexofab.vercel.app";
    const target = `${origin}/gestao?secao=producao&os=${encodeURIComponent(orderId)}`;

    QRCode.toDataURL(target, {
      width: 148,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#081927", light: "#ffffff" },
    })
      .then((url) => {
        if (!active) return;
        setShareUrl(target);
        setDataUrl(url);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [orderId]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className="os-qr-badge">
      <div className="os-qr-frame">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`QR Code da OS-${orderNumber}`} width={84} height={84} />
        ) : (
          <QrCode />
        )}
      </div>
      <div className="os-qr-caption">
        <small>CHÃO DE FÁBRICA</small>
        <b>Aponte a câmera</b>
        <span>Abre a OS-{orderNumber} para atualizar etapa</span>
        {shareUrl && (
          <button type="button" className="os-qr-copy no-print" onClick={() => void copyLink()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Link copiado" : "Copiar link da OS"}
          </button>
        )}
      </div>
    </div>
  );
}
