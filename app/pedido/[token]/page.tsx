"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Factory,
  MessageCircle,
  Package,
  Palette,
  RefreshCw,
  Scissors,
  Store,
  Truck,
  Wrench,
} from "lucide-react";
import { whatsappUrl } from "@/lib/whatsapp";
import "./tracking.css";

type TrackedItem = {
  description: string;
  material?: string | null;
  quantity: number;
  unit: string;
  widthMm?: number | null;
  heightMm?: number | null;
};

type TrackedOrder = {
  orderNumber: number;
  quoteNumber?: number | null;
  title: string;
  stage: string;
  dueAt?: string | null;
  scheduledTime?: string | null;
  deliveryMode?: "retirada" | "entrega" | "instalacao" | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  customerLabel: string;
  items: TrackedItem[];
  pendingArtwork?: { token: string; version: number; title: string } | null;
  organization: {
    tradeName: string;
    logoUrl?: string | null;
    whatsapp?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    city?: string | null;
    state?: string | null;
    footer?: string | null;
  };
};

type StepConfig = {
  id: string;
  label: string;
  subtitle: string;
  icon: typeof ClipboardCheck;
};

const STAGE_TO_STEP_INDEX: Record<string, number> = {
  briefing: 0,
  arte: 1,
  aprovacao: 1,
  producao: 2,
  acabamento: 3,
  expedicao: 4,
  instalacao: 4,
  concluido: 5,
};

function statusHeadline(stage: string, mode?: string | null) {
  switch (stage) {
    case "briefing":
      return { badge: "Pedido confirmado", desc: "Seu pedido já entrou na nossa programação de produção." };
    case "arte":
      return { badge: "Em criação / arte", desc: "Nossa equipe está preparando o layout e os arquivos finais." };
    case "aprovacao":
      return { badge: "Aguardando aprovação de arte", desc: "Confira a arte enviada para liberarmos a produção." };
    case "producao":
      return { badge: "Em produção", desc: "Seu pedido está rodando nas máquinas da oficina." };
    case "acabamento":
      return { badge: "Em acabamento", desc: "Peças produzidas — estamos nos detalhes finais e conferência." };
    case "expedicao":
      return {
        badge: mode === "retirada" ? "Pronto para retirada" : "Em expedição / separação",
        desc: mode === "retirada" ? "Seu pedido está embalado e pronto para retirar no balcão." : "Seu pedido está embalado e pronto para entrega.",
      };
    case "instalacao":
      return { badge: "Instalação agendada", desc: "Nossa equipe de campo está programada para a instalação no local." };
    case "concluido":
      return { badge: "Pedido concluído", desc: "Produção e entrega finalizadas. Obrigado pela confiança!" };
    case "cancelado":
      return { badge: "Pedido cancelado", desc: "Esta ordem de serviço foi cancelada. Em caso de dúvida, fale conosco." };
    default:
      return { badge: "Em andamento", desc: "Acompanhe abaixo a evolução do seu pedido." };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "A confirmar";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatUpdated(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function PublicOrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchOrder = useCallback(async () => {
    const response = await fetch(`/api/pedido/${encodeURIComponent(token)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.order) throw new Error(payload.error || "Pedido não encontrado.");
    return payload.order as TrackedOrder;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetchOrder()
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar este acompanhamento.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchOrder]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const data = await fetchOrder();
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar este acompanhamento.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !order) {
    return (
      <main className="tracking-shell">
        <div className="tracking-state-card">
          <RefreshCw className="spin" />
          <b>Carregando acompanhamento do pedido…</b>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="tracking-shell">
        <div className="tracking-state-card error">
          <AlertTriangle />
          <h1>Não foi possível abrir este acompanhamento</h1>
          <p>{error || "Verifique se o link foi copiado completo ou solicite um novo link à empresa."}</p>
        </div>
      </main>
    );
  }

  const cancelled = order.stage === "cancelado";
  const currentStep = STAGE_TO_STEP_INDEX[order.stage] ?? 0;
  const headline = statusHeadline(order.stage, order.deliveryMode);
  const deliveryMode = order.deliveryMode || "retirada";
  const deliveryLabel =
    deliveryMode === "instalacao"
      ? "Instalação no local"
      : deliveryMode === "entrega"
        ? "Entrega / frete"
        : "Retirada no balcão";

  const steps: StepConfig[] = [
    { id: "briefing", label: "Pedido confirmado", subtitle: "Programado na fila", icon: ClipboardCheck },
    { id: "arte", label: "Arte e aprovação", subtitle: "Conferência de layout", icon: Palette },
    { id: "producao", label: "Em produção", subtitle: "Impressão / corte / fabricação", icon: Factory },
    { id: "acabamento", label: "Acabamento", subtitle: "Montagem e conferência", icon: Scissors },
    {
      id: "expedicao",
      label: deliveryMode === "instalacao" ? "Instalação" : deliveryMode === "entrega" ? "Expedição / Entrega" : "Pronto p/ retirada",
      subtitle: deliveryMode === "instalacao" ? "Equipe de campo" : deliveryMode === "entrega" ? "Separado p/ envio" : "Disponível no balcão",
      icon: deliveryMode === "instalacao" ? Wrench : deliveryMode === "entrega" ? Truck : Store,
    },
    { id: "concluido", label: "Concluído", subtitle: "Pedido entregue", icon: CheckCircle2 },
  ];

  const contactPhone = order.organization.whatsapp || order.organization.phone;
  const waHref = whatsappUrl(
    contactPhone,
    `Olá, ${order.organization.tradeName}! Estou acompanhando o pedido OS-${order.orderNumber} (${order.title}) pelo link de rastreio e gostaria de tirar uma dúvida.`,
  );
  const progressPercent = cancelled ? 0 : Math.round((currentStep / (steps.length - 1)) * 100);

  return (
    <main className="tracking-shell">
      <article className="tracking-card">
        <header className="tracking-brand-bar">
          <div className="tracking-brand-identity">
            {order.organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.organization.logoUrl} alt={order.organization.tradeName} className="tracking-logo" />
            ) : (
              <span className="tracking-monogram">{order.organization.tradeName.slice(0, 2).toUpperCase()}</span>
            )}
            <div>
              <b>{order.organization.tradeName}</b>
              {(order.organization.city || order.organization.state) && (
                <small>{[order.organization.city, order.organization.state].filter(Boolean).join(" · ")}</small>
              )}
            </div>
          </div>
          <button
            type="button"
            className="tracking-refresh-btn"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw className={refreshing ? "spin" : ""} />
            {refreshing ? "Atualizando…" : "Atualizar status"}
          </button>
        </header>

        <section className={`tracking-hero ${cancelled ? "cancelled" : order.stage === "concluido" ? "completed" : ""}`}>
          <div className="tracking-hero-top">
            <span className="tracking-order-code">
              OS-{order.orderNumber}
              {order.quoteNumber ? ` · Proposta #${order.quoteNumber}` : ""}
            </span>
            <span className={`tracking-status-pill stage-${order.stage}`}>
              {order.stage === "concluido" ? <CheckCircle2 /> : cancelled ? <AlertTriangle /> : <Clock3 />}
              {headline.badge}
            </span>
          </div>
          <h1>{order.title}</h1>
          <p className="tracking-customer-line">Cliente: <strong>{order.customerLabel}</strong></p>
          <p className="tracking-status-desc">{headline.desc}</p>

          {!cancelled && (
            <div className="tracking-progress-track" aria-label={`Progresso: ${progressPercent}%`}>
              <div className="tracking-progress-fill" style={{ width: `${Math.max(8, progressPercent)}%` }} />
            </div>
          )}
        </section>

        {order.pendingArtwork && !cancelled && order.stage !== "concluido" && (
          <section className="tracking-artwork-cta">
            <div className="tracking-artwork-cta-copy">
              <span><Palette /></span>
              <div>
                <small>AÇÃO NECESSÁRIA · VERSÃO {order.pendingArtwork.version}</small>
                <b>Sua arte “{order.pendingArtwork.title}” está aguardando aprovação</b>
                <p>Revise os detalhes para liberarmos a produção o quanto antes.</p>
              </div>
            </div>
            <a href={`/arte/${order.pendingArtwork.token}`} className="tracking-artwork-btn">
              Revisar e aprovar arte
              <ExternalLink />
            </a>
          </section>
        )}

        <section className="tracking-schedule-strip">
          <div>
            <span><CalendarClock /> Previsão</span>
            <b>{formatDate(order.dueAt)}</b>
            {order.scheduledTime && <small>Horário previsto: {order.scheduledTime}</small>}
          </div>
          <div>
            <span>
              {deliveryMode === "instalacao" ? <Wrench /> : deliveryMode === "entrega" ? <Truck /> : <Store />}
              Modalidade
            </span>
            <b>{deliveryLabel}</b>
            <small>{order.completedAt ? `Finalizado em ${formatDate(order.completedAt)}` : "Confirmado no agendamento"}</small>
          </div>
          <div>
            <span><Clock3 /> Última atualização</span>
            <b>{formatUpdated(order.updatedAt || order.createdAt) || formatDate(order.createdAt)}</b>
            <small>Acompanhamento em tempo real</small>
          </div>
        </section>

        {!cancelled && (
          <section className="tracking-timeline" aria-label="Etapas do pedido">
            <h2>Andamento da produção</h2>
            <ol>
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isDone = index < currentStep || order.stage === "concluido";
                const isCurrent = index === currentStep && order.stage !== "concluido";
                return (
                  <li key={step.id} className={isDone ? "done" : isCurrent ? "current" : "pending"}>
                    <div className="step-node">
                      {isDone ? <Check /> : <Icon />}
                    </div>
                    <div className="step-body">
                      <b>{step.label}</b>
                      <small>{step.subtitle}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {order.items.length > 0 && (
          <section className="tracking-items">
            <h2><Package /> Resumo do pedido</h2>
            <ul>
              {order.items.map((item, idx) => (
                <li key={`${item.description}-${idx}`}>
                  <div>
                    <b>{item.description}</b>
                    <small>
                      {[
                        item.material,
                        item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm} mm` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Especificação conforme proposta aprovada"}
                    </small>
                  </div>
                  <span>{Number(item.quantity)} {item.unit}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="tracking-footer">
          <div className="tracking-footer-note">
            <b>Precisa ajustar horário ou tirar alguma dúvida?</b>
            <p>{order.organization.footer || `Fale direto com a equipe da ${order.organization.tradeName}.`}</p>
          </div>
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="tracking-whatsapp-btn">
              <MessageCircle />
              Falar no WhatsApp
            </a>
          )}
        </footer>
      </article>
    </main>
  );
}
