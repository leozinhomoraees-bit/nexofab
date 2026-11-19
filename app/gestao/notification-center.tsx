"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, ExternalLink, Factory, FileCheck2, FileX2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";

type Notification = {
  id: string;
  type: "proposal_approved" | "proposal_rejected" | "production_pending" | "production_due" | "production_overdue" | "system";
  title: string;
  message: string;
  quote_id?: string | null;
  metadata?: { quoteNumber?: number; customer?: string; phone?: string; service?: string; value?: number; status?: string; productionOrderId?: string; dueAt?: string | null; virtual?: boolean } | null;
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

const virtualReadStorageKey = "nexofab-production-notifications-read";

function locallyReadVirtualNotifications() {
  try { return new Set<string>(JSON.parse(localStorage.getItem(virtualReadStorageKey) || "[]")); }
  catch { return new Set<string>(); }
}

export function NotificationCenter({ onOpenQuotes, onOpenProduction }: { onOpenQuotes: (quoteId?: string) => void; onOpenProduction: () => void }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [setupRequired, setSetupRequired] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/gestao/notificacoes", { cache: "no-store" });
    if (!response.ok) { setSetupRequired(true); return; }
    const payload = await response.json() as { notifications: Notification[]; unread: number; setupRequired?: boolean };
    const locallyRead = locallyReadVirtualNotifications();
    const normalized = payload.notifications.map((notification) => notification.metadata?.virtual && locallyRead.has(notification.id) ? { ...notification, read_at: notification.read_at || new Date().toISOString() } : notification);
    setNotifications(normalized);
    setUnread(normalized.filter((notification) => !notification.read_at).length);
    setSetupRequired(Boolean(payload.setupRequired));
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30000);
    const visibility = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [load]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function mark(id?: string) {
    const virtualIds = id?.startsWith("production:") ? [id] : !id ? notifications.filter((notification) => notification.metadata?.virtual).map((notification) => notification.id) : [];
    if (virtualIds.length) {
      const read = locallyReadVirtualNotifications();
      virtualIds.forEach((item) => read.add(item));
      localStorage.setItem(virtualReadStorageKey, JSON.stringify([...read].slice(-300)));
      setNotifications((current) => current.map((notification) => virtualIds.includes(notification.id) ? { ...notification, read_at: notification.read_at || new Date().toISOString() } : notification));
      setUnread((current) => Math.max(0, current - virtualIds.filter((item) => !notifications.find((notification) => notification.id === item)?.read_at).length));
      if (id) return;
    }
    await fetch("/api/gestao/notificacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    await load();
  }

  async function openNotification(notification: Notification) {
    if (!notification.read_at) await mark(notification.id);
    if (notification.type.startsWith("production_")) onOpenProduction();
    else if (notification.quote_id) onOpenQuotes(notification.quote_id);
    setOpen(false);
  }

  async function openWhatsApp(event: React.MouseEvent, notification: Notification) {
    event.stopPropagation();
    if (!notification.read_at) await mark(notification.id);
    const customer = notification.metadata?.customer || "cliente";
    const number = notification.metadata?.quoteNumber || "";
    const service = notification.metadata?.service ? ` sobre ${notification.metadata.service}` : "";
    const destination = whatsappUrl(notification.metadata?.phone, `Olá, ${customer}! Recebemos a aprovação da proposta #${number}${service}. Obrigado pela confiança! Vamos alinhar a entrada, o prazo e os próximos passos da produção.`);
    if (destination) window.open(destination, "_blank", "noopener,noreferrer");
    else if (notification.quote_id) onOpenQuotes(notification.quote_id);
  }

  return <div className="notification-center" ref={root}>
    <button className="notification-trigger" type="button" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell/>{unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <div className="notification-popover">
      <header><div><small>CENTRAL DE AVISOS</small><b>Notificações</b></div>{unread > 0 && <Button size="sm" variant="ghost" onClick={() => void mark()}><CheckCheck/>Marcar lidas</Button>}</header>
      <div className="notification-list">
        {setupRequired ? <div className="notification-empty"><Bell/><b>Ativação pendente</b><p>Aplique a nova migração do Supabase para receber aprovações aqui.</p></div> : notifications.length ? notifications.map((notification) => {
          const Icon = notification.type === "proposal_rejected" ? FileX2 : notification.type === "production_overdue" ? AlertTriangle : notification.type === "production_due" ? CalendarClock : notification.type === "production_pending" ? Factory : FileCheck2;
          return <article key={notification.id} className={notification.read_at ? "" : "unread"}>
            <button type="button" className="notification-main" onClick={() => void openNotification(notification)}>
              <span className={`notification-icon ${notification.type}`}><Icon/></span><span><b>{notification.title}</b><p>{notification.message}</p><small>{relativeTime(notification.created_at)}</small></span>
            </button>
            {notification.type === "proposal_approved" && <div className="notification-actions"><button type="button" onClick={() => void openNotification(notification)}><ExternalLink/>Abrir orçamento</button><button type="button" onClick={(event) => void openWhatsApp(event, notification)}><MessageCircle/>Falar no WhatsApp</button></div>}
            {notification.type.startsWith("production_") && <div className="notification-actions"><button type="button" onClick={() => void openNotification(notification)}><Factory/>Abrir produção</button></div>}
          </article>;
        }) : <div className="notification-empty"><Bell/><b>Tudo em dia</b><p>As respostas dos clientes aparecerão aqui automaticamente.</p></div>}
      </div>
    </div>}
  </div>;
}

