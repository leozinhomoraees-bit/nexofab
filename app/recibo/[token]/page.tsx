import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { ReceiptActions } from "./receipt-actions";
import "./receipt.css";

export const dynamic = "force-dynamic";

type Issuer = {
  trade_name?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  proposal_footer?: string | null;
  address_city?: string | null;
  address_state?: string | null;
};

type Receipt = {
  receipt_id: string;
  issued_at: string;
  amount: number;
  payment_type: string;
  payment_method: string;
  received_on: string;
  notes?: string | null;
  quote_number: number;
  customer_name: string;
  company?: string | null;
  service: string;
  customer_document?: string | null;
  issuer?: Issuer | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const method: Record<string, string> = { pix: "PIX", dinheiro: "dinheiro", cartao: "cartão", boleto: "boleto", transferencia: "transferência", outro: "outro" };
const kind: Record<string, string> = { entrada: "entrada", parcela: "parcela", saldo: "saldo", integral: "pagamento integral" };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data, error } = await createPublicClient().rpc("get_public_payment_receipt", { p_token: token });
  if (error || !data) notFound();

  const receipt = data as Receipt;
  const issuer = receipt.issuer ?? {};
  const issuerName = issuer.trade_name || issuer.legal_name || "Empresa";
  const issuerLocation = [issuer.address_city, issuer.address_state].filter(Boolean).join(" — ");
  const customer = receipt.company || receipt.customer_name;
  const amount = currency.format(Number(receipt.amount));

  return <main className="public-receipt-page"><section className="public-receipt"><header>{issuer.logo_url ? <img src={issuer.logo_url} alt={issuerName}/> : <b>{issuerName}</b>}<div><small>RECIBO DE PAGAMENTO</small><b>#{receipt.receipt_id.slice(0, 8).toUpperCase()}</b></div></header><div className="receipt-body"><div className="receipt-value"><small>VALOR RECEBIDO</small><strong>{amount}</strong><span>Recebido em {date(receipt.received_on)}</span></div><p>Recebemos de <b>{customer}</b>{receipt.customer_document ? `, documento ${receipt.customer_document},` : ""} o valor de <b>{amount}</b>, referente a <b>{kind[receipt.payment_type] ?? receipt.payment_type}</b> do orçamento <b>#{receipt.quote_number}</b>, relativo ao serviço:</p><h1>{receipt.service}</h1><dl><div><dt>Forma de pagamento</dt><dd>{method[receipt.payment_method] ?? receipt.payment_method}</dd></div><div><dt>Data do pagamento</dt><dd>{date(receipt.received_on)}</dd></div><div><dt>Recibo emitido em</dt><dd>{date(receipt.issued_at)}</dd></div></dl>{receipt.notes && <aside><small>OBSERVAÇÕES</small><p>{receipt.notes}</p></aside>}<div className="receipt-signature"><span></span><b>{issuerName}</b>{issuerLocation && <small>{issuerLocation}</small>}</div></div><footer><b>{issuerName}</b><span>{issuer.proposal_footer || "Recibo emitido digitalmente"}</span></footer></section><ReceiptActions customer={customer} amount={amount} quoteNumber={receipt.quote_number}/></main>;
}
