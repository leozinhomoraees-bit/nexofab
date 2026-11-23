"use client";

import { useEffect, useState } from "react";
import { Building2, CircleDollarSign, ClipboardList, Factory, LoaderCircle, MapPin, MessageCircle, Pencil, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";

type Customer360Response = {
  customer: {
    id: string;
    person_type: "pessoa" | "empresa";
    name: string;
    company_name?: string | null;
    document?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: { street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zip?: string } | null;
    notes?: string | null;
    billing_cycle: "imediato" | "semanal" | "mensal";
    billing_day?: number | null;
    credit_limit?: number | null;
    created_at: string;
  };
  canViewReceivables: boolean;
  summary: {
    totalQuotes: number;
    closedQuotes: number;
    totalBought: number;
    openReceivables: number;
    overdueReceivables: number;
    activeOrders: number;
  };
  quotes: Array<{
    id: string;
    number: number;
    service: string;
    status: string;
    estimated_value: number | null;
    valid_until?: string | null;
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    number: number;
    title: string;
    stage: string;
    priority: string;
    due_at?: string | null;
  }>;
  receivables: Array<{
    id: string;
    installment_number: number;
    due_date: string;
    amount: number;
    received_amount?: number | null;
    received_on?: string | null;
    status: string;
  }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const quoteStatusLabels: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aguardando_cliente: "Aguardando cliente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Fechado",
};
const stageLabels: Record<string, string> = {
  briefing: "A programar",
  arte: "Arte",
  aprovacao: "Aprovação",
  producao: "Produção",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  instalacao: "Instalação",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function Customer360Dialog({
  customerId,
  onClose,
  onEdit,
}: {
  customerId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [data, setData] = useState<Customer360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);

    fetch(`/api/gestao/clientes/${encodeURIComponent(customerId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar a ficha do cliente.");
        return payload as Customer360Response;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((caught: Error) => {
        if (active) setError(caught.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [customerId, onClose]);

  const customer = data?.customer;
  const waLink = customer
    ? whatsappUrl(
        customer.whatsapp || customer.phone,
        `Olá, ${customer.name}! Tudo bem? Estou entrando em contato sobre seus projetos conosco.`,
      )
    : null;
  const addressLine = customer?.address
    ? [
        customer.address.street,
        customer.address.number,
        customer.address.neighborhood,
        customer.address.city && customer.address.state
          ? `${customer.address.city}/${customer.address.state}`
          : customer.address.city,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div
      className="workspace-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Ficha 360º do cliente"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="workspace-dialog customer-360-dialog">
        {loading && (
          <div className="panel-loading-state">
            <LoaderCircle className="spin" />
            <span>Carregando histórico do cliente...</span>
          </div>
        )}

        {!loading && error && (
          <div className="customer-360-error">
            <p>{error}</p>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}

        {!loading && data && customer && (
          <section className="customer-360-body">
            <header className="customer-360-head">
              <div className="customer-360-title">
                <span className="customer-360-avatar">
                  {customer.person_type === "empresa" ? <Building2 /> : <UserRound />}
                </span>
                <div>
                  <small>FICHA 360º DO CLIENTE</small>
                  <h2>{customer.company_name || customer.name}</h2>
                  <p>
                    {[
                      customer.company_name ? `Contato: ${customer.name}` : null,
                      customer.document ? `Doc.: ${customer.document}` : null,
                      customer.whatsapp || customer.phone,
                      customer.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem contato cadastrado"}
                  </p>
                  {addressLine && (
                    <span className="customer-360-address">
                      <MapPin />
                      {addressLine}
                    </span>
                  )}
                </div>
              </div>
              <div className="customer-360-actions">
                {waLink && (
                  <Button size="sm" asChild>
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                      <MessageCircle />
                      WhatsApp
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Pencil />
                  Editar
                </Button>
                <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar ficha">
                  <X />
                </Button>
              </div>
            </header>

            <div className="customer-360-kpis">
              <article>
                <span>Total comprado</span>
                <b>{currency.format(data.summary.totalBought)}</b>
                <small>{data.summary.closedQuotes} pedido(s) aprovado(s)/fechado(s)</small>
              </article>
              <article>
                <span>Orçamentos</span>
                <b>{data.summary.totalQuotes}</b>
                <small>Cliente desde {brDate(customer.created_at)}</small>
              </article>
              <article>
                <span>Produção ativa</span>
                <b>{data.summary.activeOrders}</b>
                <small>{data.orders.length} ordem(ns) no histórico</small>
              </article>
              {data.canViewReceivables && (
                <article className={data.summary.overdueReceivables > 0 ? "danger" : ""}>
                  <span>Saldo a receber</span>
                  <b>{currency.format(data.summary.openReceivables)}</b>
                  <small>
                    {data.summary.overdueReceivables > 0
                      ? `${currency.format(data.summary.overdueReceivables)} em atraso`
                      : "Sem parcelas vencidas"}
                  </small>
                </article>
              )}
            </div>

            {customer.notes && (
              <div className="customer-360-notes">
                <b>Observações comerciais</b>
                <p>{customer.notes}</p>
              </div>
            )}

            <div className="customer-360-columns">
              <div className="customer-360-card">
                <header>
                  <ClipboardList />
                  <h3>Histórico de orçamentos</h3>
                  <span>{data.quotes.length}</span>
                </header>
                {data.quotes.length ? (
                  <div className="customer-360-list">
                    {data.quotes.map((quote) => (
                      <article key={quote.id}>
                        <div>
                          <b>
                            #{quote.number} · {quote.service}
                          </b>
                          <small>
                            {brDate(quote.created_at)} · {quoteStatusLabels[quote.status] ?? quote.status}
                          </small>
                        </div>
                        <strong>
                          {quote.estimated_value !== null
                            ? currency.format(Number(quote.estimated_value))
                            : "A calcular"}
                        </strong>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="customer-360-empty">Nenhum orçamento vinculado a este cliente ainda.</p>
                )}
              </div>

              <div className="customer-360-card">
                <header>
                  <Factory />
                  <h3>Ordens de produção</h3>
                  <span>{data.orders.length}</span>
                </header>
                {data.orders.length ? (
                  <div className="customer-360-list">
                    {data.orders.map((order) => (
                      <article key={order.id}>
                        <div>
                          <b>
                            OS-{order.number} · {order.title}
                          </b>
                          <small>
                            Etapa: {stageLabels[order.stage] ?? order.stage}
                            {order.due_at ? ` · prazo ${brDate(order.due_at)}` : ""}
                          </small>
                        </div>
                        <span className="customer-360-tag">{order.priority}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="customer-360-empty">Nenhuma ordem de produção criada para este cliente.</p>
                )}
              </div>
            </div>

            {data.canViewReceivables && data.receivables.length > 0 && (
              <div className="customer-360-card">
                <header>
                  <CircleDollarSign />
                  <h3>Parcelas e recebimentos</h3>
                  <span>{data.receivables.length}</span>
                </header>
                <div className="customer-360-list">
                  {data.receivables.slice(0, 12).map((item) => (
                    <article key={item.id}>
                      <div>
                        <b>{item.installment_number === 0 ? "Entrada" : `Parcela ${item.installment_number}`}</b>
                        <small>
                          Vencimento {brDate(item.due_date)} · {item.status}
                          {item.received_on ? ` · recebido em ${brDate(item.received_on)}` : ""}
                        </small>
                      </div>
                      <strong>
                        {currency.format(
                          Number(item.status === "recebido" ? item.received_amount ?? item.amount : item.amount),
                        )}
                      </strong>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
