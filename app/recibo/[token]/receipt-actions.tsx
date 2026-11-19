"use client";

import { MessageCircle, Printer } from "lucide-react";

export function ReceiptActions({ customer, amount, quoteNumber }: { customer: string; amount: string; quoteNumber: number }) {
  function whatsapp() {
    const text = encodeURIComponent(`Olá, ${customer}! Segue o recibo referente ao pagamento de ${amount} do orçamento #${quoteNumber}: ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }
  return <div className="receipt-actions no-print"><button type="button" onClick={() => window.print()}><Printer/>Imprimir / salvar PDF</button><button type="button" onClick={whatsapp}><MessageCircle/>Enviar pelo WhatsApp</button></div>;
}
