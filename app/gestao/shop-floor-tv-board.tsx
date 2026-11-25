"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Maximize2, Minimize2, Palette, RefreshCw, Tv, X } from "lucide-react";

type TvOrder = {
  id: string;
  number: number;
  title: string;
  stage: string;
  priority: string;
  due_at?: string | null;
  responsible_id?: string | null;
  production_material_reservations?: Array<{ status: string }>;
  production_artwork_approvals?: Array<{ status: string }>;
  quotes?: { customer_name?: string; company?: string | null; service?: string } | null;
};

const tvColumns = [
  { key: "prep", title: "A PROGRAMAR / ARTE", stages: ["briefing", "arte"], accent: "blue" },
  { key: "approval", title: "APROVAÇÃO", stages: ["aprovacao"], accent: "amber" },
  { key: "production", title: "EM PRODUÇÃO", stages: ["producao"], accent: "teal" },
  { key: "finishing", title: "ACABAMENTO", stages: ["acabamento"], accent: "violet" },
  { key: "delivery", title: "EXPEDIÇÃO / INSTALAÇÃO", stages: ["expedicao", "instalacao"], accent: "emerald" },
] as const;

const priorityRank: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
const showDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "Sem prazo");

export function ShopFloorTvBoard({
  orders,
  staffMap,
  today,
  dueSoonLimit,
  onRefresh,
  onOpenOrder,
  onClose,
}: {
  orders: TvOrder[];
  staffMap: Map<string, string>;
  today: string;
  dueSoonLimit: string;
  onRefresh: () => Promise<void>;
  onOpenOrder: (orderId: string) => void;
  onClose: () => void;
}) {
  const [clock, setClock] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateLabel(now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }));
    };
    const init = window.setTimeout(updateClock, 0);
    const secTimer = window.setInterval(() => {
      updateClock();
      setCountdown((prev) => {
        if (prev <= 1) {
          setRefreshing(true);
          void onRefresh().finally(() => setRefreshing(false));
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
    };
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(init);
      window.clearInterval(secTimer);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose, onRefresh]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore browsers blocking fullscreen
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    setCountdown(30);
    await onRefresh().finally(() => setRefreshing(false));
  }

  const activeOrders = orders.filter((order) => !["concluido", "cancelado"].includes(order.stage));
  const overdueCount = activeOrders.filter((order) => order.due_at && order.due_at.slice(0, 10) < today).length;
  const dueSoonCount = activeOrders.filter((order) => {
    const due = order.due_at?.slice(0, 10);
    return Boolean(due) && due! >= today && due! <= dueSoonLimit;
  }).length;
  const urgentCount = activeOrders.filter((order) => order.priority === "urgente").length;

  return (
    <div className="tv-board-overlay" role="dialog" aria-modal="true" aria-label="Modo TV — Painel de Chão de Fábrica">
      <header className="tv-board-header">
        <div className="tv-brand">
          <span className="tv-brand-icon"><Tv /></span>
          <div>
            <strong><span>Nexo</span>Fab · CHÃO DE FÁBRICA</strong>
            <small>Painel PCP em tempo real · Atualiza em {countdown}s</small>
          </div>
        </div>

        <div className="tv-kpis">
          <span className="tv-kpi"><b>{activeOrders.length}</b><small>Ativas</small></span>
          <span className={`tv-kpi ${overdueCount > 0 ? "danger" : ""}`}><b>{overdueCount}</b><small>Atrasadas</small></span>
          <span className={`tv-kpi ${dueSoonCount > 0 ? "warn" : ""}`}><b>{dueSoonCount}</b><small>Prazo próx.</small></span>
          <span className={`tv-kpi ${urgentCount > 0 ? "urgent" : ""}`}><b>{urgentCount}</b><small>Urgentes</small></span>
        </div>

        <div className="tv-controls">
          <div className="tv-clock">
            <b>{clock || "--:--:--"}</b>
            <small>{dateLabel}</small>
          </div>
          <button type="button" onClick={() => void manualRefresh()} title="Atualizar agora">
            <RefreshCw className={refreshing ? "spin" : ""} />
          </button>
          <button type="button" onClick={() => void toggleFullscreen()} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            <span>{isFullscreen ? "Janela" : "Tela cheia"}</span>
          </button>
          <button type="button" className="tv-close" onClick={onClose} title="Fechar Modo TV">
            <X />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <div className="tv-board-columns">
        {tvColumns.map((col) => {
          const list = activeOrders
            .filter((order) => (col.stages as readonly string[]).includes(order.stage))
            .sort((a, b) => {
              const aOver = a.due_at && a.due_at.slice(0, 10) < today ? 0 : 1;
              const bOver = b.due_at && b.due_at.slice(0, 10) < today ? 0 : 1;
              if (aOver !== bOver) return aOver - bOver;
              const pDiff = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
              if (pDiff !== 0) return pDiff;
              return (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999");
            });

          return (
            <section key={col.key} className={`tv-col accent-${col.accent}`}>
              <header>
                <h2>{col.title}</h2>
                <span>{list.length}</span>
              </header>
              <div className="tv-col-list">
                {list.length === 0 ? (
                  <p className="tv-col-empty">Fila livre</p>
                ) : list.map((order) => {
                  const due = order.due_at?.slice(0, 10);
                  const overdue = Boolean(due) && due! < today;
                  const isToday = due === today;
                  const dueSoon = !overdue && Boolean(due) && due! <= dueSoonLimit;
                  const shortage = (order.production_material_reservations ?? []).some((item) => item.status === "insuficiente");
                  const latestArt = order.production_artwork_approvals?.[0];
                  const owner = order.responsible_id ? staffMap.get(order.responsible_id)?.split(" ")[0] : null;

                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => onOpenOrder(order.id)}
                      className={`tv-card ${overdue ? "overdue" : dueSoon ? "due-soon" : ""}`}
                    >
                      <div className="tv-card-head">
                        <b>OS-{order.number}</b>
                        <em className={`priority-${order.priority}`}>{order.priority}</em>
                      </div>
                      <h3>{order.quotes?.service || order.title}</h3>
                      <p>{order.quotes?.company || order.quotes?.customer_name || "Cliente"}</p>
                      <div className="tv-card-foot">
                        <span className={`tv-due ${overdue ? "overdue" : isToday ? "today" : dueSoon ? "soon" : ""}`}>
                          <CalendarClock />
                          {overdue ? `ATRASADA · ${showDate(order.due_at)}` : isToday ? "HOJE" : showDate(order.due_at)}
                        </span>
                        {owner && <span className="tv-owner">{owner}</span>}
                      </div>
                      {(shortage || latestArt?.status === "ajustes") && (
                        <div className="tv-card-alerts">
                          {shortage && <span><AlertTriangle />Falta material</span>}
                          {latestArt?.status === "ajustes" && <span><Palette />Ajuste de arte</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
