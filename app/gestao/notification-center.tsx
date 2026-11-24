"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellRing, CalendarClock, CheckCheck, Clock3, ExternalLink, Eye, Factory, FileCheck2, FileX2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";

type Notification = {
  id: string;
  type:
    | "proposal_approved"
    | "proposal_rejected"
    | "production_pending"
    | "production_due"
    | "production_overdue"
    | "customer_unanswered"
    | "followup_due"
    | "system";
  title: string;
  message: string;
  quote_id?: string | null;
  metadata?: {
    quoteNumber?: number;
    customer?: string;
    phone?: string;
    service?: string;
    value?: number;
    status?: string;
    productionOrderId?: string;
    threadId?: string;
    dueAt?: string | null;
    virtual?: boolean;
    event?: string;
    viewCount?: number;
  } | null;
  read_at?: string | null;
  created_at: string;
};

const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Date(value).toLocaleDateString("pt-BR");
};

const virtualReadStorageKey = "nexofab-virtual-notifications-read";
const desktopPushKey = "nexofab-desktop-push-enabled";

function locallyReadVirtualNotifications() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(virtualReadStorageKey) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function isVirtualId(id: string) {
  return id.startsWith("production:") || id.startsWith("attendance:") || id.startsWith("quote:");
}

export function NotificationCenter({
  onOpenQuotes,
  onOpenProduction,
  onOpenAttendance,
}: {
  onOpenQuotes: (quoteId?: string) => void;
  onOpenProduction: () => void;
  onOpenAttendance?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [setupRequired, setSetupRequired] = useState(false);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const stored = window.localStorage.getItem(desktopPushKey) === "1";
      setDesktopEnabled(stored && window.Notification.permission === "granted");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/gestao/notificacoes", { cache: "no-store" });
    if (!response.ok) {
      setSetupRequired(true);
      return;
    }
    const payload = (await response.json()) as {
      notifications: Notification[];
      unread: number;
      setupRequired?: boolean;
    };
    const locallyRead = locallyReadVirtualNotifications();
    const normalized = payload.notifications.map((notification) =>
      notification.metadata?.virtual && locallyRead.has(notification.id)
        ? { ...notification, read_at: notification.read_at || new Date().toISOString() }
        : notification,
    );

    if (initializedRef.current && typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted" && window.localStorage.getItem(desktopPushKey) === "1") {
      const freshUnread = normalized.filter(
        (item) =>
          !item.read_at
          && !seenIdsRef.current.has(item.id)
          && ["customer_unanswered", "followup_due", "proposal_approved", "system"].includes(item.type),
      );
      if (freshUnread.length > 0) {
        const first = freshUnread[0];
        const desktopNotif = new window.Notification(
          freshUnread.length === 1 ? first.title : `${freshUnread.length} alertas de atendimento no NexoFab`,
          {
            body: freshUnread.length === 1 ? first.message : `${first.title} e mais ${freshUnread.length - 1} pendência(s).`,
            tag: "nexofab-alert",
          },
        );
        desktopNotif.onclick = () => {
          window.focus();
          desktopNotif.close();
        };
      }
    }

    for (const item of normalized) seenIdsRef.current.add(item.id);
    initializedRef.current = true;

    setNotifications(normalized);
    setUnread(normalized.filter((notification) => !notification.read_at).length);
    setSetupRequired(Boolean(payload.setupRequired));
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30000);
    const visibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function toggleDesktopNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (desktopEnabled) {
      window.localStorage.setItem(desktopPushKey, "0");
      setDesktopEnabled(false);
      return;
    }
    const permission =
      window.Notification.permission === "granted"
        ? "granted"
        : await window.Notification.requestPermission();
    if (permission === "granted") {
      window.localStorage.setItem(desktopPushKey, "1");
      setDesktopEnabled(true);
      new window.Notification("Alertas do NexoFab ativados", {
        body: "Você será avisado aqui sempre que houver cliente sem resposta ou proposta visualizada.",
        tag: "nexofab-welcome",
      });
    }
  }

  async function mark(id?: string) {
    const virtualIds =
      id && isVirtualId(id)
        ? [id]
        : !id
          ? notifications.filter((notification) => notification.metadata?.virtual).map((notification) => notification.id)
          : [];
    if (virtualIds.length) {
      const read = locallyReadVirtualNotifications();
      virtualIds.forEach((item) => read.add(item));
      localStorage.setItem(virtualReadStorageKey, JSON.stringify([...read].slice(-300)));
      setNotifications((current) =>
        current.map((notification) =>
          virtualIds.includes(notification.id)
            ? { ...notification, read_at: notification.read_at || new Date().toISOString() }
            : notification,
        ),
      );
      setUnread((current) =>
        Math.max(
          0,
          current - virtualIds.filter((item) => !notifications.find((notification) => notification.id === item)?.read_at).length,
        ),
      );
      if (id) return;
    }
    await fetch("/api/gestao/notificacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await load();
  }

  async function openNotification(notification: Notification) {
    if (!notification.read_at) await mark(notification.id);
    if (notification.type.startsWith("production_")) onOpenProduction();
    else if (notification.metadata?.threadId && onOpenAttendance) onOpenAttendance();
    else if (notification.quote_id) onOpenQuotes(notification.quote_id);
    else if (onOpenAttendance) onOpenAttendance();
    setOpen(false);
  }

  async function openWhatsApp(event: React.MouseEvent, notification: Notification) {
    event.stopPropagation();
    if (!notification.read_at) await mark(notification.id);
    const customer = notification.metadata?.customer || "cliente";
    const number = notification.metadata?.quoteNumber || "";
    const service = notification.metadata?.service ? ` sobre ${notification.metadata.service}` : "";
    const message =
      notification.metadata?.event === "proposal_viewed"
        ? `Olá, ${customer}! Tudo bem? Vi que você acessou a proposta #${number}${service}. Ficou alguma dúvida ou posso ajustar algum detalhe para fecharmos?`
        : notification.type === "customer_unanswered" || notification.type === "followup_due"
          ? `Olá, ${customer}! Tudo bem? Estou retornando seu atendimento${service ? service : ""}. Como posso te ajudar para darmos andamento?`
          : `Olá, ${customer}! Recebemos a aprovação da proposta #${number}${service}. Obrigado pela confiança! Vamos alinhar a entrada, o prazo e os próximos passos da produção.`;
    const destination = whatsappUrl(notification.metadata?.phone, message);
    if (notification.quote_id && (notification.type === "customer_unanswered" || notification.type === "followup_due")) {
      void fetch("/api/gestao/atendimentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote_contact", quoteId: notification.quote_id, markContacted: true }),
      }).catch(() => undefined);
    }
    if (destination) window.open(destination, "_blank", "noopener,noreferrer");
    else if (notification.quote_id) onOpenQuotes(notification.quote_id);
  }

  const supportsDesktop = typeof window !== "undefined" && "Notification" in window;

  return (
    <div className="notification-center" ref={root}>
      <button
        className="notification-trigger"
        type="button"
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notification-popover">
          <header>
            <div>
              <small>CENTRAL DE AVISOS</small>
              <b>Notificações</b>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {supportsDesktop && (
                <Button
                  size="sm"
                  variant={desktopEnabled ? "secondary" : "ghost"}
                  onClick={() => void toggleDesktopNotifications()}
                  title="Receber avisos na tela do computador/celular mesmo em outra aba"
                >
                  <BellRing />
                  {desktopEnabled ? "Tela ON" : "Avisar na tela"}
                </Button>
              )}
              {unread > 0 && (
                <Button size="sm" variant="ghost" onClick={() => void mark()}>
                  <CheckCheck />
                  Lidas
                </Button>
              )}
            </div>
          </header>
          <div className="notification-list">
            {setupRequired ? (
              <div className="notification-empty">
                <Bell />
                <b>Ativação pendente</b>
                <p>Aplique a nova migração do Supabase para receber aprovações aqui.</p>
              </div>
            ) : notifications.length ? (
              notifications.map((notification) => {
                const isProposalViewed = notification.metadata?.event === "proposal_viewed";
                const isFollowUp = notification.type === "customer_unanswered" || notification.type === "followup_due";
                const Icon = isProposalViewed
                  ? Eye
                  : notification.type === "customer_unanswered"
                    ? Clock3
                    : notification.type === "followup_due"
                      ? CalendarClock
                      : notification.type === "proposal_rejected"
                        ? FileX2
                        : notification.type === "production_overdue"
                          ? AlertTriangle
                          : notification.type === "production_due"
                            ? CalendarClock
                            : notification.type === "production_pending"
                              ? Factory
                              : FileCheck2;
                return (
                  <article key={notification.id} className={notification.read_at ? "" : "unread"}>
                    <button type="button" className="notification-main" onClick={() => void openNotification(notification)}>
                      <span className={`notification-icon ${notification.type}`}>
                        <Icon />
                      </span>
                      <span>
                        <b>{notification.title}</b>
                        <p>{notification.message}</p>
                        <small>{relativeTime(notification.created_at)}</small>
                      </span>
                    </button>
                    {(notification.type === "proposal_approved" || isProposalViewed || isFollowUp) && (
                      <div className="notification-actions">
                        <button type="button" onClick={() => void openNotification(notification)}>
                          <ExternalLink />
                          {notification.metadata?.threadId ? "Abrir atendimento" : "Abrir orçamento"}
                        </button>
                        {notification.metadata?.phone && (
                          <button type="button" onClick={(event) => void openWhatsApp(event, notification)}>
                            <MessageCircle />
                            Falar no WhatsApp
                          </button>
                        )}
                      </div>
                    )}
                    {notification.type.startsWith("production_") && (
                      <div className="notification-actions">
                        <button type="button" onClick={() => void openNotification(notification)}>
                          <Factory />
                          Abrir produção
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="notification-empty">
                <Bell />
                <b>Tudo em dia</b>
                <p>Clientes sem resposta, propostas visualizadas e aprovações aparecerão aqui automaticamente.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
