"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  Copy,
  ExternalLink,
  LoaderCircle,
  Lock,
  MessageCircle,
  MessageSquareMore,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { whatsappUrl } from "@/lib/whatsapp";
import { useToast } from "./toast-context";

type ThreadRow = {
  id: string;
  customer_id: string | null;
  quote_id: string | null;
  phone: string;
  contact_name: string;
  subject: string | null;
  source: "meta_webhook" | "manual";
  status: "waiting_reply" | "replied" | "snoozed" | "closed";
  unread_count: number;
  last_message_preview: string;
  last_message_direction: "inbound" | "outbound";
  last_customer_message_at: string;
  last_reply_at: string | null;
  next_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

type QuoteFollowUp = {
  id: string;
  number: number;
  customer_name: string;
  company: string | null;
  phone: string | null;
  service: string | null;
  status: "novo" | "em_analise" | "aguardando_cliente";
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
  next_contact_at: string | null;
};

type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  sent_via: string;
  created_at: string;
};

type WhatsAppConfig = {
  configured: boolean;
  enabled: boolean;
  mode: "monitor_only" | "reply_24h_locked";
  phoneNumberId: string;
  displayPhone: string;
  alertAfterMinutes: number;
  verifyToken: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  organizationId: string;
};

type FilterKey = "unanswered" | "scheduled" | "quotes" | "replied" | "all";

const currency = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

const quoteStatusLabel: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aguardando_cliente: "Aguardando cliente",
};

const threadStatusLabel: Record<ThreadRow["status"], string> = {
  waiting_reply: "Sem resposta",
  snoozed: "Retorno agendado",
  replied: "Respondido",
  closed: "Concluído",
};

function formatPhone(raw?: string | null) {
  const digits = (raw ?? "").replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw || "Sem telefone";
}

function formatDuration(diffMs: number) {
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function isQuoteIdle(quote: QuoteFollowUp, nowMs: number) {
  if (quote.next_contact_at && new Date(quote.next_contact_at).getTime() <= nowMs) return true;
  const referenceIso = quote.last_contact_at || quote.updated_at || quote.created_at;
  const idleHours = (nowMs - new Date(referenceIso).getTime()) / 3600000;
  if (quote.status === "novo" && idleHours >= 4) return true;
  if (quote.status === "em_analise" && idleHours >= 24) return true;
  if (quote.status === "aguardando_cliente" && idleHours >= 48) return true;
  return false;
}

function computeFutureIso(baseMs: number, preset: "4h" | "tomorrow9" | "1d" | "2d" | "5d") {
  const date = new Date(baseMs);
  if (preset === "4h") {
    date.setHours(date.getHours() + 4);
    return date.toISOString();
  }
  if (preset === "tomorrow9") {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date.toISOString();
  }
  const days = preset === "1d" ? 1 : preset === "2d" ? 2 : 5;
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function AttendancePanel({
  search,
  onOpenQuote,
  onCreateQuote,
}: {
  search: string;
  onOpenQuote: (quoteId: string) => void;
  onCreateQuote: () => void;
}) {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<"queue" | "meta">("queue");
  const [filter, setFilter] = useState<FilterKey>("unanswered");
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteFollowUp[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [canConfigureMeta, setCanConfigureMeta] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => new Date().getTime());
  const [origin, setOrigin] = useState("https://nexofab.vercel.app");

  // Novo atendimento rápido
  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");

  // Histórico e resposta inline (trava 24h)
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ThreadMessage[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingThreadId, setSendingThreadId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Formulário Meta WhatsApp Cloud API
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [metaMode, setMetaMode] = useState<"monitor_only" | "reply_24h_locked">("monitor_only");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaDisplayPhone, setMetaDisplayPhone] = useState("");
  const [metaAlertMinutes, setMetaAlertMinutes] = useState("30");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (typeof window !== "undefined") setOrigin(window.location.origin);
    }, 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
    };
  }, []);

  const syncMetaForm = useCallback((cfg: WhatsAppConfig | null) => {
    if (!cfg) return;
    setMetaEnabled(cfg.enabled);
    setMetaMode(cfg.mode);
    setMetaPhoneNumberId(cfg.phoneNumberId || "");
    setMetaDisplayPhone(cfg.displayPhone || "");
    setMetaAlertMinutes(String(cfg.alertAfterMinutes || 30));
    setMetaAccessToken("");
    setMetaAppSecret("");
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/gestao/atendimentos", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        threads?: ThreadRow[];
        quotes?: QuoteFollowUp[];
        config?: WhatsAppConfig | null;
        canConfigureMeta?: boolean;
        setupRequired?: boolean;
        error?: string;
      };
      if (!response.ok) {
        notify(payload.error || "Não foi possível carregar os atendimentos.", "error");
        return;
      }
      setSetupRequired(Boolean(payload.setupRequired));
      setThreads(payload.threads ?? []);
      setQuotes(payload.quotes ?? []);
      setConfig(payload.config ?? null);
      setCanConfigureMeta(Boolean(payload.canConfigureMeta));
      syncMetaForm(payload.config ?? null);
      setNowMs(Date.now());
    } finally {
      if (!silent) setLoading(false);
    }
  }, [syncMetaForm, notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function toggleThreadHistory(threadId: string) {
    if (expandedThreadId === threadId) {
      setExpandedThreadId(null);
      return;
    }
    setExpandedThreadId(threadId);
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/gestao/atendimentos?threadId=${encodeURIComponent(threadId)}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as { messages?: ThreadMessage[] };
        setMessagesByThread((current) => ({ ...current, [threadId]: payload.messages ?? [] }));
      }
    } finally {
      setLoadingMessages(false);
    }
  }

  async function createQuickThread(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/gestao/atendimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: newContactName,
          phone: newPhone,
          subject: newSubject,
          message: newMessage,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notify(payload.error || "Não foi possível registrar o atendimento.", "error");
        return;
      }
      notify("Atendimento registrado na fila de alertas.", "success");
      setNewContactName("");
      setNewPhone("");
      setNewSubject("");
      setNewMessage("");
      setComposerOpen(false);
      await load(true);
    } finally {
      setCreating(false);
    }
  }

  async function runThreadAction(
    thread: ThreadRow,
    action: "mark_replied" | "snooze" | "reopen" | "close",
    extra?: { nextContactAt?: string; note?: string },
  ) {
    setBusyId(thread.id);
    try {
      const response = await fetch("/api/gestao/atendimentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, threadId: thread.id, ...extra }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notify(payload.error || "Não foi possível atualizar o atendimento.", "error");
        return;
      }
      const feedbackMap: Record<typeof action, string> = {
        mark_replied: `${thread.contact_name} marcado como respondido.`,
        snooze: `Retorno agendado para ${thread.contact_name}.`,
        reopen: `${thread.contact_name} voltou para a fila sem resposta.`,
        close: `Atendimento de ${thread.contact_name} concluído.`,
      };
      notify(feedbackMap[action], "success");
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  async function openThreadWhatsApp(thread: ThreadRow) {
    const greeting = `Olá, ${thread.contact_name}! Tudo bem? Estou retornando seu atendimento${thread.subject ? ` sobre ${thread.subject}` : ""}. Como posso te ajudar?`;
    const link = whatsappUrl(thread.phone, greeting);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    if (thread.status === "waiting_reply" || thread.status === "snoozed") {
      await runThreadAction(thread, "mark_replied", { note: "Respondido via WhatsApp Web/App" });
    }
  }

  async function sendLockedMetaReply(thread: ThreadRow) {
    const text = (replyDrafts[thread.id] ?? "").trim();
    if (!text) return;
    setSendingThreadId(thread.id);
    try {
      const response = await fetch("/api/gestao/atendimentos/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, message: text }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notify(payload.error || "Envio bloqueado.", "error");
        return;
      }
      notify("Resposta enviada dentro da janela gratuita de 24h.", "success");
      setReplyDrafts((current) => ({ ...current, [thread.id]: "" }));
      await load(true);
      if (expandedThreadId === thread.id) {
        const msgResp = await fetch(`/api/gestao/atendimentos?threadId=${encodeURIComponent(thread.id)}`, {
          cache: "no-store",
        });
        if (msgResp.ok) {
          const msgPayload = (await msgResp.json()) as { messages?: ThreadMessage[] };
          setMessagesByThread((current) => ({ ...current, [thread.id]: msgPayload.messages ?? [] }));
        }
      }
    } finally {
      setSendingThreadId(null);
    }
  }

  async function updateQuoteFollowUp(
    quote: QuoteFollowUp,
    options: { markContacted?: boolean; nextContactAt?: string | null; successMsg: string },
  ) {
    setBusyId(quote.id);
    try {
      const response = await fetch("/api/gestao/atendimentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote_contact",
          quoteId: quote.id,
          markContacted: Boolean(options.markContacted),
          ...(options.nextContactAt !== undefined ? { nextContactAt: options.nextContactAt } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notify(payload.error || "Não foi possível atualizar o orçamento.", "error");
        return;
      }
      notify(options.successMsg, "success");
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  async function openQuoteWhatsApp(quote: QuoteFollowUp) {
    const msg = `Olá, ${quote.customer_name}! Tudo bem? Estou retornando sobre o orçamento #${quote.number}${quote.service ? ` (${quote.service})` : ""}. Ficou alguma dúvida ou posso ajudar a dar andamento?`;
    const link = whatsappUrl(quote.phone, msg);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    await updateQuoteFollowUp(quote, {
      markContacted: true,
      nextContactAt: null,
      successMsg: `Contato registrado no orçamento #${quote.number}.`,
    });
  }

  async function saveMetaConfig(
    event?: React.FormEvent,
    clearFlags?: { clearAccessToken?: boolean; clearAppSecret?: boolean },
  ) {
    if (event) event.preventDefault();
    setSavingMeta(true);
    try {
      const response = await fetch("/api/gestao/atendimentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_whatsapp_config",
          enabled: metaEnabled,
          mode: metaMode,
          phoneNumberId: metaPhoneNumberId,
          displayPhone: metaDisplayPhone,
          alertAfterMinutes: Number(metaAlertMinutes) || 30,
          accessToken: metaAccessToken,
          appSecret: metaAppSecret,
          clearAccessToken: Boolean(clearFlags?.clearAccessToken),
          clearAppSecret: Boolean(clearFlags?.clearAppSecret),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { config?: WhatsAppConfig; error?: string };
      if (!response.ok) {
        notify(payload.error || "Não foi possível salvar a configuração da Meta.", "error");
        return;
      }
      if (payload.config) {
        setConfig(payload.config);
        syncMetaForm(payload.config);
      }
      notify("Configuração do WhatsApp Oficial salva.", "success");
    } finally {
      setSavingMeta(false);
    }
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      notify("Copiado para a área de transferência.", "success");
      window.setTimeout(() => setCopiedField((c) => (c === key ? null : c)), 2000);
    } catch {
      notify("Não foi possível copiar automaticamente.", "error");
    }
  }

  const normalizedSearch = search.trim().toLowerCase();

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (normalizedSearch) {
        const hay = `${thread.contact_name} ${thread.phone} ${thread.subject ?? ""} ${thread.last_message_preview}`.toLowerCase();
        if (!hay.includes(normalizedSearch)) return false;
      }
      if (filter === "unanswered") {
        const snoozeDue = thread.status === "snoozed" && thread.next_contact_at && new Date(thread.next_contact_at).getTime() <= nowMs;
        return thread.status === "waiting_reply" || Boolean(snoozeDue);
      }
      if (filter === "scheduled") return thread.status === "snoozed";
      if (filter === "replied") return thread.status === "replied" || thread.status === "closed";
      if (filter === "quotes") return false;
      return true;
    });
  }, [threads, normalizedSearch, filter, nowMs]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      if (normalizedSearch) {
        const hay = `#${quote.number} ${quote.customer_name} ${quote.company ?? ""} ${quote.phone ?? ""} ${quote.service ?? ""}`.toLowerCase();
        if (!hay.includes(normalizedSearch)) return false;
      }
      if (filter === "unanswered") return isQuoteIdle(quote, nowMs);
      if (filter === "scheduled") return Boolean(quote.next_contact_at);
      if (filter === "quotes") return true;
      if (filter === "replied") return false;
      return true;
    });
  }, [quotes, normalizedSearch, filter, nowMs]);

  const stats = useMemo(() => {
    const waitingThreads = threads.filter((t) => t.status === "waiting_reply").length;
    const dueSnoozes =
      threads.filter((t) => t.status === "snoozed" && t.next_contact_at && new Date(t.next_contact_at).getTime() <= nowMs).length
      + quotes.filter((q) => q.next_contact_at && new Date(q.next_contact_at).getTime() <= nowMs).length;
    const idleQuotes = quotes.filter((q) => isQuoteIdle(q, nowMs)).length;
    const repliedCount = threads.filter((t) => t.status === "replied" || t.status === "closed").length;
    return {
      unansweredTotal: waitingThreads + idleQuotes,
      waitingThreads,
      idleQuotes,
      dueSnoozes,
      repliedCount,
    };
  }, [threads, quotes, nowMs]);

  const webhookUrl = config?.organizationId
    ? `${origin}/api/webhooks/whatsapp/${config.organizationId}`
    : "";

  if (loading) {
    return (
      <div className="panel-loading-state">
        <LoaderCircle className="spin" />
        <span>Carregando central de atendimentos...</span>
      </div>
    );
  }

  return (
    <section className="attendance-workspace">
      <div className="module-head">
        <div>
          <small>COMERCIAL · ANTI-ESQUECIMENTO</small>
          <h1>Central de Atendimentos</h1>
          <p>
            Acompanhe clientes aguardando resposta no WhatsApp e orçamentos sem retorno. Ative os avisos na tela pelo sino no topo.
          </p>
        </div>
        <div className="attendance-head-actions">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw />
            Atualizar
          </Button>
          <Button variant="outline" onClick={onCreateQuote}>
            <Sparkles />
            Novo orçamento
          </Button>
          <Button onClick={() => { setActiveTab("queue"); setComposerOpen((v) => !v); }}>
            <Plus />
            Novo atendimento
          </Button>
        </div>
      </div>

      {setupRequired && (
        <div className="attendance-setup-banner">
          <BellRing />
          <div>
            <b>Ativação pendente no banco de dados</b>
            <p>
              Execute a migração <code>202611230004_attendance_alerts_and_meta_whatsapp.sql</code> no Supabase SQL Editor para liberar a fila de atendimentos e a integração oficial da Meta.
            </p>
          </div>
        </div>
      )}

      <div className="attendance-tabs">
        <button
          type="button"
          className={activeTab === "queue" ? "active" : ""}
          onClick={() => setActiveTab("queue")}
        >
          <MessageSquareMore />
          Fila de atendimentos
          {stats.unansweredTotal > 0 && <span className="attendance-tab-badge">{stats.unansweredTotal}</span>}
        </button>
        {canConfigureMeta && (
          <button
            type="button"
            className={activeTab === "meta" ? "active" : ""}
            onClick={() => setActiveTab("meta")}
          >
            <Settings2 />
            WhatsApp Oficial (Meta)
            <span className={`attendance-meta-pill ${config?.enabled ? "on" : ""}`}>
              {config?.enabled ? (config.mode === "reply_24h_locked" ? "Trava 24h" : "Alerta R$ 0") : "Desligado"}
            </span>
          </button>
        )}
      </div>

      {activeTab === "queue" ? (
        <>
          <div className="attendance-kpis">
            <article className={stats.unansweredTotal > 0 ? "danger" : ""}>
              <span>Sem resposta agora</span>
              <b>{stats.unansweredTotal}</b>
              <small>
                {stats.waitingThreads} WhatsApp · {stats.idleQuotes} orçamento(s) parado(s)
              </small>
            </article>
            <article className={stats.dueSnoozes > 0 ? "warn" : ""}>
              <span>Retornos vencidos</span>
              <b>{stats.dueSnoozes}</b>
              <small>Clientes agendados aguardando contato</small>
            </article>
            <article>
              <span>Atendidos / respondidos</span>
              <b>{stats.repliedCount}</b>
              <small>Conversas em dia nesta empresa</small>
            </article>
            <article>
              <span>WhatsApp Oficial (Meta)</span>
              <b>
                {config?.enabled
                  ? config.mode === "reply_24h_locked"
                    ? "Trava 24h"
                    : "Alerta R$ 0"
                  : "Manual"}
              </b>
              <small>
                {config?.enabled
                  ? `Alerta após ${config.alertAfterMinutes} min sem resposta`
                  : canConfigureMeta
                    ? "Conecte na aba WhatsApp Oficial (Meta)"
                    : "Acompanhamento de orçamentos ativo"}
              </small>
            </article>
          </div>

          {composerOpen && (
            <form className="attendance-composer" onSubmit={(e) => void createQuickThread(e)}>
              <div className="attendance-composer-head">
                <div>
                  <b>Registrar atendimento rápido</b>
                  <small>Anote um cliente que chamou no celular/balcão para o NexoFab não deixar você esquecer de responder.</small>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setComposerOpen(false)}>
                  Fechar
                </Button>
              </div>
              <div className="attendance-composer-grid">
                <label>
                  Nome do cliente *
                  <Input
                    required
                    placeholder="Ex.: Mariana Souza"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                  />
                </label>
                <label>
                  WhatsApp com DDD *
                  <Input
                    required
                    placeholder="Ex.: (11) 99999-8888"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </label>
                <label>
                  Assunto / serviço
                  <Input
                    placeholder="Ex.: Fachada em ACM 4x1m"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                </label>
                <label>
                  Resumo do pedido
                  <Input
                    placeholder="Ex.: Pediu prazo e orçamento até amanhã"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                </label>
              </div>
              <div className="attendance-composer-foot">
                <Button type="submit" disabled={creating}>
                  {creating ? <LoaderCircle className="spin" /> : <Plus />}
                  Colocar na fila de alertas
                </Button>
              </div>
            </form>
          )}

          <div className="attendance-filters">
            {(
              [
                ["unanswered", `Precisam de resposta (${stats.unansweredTotal})`],
                ["scheduled", "Retornos agendados"],
                ["quotes", `Orçamentos abertos (${quotes.length})`],
                ["replied", "Respondidos"],
                ["all", "Todos"],
              ] as Array<[FilterKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredThreads.length === 0 && filteredQuotes.length === 0 ? (
            <div className="attendance-empty">
              <CheckCheck />
              <b>Nenhum cliente pendente neste filtro</b>
              <p>
                {filter === "unanswered"
                  ? "Tudo respondido em dia! Quando um cliente mandar mensagem ou um orçamento ficar parado, o aviso aparecerá aqui e no sino."
                  : "Nenhum atendimento encontrado com os filtros atuais."}
              </p>
            </div>
          ) : (
            <div className="attendance-stack">
              {filteredThreads.length > 0 && (
                <div className="attendance-section">
                  <header>
                    <h2>Conversas &amp; WhatsApp ({filteredThreads.length})</h2>
                    <small>Ordenadas pela última mensagem do cliente</small>
                  </header>
                  <div className="attendance-list">
                    {filteredThreads.map((thread) => {
                      const lastCustomerMs = new Date(thread.last_customer_message_at).getTime();
                      const waitingMs = nowMs - lastCustomerMs;
                      const windowLimitMs = lastCustomerMs + (23 * 60 + 50) * 60000;
                      const remainingWindowMs = windowLimitMs - nowMs;
                      const within24h = remainingWindowMs > 0;
                      const canReplyHere = Boolean(config?.enabled && config.mode === "reply_24h_locked");
                      const isExpanded = expandedThreadId === thread.id;
                      const messages = messagesByThread[thread.id] ?? [];
                      const isOverdueSnooze =
                        thread.status === "snoozed"
                        && Boolean(thread.next_contact_at)
                        && new Date(thread.next_contact_at as string).getTime() <= nowMs;

                      return (
                        <article
                          key={thread.id}
                          className={`attendance-card ${thread.status === "waiting_reply" || isOverdueSnooze ? "urgent" : ""}`}
                        >
                          <div className="attendance-card-top">
                            <div className="attendance-card-identity">
                              <b>{thread.contact_name}</b>
                              <span>{formatPhone(thread.phone)}</span>
                              <span className={`attendance-source-tag ${thread.source}`}>
                                {thread.source === "meta_webhook" ? "WhatsApp Meta" : "Manual"}
                              </span>
                              <span className={`attendance-status-tag ${thread.status}`}>
                                {isOverdueSnooze ? "Retorno vencido" : threadStatusLabel[thread.status]}
                              </span>
                            </div>
                            <div className="attendance-card-timers">
                              <span className="attendance-wait-pill">
                                <Clock3 />
                                {thread.status === "waiting_reply"
                                  ? `Aguardando há ${formatDuration(waitingMs)}`
                                  : `Última msg há ${formatDuration(waitingMs)}`}
                              </span>
                              {thread.source === "meta_webhook" && (
                                <span className={`attendance-window-badge ${within24h ? "open" : "locked"}`}>
                                  {within24h ? <ShieldCheck /> : <Lock />}
                                  {within24h
                                    ? `Janela 24h livre · ${formatDuration(remainingWindowMs)}`
                                    : "Janela 24h encerrada · Trava ativa"}
                                </span>
                              )}
                            </div>
                          </div>

                          {thread.subject && <p className="attendance-subject">Assunto: {thread.subject}</p>}
                          <p className="attendance-preview">&ldquo;{thread.last_message_preview}&rdquo;</p>

                          {thread.next_contact_at && (
                            <p className="attendance-snooze-note">
                              <CalendarClock />
                              Retorno agendado para{" "}
                              {new Date(thread.next_contact_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}

                          <div className="attendance-card-actions">
                            <Button size="sm" onClick={() => void openThreadWhatsApp(thread)} disabled={busyId === thread.id}>
                              <MessageCircle />
                              Responder no WhatsApp
                            </Button>

                            {thread.status !== "replied" && thread.status !== "closed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === thread.id}
                                onClick={() => void runThreadAction(thread, "mark_replied")}
                              >
                                <Check />
                                Marcar respondido
                              </Button>
                            )}

                            {(thread.status === "replied" || thread.status === "closed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === thread.id}
                                onClick={() => void runThreadAction(thread, "reopen")}
                              >
                                <RotateCcw />
                                Voltar para fila
                              </Button>
                            )}

                            <div className="attendance-snooze-group">
                              <span>Lembrar:</span>
                              <button
                                type="button"
                                disabled={busyId === thread.id}
                                onClick={() =>
                                  void runThreadAction(thread, "snooze", {
                                    nextContactAt: computeFutureIso(nowMs, "4h"),
                                  })
                                }
                              >
                                +4h
                              </button>
                              <button
                                type="button"
                                disabled={busyId === thread.id}
                                onClick={() =>
                                  void runThreadAction(thread, "snooze", {
                                    nextContactAt: computeFutureIso(nowMs, "tomorrow9"),
                                  })
                                }
                              >
                                Amanhã 09h
                              </button>
                              <button
                                type="button"
                                disabled={busyId === thread.id}
                                onClick={() =>
                                  void runThreadAction(thread, "snooze", {
                                    nextContactAt: computeFutureIso(nowMs, "2d"),
                                  })
                                }
                              >
                                +2 dias
                              </button>
                            </div>

                            <Button size="sm" variant="ghost" onClick={() => void toggleThreadHistory(thread.id)}>
                              {isExpanded ? "Ocultar histórico" : "Ver histórico"}
                            </Button>

                            {thread.status !== "closed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === thread.id}
                                onClick={() => void runThreadAction(thread, "close")}
                              >
                                Concluir
                              </Button>
                            )}
                          </div>

                          {canReplyHere && (
                            <div className="attendance-reply-box">
                              {within24h ? (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void sendLockedMetaReply(thread);
                                  }}
                                >
                                  <Input
                                    placeholder="Responder texto livre dentro da janela gratuita de 24h..."
                                    value={replyDrafts[thread.id] ?? ""}
                                    onChange={(e) =>
                                      setReplyDrafts((current) => ({ ...current, [thread.id]: e.target.value }))
                                    }
                                    disabled={sendingThreadId === thread.id}
                                  />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    disabled={sendingThreadId === thread.id || !(replyDrafts[thread.id] ?? "").trim()}
                                  >
                                    {sendingThreadId === thread.id ? <LoaderCircle className="spin" /> : <Send />}
                                    Enviar (24h)
                                  </Button>
                                </form>
                              ) : (
                                <div className="attendance-reply-locked">
                                  <Lock />
                                  <span>
                                    Trava de 24h ativa: envio via API Meta bloqueado para evitar cobrança de template. Use{" "}
                                    <b>Responder no WhatsApp</b> acima.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {isExpanded && (
                            <div className="attendance-history">
                              {loadingMessages && messages.length === 0 ? (
                                <small>Carregando histórico...</small>
                              ) : messages.length === 0 ? (
                                <small>Nenhuma mensagem adicional registrada.</small>
                              ) : (
                                messages.map((msg) => (
                                  <div key={msg.id} className={`attendance-bubble ${msg.direction}`}>
                                    <p>{msg.body}</p>
                                    <small>
                                      {msg.direction === "inbound" ? "Cliente" : "Equipe"} ·{" "}
                                      {new Date(msg.created_at).toLocaleString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </small>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredQuotes.length > 0 && (
                <div className="attendance-section">
                  <header>
                    <h2>Orçamentos em acompanhamento ({filteredQuotes.length})</h2>
                    <small>Alertas automáticos: Novo (&gt;4h), Em análise (&gt;24h), Aguardando cliente (&gt;48h)</small>
                  </header>
                  <div className="attendance-list">
                    {filteredQuotes.map((quote) => {
                      const idle = isQuoteIdle(quote, nowMs);
                      const refIso = quote.last_contact_at || quote.updated_at || quote.created_at;
                      const refDiff = nowMs - new Date(refIso).getTime();

                      return (
                        <article key={quote.id} className={`attendance-card ${idle ? "urgent" : ""}`}>
                          <div className="attendance-card-top">
                            <div className="attendance-card-identity">
                              <b>
                                #{quote.number} · {quote.customer_name}
                              </b>
                              {quote.company && <span>{quote.company}</span>}
                              {quote.phone && <span>{formatPhone(quote.phone)}</span>}
                              <span className={`attendance-status-tag ${idle ? "waiting_reply" : "replied"}`}>
                                {quoteStatusLabel[quote.status] || quote.status}
                              </span>
                            </div>
                            <div className="attendance-card-timers">
                              <span className="attendance-wait-pill">
                                <Clock3 />
                                Sem contato há {formatDuration(refDiff)}
                              </span>
                              {quote.estimated_value ? <strong>{currency(quote.estimated_value)}</strong> : null}
                            </div>
                          </div>

                          {quote.service && <p className="attendance-subject">Serviço: {quote.service}</p>}

                          {quote.next_contact_at && (
                            <p className="attendance-snooze-note">
                              <CalendarClock />
                              Retorno programado:{" "}
                              {new Date(quote.next_contact_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}

                          <div className="attendance-card-actions">
                            {quote.phone && (
                              <Button
                                size="sm"
                                disabled={busyId === quote.id}
                                onClick={() => void openQuoteWhatsApp(quote)}
                              >
                                <MessageCircle />
                                Cobrar / falar no WhatsApp
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => onOpenQuote(quote.id)}>
                              <ExternalLink />
                              Abrir orçamento
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === quote.id}
                              onClick={() =>
                                void updateQuoteFollowUp(quote, {
                                  markContacted: true,
                                  nextContactAt: null,
                                  successMsg: `Contato de hoje salvo no orçamento #${quote.number}.`,
                                })
                              }
                            >
                              <Check />
                              Já falei hoje
                            </Button>
                            <div className="attendance-snooze-group">
                              <span>Lembrar:</span>
                              <button
                                type="button"
                                disabled={busyId === quote.id}
                                onClick={() =>
                                  void updateQuoteFollowUp(quote, {
                                    markContacted: true,
                                    nextContactAt: computeFutureIso(nowMs, "1d"),
                                    successMsg: `Retorno do orçamento #${quote.number} agendado para amanhã.`,
                                  })
                                }
                              >
                                Amanhã
                              </button>
                              <button
                                type="button"
                                disabled={busyId === quote.id}
                                onClick={() =>
                                  void updateQuoteFollowUp(quote, {
                                    markContacted: true,
                                    nextContactAt: computeFutureIso(nowMs, "2d"),
                                    successMsg: `Retorno do orçamento #${quote.number} agendado para +2 dias.`,
                                  })
                                }
                              >
                                +2 dias
                              </button>
                              <button
                                type="button"
                                disabled={busyId === quote.id}
                                onClick={() =>
                                  void updateQuoteFollowUp(quote, {
                                    markContacted: true,
                                    nextContactAt: computeFutureIso(nowMs, "5d"),
                                    successMsg: `Retorno do orçamento #${quote.number} agendado para +5 dias.`,
                                  })
                                }
                              >
                                +5 dias
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="attendance-meta-config">
          <div className="attendance-meta-banner">
            <ShieldCheck />
            <div>
              <b>API Oficial da Meta · Proteção contra custos extras</b>
              <p>
                Receber mensagens de clientes via Webhook da Meta é <b>100% gratuito</b>. No modo <b>Somente Alerta</b> o
                custo é R$ 0 garantido (você responde pelo WhatsApp Business do celular/PC). No modo <b>Trava 24h</b>, o
                banco de dados bloqueia qualquer envio após 23h50 da última mensagem do cliente e nunca envia templates pagos.
              </p>
            </div>
          </div>

          <form className="attendance-meta-form" onSubmit={(e) => void saveMetaConfig(e)}>
            <label className="attendance-toggle">
              <input
                type="checkbox"
                checked={metaEnabled}
                onChange={(e) => setMetaEnabled(e.target.checked)}
              />
              <span>
                <b>Ativar sincronização com WhatsApp Oficial (Meta Cloud API)</b>
                <small>Quando ligado, toda mensagem recebida no seu número entra automaticamente na fila de alertas.</small>
              </span>
            </label>

            <div className="attendance-mode-grid">
              <label className={`attendance-mode-card ${metaMode === "monitor_only" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="metaMode"
                  value="monitor_only"
                  checked={metaMode === "monitor_only"}
                  onChange={() => setMetaMode("monitor_only")}
                />
                <div>
                  <b>Somente Alerta (R$ 0 garantido)</b>
                  <p>
                    Recebe alertas no sino e na tela do computador. Ao clicar em responder, abre direto no WhatsApp Web/App.
                    Não exige Access Token de envio.
                  </p>
                </div>
              </label>

              <label className={`attendance-mode-card ${metaMode === "reply_24h_locked" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="metaMode"
                  value="reply_24h_locked"
                  checked={metaMode === "reply_24h_locked"}
                  onChange={() => setMetaMode("reply_24h_locked")}
                />
                <div>
                  <b>Responder aqui com Trava Rígida de 24h</b>
                  <p>
                    Permite responder texto livre dentro do NexoFab apenas dentro da janela gratuita de 24h. Passou de 23h50,
                    o sistema trava automaticamente para nunca gerar cobrança.
                  </p>
                </div>
              </label>
            </div>

            <div className="attendance-meta-fields">
              <label>
                Phone Number ID (Meta Developers)
                <Input
                  placeholder="Ex.: 104928374651234"
                  value={metaPhoneNumberId}
                  onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                />
              </label>
              <label>
                Número WhatsApp conectado (exibição)
                <Input
                  placeholder="Ex.: (11) 99999-8888"
                  value={metaDisplayPhone}
                  onChange={(e) => setMetaDisplayPhone(e.target.value)}
                />
              </label>
              <label>
                Avisar cliente sem resposta após (minutos)
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={metaAlertMinutes}
                  onChange={(e) => setMetaAlertMinutes(e.target.value)}
                />
              </label>
              <label>
                Access Token da Meta {config?.hasAccessToken ? "(salvo com segurança)" : "(opcional — só para Trava 24h)"}
                <div className="attendance-secret-row">
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={config?.hasAccessToken ? "•••••••• (deixe vazio para manter o atual)" : "EAAG..."}
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                  />
                  {config?.hasAccessToken && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingMeta}
                      onClick={() => void saveMetaConfig(undefined, { clearAccessToken: true })}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </label>
              <label>
                App Secret da Meta {config?.hasAppSecret ? "(validação HMAC ativa)" : "(recomendado para validar assinatura)"}
                <div className="attendance-secret-row">
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={config?.hasAppSecret ? "•••••••• (deixe vazio para manter o atual)" : "Cole o App Secret do painel Meta"}
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                  />
                  {config?.hasAppSecret && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingMeta}
                      onClick={() => void saveMetaConfig(undefined, { clearAppSecret: true })}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </label>
            </div>

            <div className="attendance-meta-actions">
              <Button type="submit" disabled={savingMeta}>
                {savingMeta ? <LoaderCircle className="spin" /> : <Check />}
                Salvar configuração
              </Button>
            </div>
          </form>

          <div className="attendance-webhook-box">
            <h3>Dados do Webhook para colar no painel da Meta</h3>
            <p>
              Salve a configuração acima pelo menos uma vez para gerar o seu <b>Token de verificação</b> exclusivo desta empresa.
            </p>
            <div className="attendance-copy-grid">
              <div>
                <small>URL de retorno de chamada (Callback URL)</small>
                <div>
                  <code>{webhookUrl || "Salve para gerar"}</code>
                  {webhookUrl && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyText("url", webhookUrl)}>
                      {copiedField === "url" ? <Check /> : <Copy />}
                      {copiedField === "url" ? "Copiado" : "Copiar"}
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <small>Token de verificação (Verify Token)</small>
                <div>
                  <code>{config?.verifyToken || "Clique em Salvar configuração para gerar"}</code>
                  {config?.verifyToken && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void copyText("token", config.verifyToken || "")}
                    >
                      {copiedField === "token" ? <Check /> : <Copy />}
                      {copiedField === "token" ? "Copiado" : "Copiar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <ol className="attendance-meta-steps">
              <li>
                Acesse <b>developers.facebook.com</b>, crie um aplicativo do tipo <b>Empresas</b> e adicione o produto{" "}
                <b>WhatsApp</b>.
              </li>
              <li>
                Conecte seu número comercial (com a opção de <b>Coexistência do WhatsApp Business</b> você continua usando o app no celular normalmente).
              </li>
              <li>
                Em <b>WhatsApp → Configuração → Webhook</b>, cole a <b>URL</b> e o <b>Token de verificação</b> acima e clique em <b>Verificar e salvar</b>.
              </li>
              <li>
                Assine o campo <code>messages</code> (e <code>smb_message_echoes</code> se usar Coexistência, para o NexoFab marcar como respondido automaticamente quando você responder pelo celular!).
              </li>
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
