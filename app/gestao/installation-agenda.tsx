"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Printer,
  Store,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { whatsappUrl } from "@/lib/whatsapp";

export type DeliveryMode = "instalacao" | "entrega" | "retirada";

export type AgendaOrder = {
  id: string;
  number: number;
  title: string;
  description?: string | null;
  stage: string;
  priority: string;
  due_at?: string | null;
  scheduled_start_at?: string | null;
  responsible_id?: string | null;
  delivery_mode?: DeliveryMode | null;
  scheduled_time?: string | null;
  site_address?: string | null;
  site_notes?: string | null;
  customer_address?: string | null;
  quotes?: {
    number?: number;
    customer_name?: string;
    company?: string | null;
    phone?: string | null;
    service?: string;
    estimated_value?: number | null;
    installation_included?: boolean;
    quote_items?: Array<{
      id: string;
      description: string;
      quantity: number;
      unit: string;
      selected_by_customer?: boolean | null;
    }>;
  } | null;
};

export type AgendaStaff = { id: string; full_name?: string | null; role: string };

export const deliveryModeMeta: Record<DeliveryMode, { label: string; short: string; colorClass: string }> = {
  instalacao: { label: "Instalação no local", short: "Instalação", colorClass: "mode-instalacao" },
  entrega: { label: "Entrega / frete", short: "Entrega", colorClass: "mode-entrega" },
  retirada: { label: "Retirada no balcão", short: "Retirada", colorClass: "mode-retirada" },
};

export function inferDeliveryMode(order: AgendaOrder): DeliveryMode {
  if (order.delivery_mode === "instalacao" || order.delivery_mode === "entrega" || order.delivery_mode === "retirada") {
    return order.delivery_mode;
  }
  if (order.stage === "instalacao" || order.quotes?.installation_included) return "instalacao";
  if (order.stage === "expedicao") return "entrega";
  return "retirada";
}

export function resolveOrderAddress(order: AgendaOrder): string {
  return (order.site_address || order.customer_address || "").trim();
}

export function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function wazeUrl(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function addDays(date: Date, delta: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta, 12, 0, 0);
  return next;
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const stageShortLabel: Record<string, string> = {
  briefing: "A programar",
  arte: "Arte",
  aprovacao: "Aprovação",
  producao: "Produção",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  instalacao: "Instalação",
  concluido: "Concluído",
};

export function InstallationAgenda<T extends AgendaOrder>({
  orders,
  staff,
  todayIso,
  onSelectOrder,
  onReschedule,
}: {
  orders: T[];
  staff: AgendaStaff[];
  todayIso: string;
  onSelectOrder: (order: T) => void;
  onReschedule: (orderId: string, nextDueIso: string) => Promise<void>;
}) {
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => parseIsoDate(todayIso));
  const [modeFilter, setModeFilter] = useState<"todos" | DeliveryMode>("todos");
  const [responsibleFilter, setResponsibleFilter] = useState("todos");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [quickDates, setQuickDates] = useState<Record<string, string>>({});
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  const staffMap = useMemo(() => new Map(staff.map((person) => [person.id, person.full_name || "Equipe"])), [staff]);

  const baseOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (order.stage === "cancelado") return false;
        if (!includeCompleted && order.stage === "concluido") return false;
        if (responsibleFilter !== "todos") {
          if (responsibleFilter === "sem_responsavel" && order.responsible_id) return false;
          if (responsibleFilter !== "sem_responsavel" && order.responsible_id !== responsibleFilter) return false;
        }
        return true;
      }),
    [includeCompleted, orders, responsibleFilter],
  );

  const countsByMode = useMemo(() => {
    const counts = { todos: baseOrders.length, instalacao: 0, entrega: 0, retirada: 0 };
    for (const order of baseOrders) counts[inferDeliveryMode(order)] += 1;
    return counts;
  }, [baseOrders]);

  const visibleOrders = useMemo(
    () => baseOrders.filter((order) => modeFilter === "todos" || inferDeliveryMode(order) === modeFilter),
    [baseOrders, modeFilter],
  );

  const ordersByDate = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const order of visibleOrders) {
      const dateKey = order.due_at?.slice(0, 10);
      if (!dateKey) continue;
      const list = map.get(dateKey) ?? [];
      list.push(order);
      map.set(dateKey, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99") || a.number - b.number);
    }
    return map;
  }, [visibleOrders]);

  const unscheduledOrders = useMemo(
    () => visibleOrders.filter((order) => !order.due_at && order.stage !== "concluido"),
    [visibleOrders],
  );

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(anchorDate);
    return Array.from({ length: 7 }, (_, idx) => {
      const date = addDays(start, idx);
      return { date, iso: toIsoDate(date) };
    });
  }, [anchorDate]);

  const monthCells = useMemo(() => {
    const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12, 0, 0);
    const gridStart = startOfWeekMonday(firstOfMonth);
    return Array.from({ length: 42 }, (_, idx) => {
      const date = addDays(gridStart, idx);
      return {
        date,
        iso: toIsoDate(date),
        inCurrentMonth: date.getMonth() === anchorDate.getMonth(),
      };
    });
  }, [anchorDate]);

  const periodLabel = useMemo(() => {
    if (calendarMode === "month") {
      return `${MONTH_LONG[anchorDate.getMonth()]} de ${anchorDate.getFullYear()}`;
    }
    const first = weekDays[0].date;
    const last = weekDays[6].date;
    const sameMonth = first.getMonth() === last.getMonth();
    return sameMonth
      ? `${first.getDate()} – ${last.getDate()} ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`
      : `${first.getDate()} ${MONTH_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  }, [anchorDate, calendarMode, weekDays]);

  function navigatePeriod(delta: number) {
    if (calendarMode === "week") {
      setAnchorDate((current) => addDays(current, delta * 7));
    } else {
      setAnchorDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12, 0, 0));
    }
  }

  async function handleDropOnDate(dateIso: string, droppedId: string) {
    setDragOrderId(null);
    setDragOverDate(null);
    const order = orders.find((item) => item.id === droppedId);
    if (!order || order.due_at?.slice(0, 10) === dateIso) return;
    setSchedulingId(order.id);
    try {
      await onReschedule(order.id, dateIso);
    } finally {
      setSchedulingId(null);
    }
  }

  async function handleQuickSchedule(orderId: string) {
    const picked = quickDates[orderId] || todayIso;
    if (!picked) return;
    setSchedulingId(orderId);
    try {
      await onReschedule(orderId, picked);
    } finally {
      setSchedulingId(null);
    }
  }

  function openConfirmWhatsApp(order: T) {
    const mode = inferDeliveryMode(order);
    const verb = mode === "instalacao" ? "instalação" : mode === "entrega" ? "entrega" : "retirada";
    const dateText = order.due_at ? new Date(order.due_at).toLocaleDateString("pt-BR") : "a combinar";
    const timeText = order.scheduled_time ? ` às ${order.scheduled_time}` : "";
    const address = resolveOrderAddress(order);
    const addrNote = mode !== "retirada" && address ? ` no endereço: ${address}` : "";
    const url = whatsappUrl(
      order.quotes?.phone,
      `Olá, ${order.quotes?.customer_name || "cliente"}! Confirmando a ${verb} da OS-${order.number} (${order.quotes?.service || order.title}) prevista para ${dateText}${timeText}${addrNote}. Qualquer ajuste, pode nos avisar por aqui!`,
    );
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function printRoute() {
    const targetDays = calendarMode === "week"
      ? weekDays
      : monthCells.filter((cell) => cell.inCurrentMonth);
    const sections = targetDays
      .map(({ date, iso }) => {
        const list = ordersByDate.get(iso) ?? [];
        if (!list.length) return "";
        const dayTitle = `${WEEKDAY_SHORT[date.getDay()]}, ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
        const cards = list
          .map((order) => {
            const mode = deliveryModeMeta[inferDeliveryMode(order)].short;
            const address = resolveOrderAddress(order);
            const responsible = order.responsible_id ? staffMap.get(order.responsible_id) || "Equipe" : "A definir";
            const itemsSummary = (order.quotes?.quote_items ?? [])
              .filter((item) => item.selected_by_customer !== false)
              .map((item) => `${item.quantity} ${item.unit} · ${item.description}`)
              .join(" | ");
            return `<div class="stop">
              <div class="stop-head">
                <strong>${order.scheduled_time ? `${escapeHtml(order.scheduled_time)} · ` : ""}OS-${order.number} — ${escapeHtml(order.quotes?.company || order.quotes?.customer_name || "Cliente")}</strong>
                <span class="pill">${escapeHtml(mode)}</span>
              </div>
              <div class="meta">${escapeHtml(order.quotes?.service || order.title)} · Resp.: ${escapeHtml(responsible)}${order.quotes?.phone ? ` · Tel.: ${escapeHtml(order.quotes.phone)}` : ""}</div>
              ${address ? `<div class="addr"><strong>Endereço:</strong> ${escapeHtml(address)}</div>` : ""}
              ${itemsSummary ? `<div class="items"><strong>Itens:</strong> ${escapeHtml(itemsSummary)}</div>` : ""}
              ${order.site_notes ? `<div class="notes"><strong>Campo/acesso:</strong> ${escapeHtml(order.site_notes)}</div>` : ""}
            </div>`;
          })
          .join("");
        return `<section class="day"><h2>${escapeHtml(dayTitle)} (${list.length})</h2>${cards}</section>`;
      })
      .filter(Boolean)
      .join("");

    const popup = window.open("", "_blank", "width=920,height=720");
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Roteiro de Campo — ${escapeHtml(periodLabel)}</title><style>
      body { font-family: Arial, sans-serif; color: #10262c; margin: 24px; }
      header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #0d857b; padding-bottom: 10px; margin-bottom: 18px; }
      h1 { margin: 0; font-size: 20px; }
      header small { color: #546b70; font-size: 12px; }
      .day { margin-bottom: 20px; page-break-inside: avoid; }
      .day h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #0d6e66; border-bottom: 1px solid #d7e4e4; padding-bottom: 5px; margin: 0 0 10px; }
      .stop { border: 1px solid #d3e1e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; }
      .stop-head { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; margin-bottom: 4px; }
      .pill { background: #e8f6f3; color: #0b6f67; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .meta, .addr, .items, .notes { font-size: 12px; margin-top: 3px; line-height: 1.45; }
      .notes { background: #fff9eb; padding: 5px 8px; border-radius: 6px; border: 1px solid #ecd7a8; }
      @media print { body { margin: 12mm; } }
    </style></head><body>
      <header><div><h1>Roteiro de Instalações e Entregas</h1><small>NexoFab · ${escapeHtml(periodLabel)}</small></div><small>Impresso em ${new Date().toLocaleString("pt-BR")}</small></header>
      ${sections || "<p>Nenhuma ordem agendada neste período.</p>"}
    </body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 250);
  }

  return (
    <section className="install-agenda" aria-label="Agenda visual de instalações e entregas">
      <div className="agenda-header-bar">
        <div className="agenda-nav-group">
          <div className="agenda-nav-buttons">
            <Button type="button" variant="outline" size="sm" onClick={() => navigatePeriod(-1)} aria-label="Período anterior">
              <ChevronLeft />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAnchorDate(parseIsoDate(todayIso))}>
              Hoje
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => navigatePeriod(1)} aria-label="Próximo período">
              <ChevronRight />
            </Button>
          </div>
          <h2>{periodLabel}</h2>
        </div>

        <div className="agenda-header-controls">
          <div className="agenda-span-toggle" role="group" aria-label="Escala do calendário">
            <button type="button" className={calendarMode === "week" ? "active" : ""} onClick={() => setCalendarMode("week")}>
              <CalendarDays />
              Semana
            </button>
            <button type="button" className={calendarMode === "month" ? "active" : ""} onClick={() => setCalendarMode("month")}>
              <Calendar />
              Mês
            </button>
          </div>
          <label className="agenda-staff-filter">
            <UserRound />
            <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)} aria-label="Filtrar por responsável">
              <option value="todos">Toda a equipe</option>
              <option value="sem_responsavel">Sem responsável</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>{person.full_name || "Equipe"}</option>
              ))}
            </select>
          </label>
          <label className="agenda-completed-check">
            <input type="checkbox" checked={includeCompleted} onChange={(event) => setIncludeCompleted(event.target.checked)} />
            Mostrar concluídas
          </label>
          <Button type="button" variant="outline" size="sm" onClick={printRoute}>
            <Printer />
            Imprimir roteiro
          </Button>
        </div>
      </div>

      <div className="agenda-mode-pills" role="group" aria-label="Filtrar por modalidade">
        <button type="button" className={modeFilter === "todos" ? "active" : ""} onClick={() => setModeFilter("todos")}>
          Todos <span>{countsByMode.todos}</span>
        </button>
        <button type="button" className={`mode-instalacao ${modeFilter === "instalacao" ? "active" : ""}`} onClick={() => setModeFilter("instalacao")}>
          <Wrench />
          Instalações <span>{countsByMode.instalacao}</span>
        </button>
        <button type="button" className={`mode-entrega ${modeFilter === "entrega" ? "active" : ""}`} onClick={() => setModeFilter("entrega")}>
          <Truck />
          Entregas <span>{countsByMode.entrega}</span>
        </button>
        <button type="button" className={`mode-retirada ${modeFilter === "retirada" ? "active" : ""}`} onClick={() => setModeFilter("retirada")}>
          <Store />
          Retiradas <span>{countsByMode.retirada}</span>
        </button>
        <small className="agenda-drag-hint">Arraste qualquer card para outro dia para reagendar o prazo instantaneamente.</small>
      </div>

      {calendarMode === "week" ? (
        <div className="agenda-week-grid">
          {weekDays.map(({ date, iso }) => {
            const dayOrders = ordersByDate.get(iso) ?? [];
            const isToday = iso === todayIso;
            const isPast = iso < todayIso;
            const isOver = dragOverDate === iso;
            return (
              <div
                key={iso}
                className={`agenda-day-col ${isToday ? "is-today" : ""} ${isPast ? "is-past" : ""} ${isOver ? "drag-over" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverDate !== iso) setDragOverDate(iso);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragOverDate((cur) => (cur === iso ? null : cur));
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedId = event.dataTransfer.getData("text/plain") || dragOrderId;
                  if (droppedId) void handleDropOnDate(iso, droppedId);
                }}
              >
                <header>
                  <div>
                    <small>{WEEKDAY_SHORT[date.getDay()]}</small>
                    <strong>
                      {String(date.getDate()).padStart(2, "0")}/{String(date.getMonth() + 1).padStart(2, "0")}
                    </strong>
                  </div>
                  {isToday ? <span className="today-tag">HOJE</span> : <span className="day-count">{dayOrders.length}</span>}
                </header>

                <div className="agenda-day-list">
                  {dayOrders.length === 0 ? (
                    <p className="agenda-day-empty">Livre</p>
                  ) : (
                    dayOrders.map((order) => {
                      const mode = inferDeliveryMode(order);
                      const meta = deliveryModeMeta[mode];
                      const address = resolveOrderAddress(order);
                      const overdue = !["concluido", "cancelado"].includes(order.stage) && iso < todayIso;
                      const responsible = order.responsible_id ? staffMap.get(order.responsible_id) : null;
                      return (
                        <article
                          key={order.id}
                          draggable={schedulingId !== order.id}
                          onDragStart={(event) => {
                            setDragOrderId(order.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", order.id);
                          }}
                          onDragEnd={() => {
                            setDragOrderId(null);
                            setDragOverDate(null);
                          }}
                          className={`agenda-card ${meta.colorClass} ${overdue ? "overdue" : ""} ${order.stage === "concluido" ? "done" : ""}`}
                          onClick={() => onSelectOrder(order)}
                        >
                          <div className="agenda-card-top">
                            <span className={`agenda-mode-badge ${meta.colorClass}`}>
                              {mode === "instalacao" ? <Wrench /> : mode === "entrega" ? <Truck /> : <Store />}
                              {meta.short}
                            </span>
                            {order.scheduled_time ? (
                              <span className="agenda-time-pill"><Clock3 />{order.scheduled_time}</span>
                            ) : (
                              <span className="agenda-stage-pill">{stageShortLabel[order.stage] ?? order.stage}</span>
                            )}
                          </div>

                          <div className="agenda-card-title">
                            <small>OS-{order.number}{overdue ? " · ATRASADA" : ""}</small>
                            <b>{order.quotes?.company || order.quotes?.customer_name || "Cliente"}</b>
                            <p>{order.quotes?.service || order.title}</p>
                          </div>

                          {address && (
                            <div className="agenda-card-address" title={address}>
                              <MapPin />
                              <span>{address}</span>
                            </div>
                          )}

                          {order.site_notes && (
                            <p className="agenda-card-notes">{order.site_notes}</p>
                          )}

                          <div className="agenda-card-foot">
                            <span className="agenda-card-staff">
                              <UserRound />
                              {responsible || "A definir"}
                            </span>
                            <div className="agenda-card-actions" onClick={(event) => event.stopPropagation()}>
                              {address && (
                                <>
                                  <a
                                    href={googleMapsUrl(address)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Abrir no Google Maps"
                                  >
                                    <MapPin />
                                    Maps
                                  </a>
                                  <a
                                    href={wazeUrl(address)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Navegar no Waze"
                                  >
                                    <Navigation />
                                    Waze
                                  </a>
                                </>
                              )}
                              {order.quotes?.phone && (
                                <button
                                  type="button"
                                  title="Confirmar horário no WhatsApp"
                                  onClick={() => openConfirmWhatsApp(order)}
                                >
                                  <MessageCircle />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="agenda-month-wrap">
          <div className="agenda-month-weekdays">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="agenda-month-grid">
            {monthCells.map(({ date, iso, inCurrentMonth }) => {
              const dayOrders = ordersByDate.get(iso) ?? [];
              const isToday = iso === todayIso;
              const isOver = dragOverDate === iso;
              return (
                <div
                  key={iso}
                  className={`agenda-month-cell ${inCurrentMonth ? "" : "outside"} ${isToday ? "is-today" : ""} ${isOver ? "drag-over" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (dragOverDate !== iso) setDragOverDate(iso);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDragOverDate((cur) => (cur === iso ? null : cur));
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const droppedId = event.dataTransfer.getData("text/plain") || dragOrderId;
                    if (droppedId) void handleDropOnDate(iso, droppedId);
                  }}
                >
                  <header>
                    <strong>{date.getDate()}</strong>
                    {dayOrders.length > 0 && <span>{dayOrders.length}</span>}
                  </header>
                  <div className="agenda-month-items">
                    {dayOrders.slice(0, 4).map((order) => {
                      const mode = inferDeliveryMode(order);
                      const meta = deliveryModeMeta[mode];
                      return (
                        <button
                          key={order.id}
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            setDragOrderId(order.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", order.id);
                          }}
                          onDragEnd={() => {
                            setDragOrderId(null);
                            setDragOverDate(null);
                          }}
                          className={`agenda-month-chip ${meta.colorClass} ${order.stage === "concluido" ? "done" : ""}`}
                          onClick={() => onSelectOrder(order)}
                          title={`OS-${order.number} · ${order.quotes?.company || order.quotes?.customer_name || "Cliente"} · ${order.quotes?.service || order.title}`}
                        >
                          {order.scheduled_time && <em>{order.scheduled_time}</em>}
                          <b>OS-{order.number}</b>
                          <span>{order.quotes?.company || order.quotes?.customer_name || order.title}</span>
                        </button>
                      );
                    })}
                    {dayOrders.length > 4 && (
                      <button
                        type="button"
                        className="agenda-month-more"
                        onClick={() => {
                          setAnchorDate(date);
                          setCalendarMode("week");
                        }}
                      >
                        +{dayOrders.length - 4} no dia
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unscheduledOrders.length > 0 && (
        <section className="agenda-unscheduled">
          <header>
            <div>
              <small>PENDENTES DE AGENDAMENTO</small>
              <h3>Ordens ativas sem data de entrega / instalação</h3>
            </div>
            <span>{unscheduledOrders.length} OS sem data</span>
          </header>
          <div className="agenda-unscheduled-grid">
            {unscheduledOrders.map((order) => {
              const mode = inferDeliveryMode(order);
              const meta = deliveryModeMeta[mode];
              const address = resolveOrderAddress(order);
              return (
                <article key={order.id} className="agenda-unscheduled-card">
                  <div className="agenda-unscheduled-info" onClick={() => onSelectOrder(order)}>
                    <span className={`agenda-mode-badge ${meta.colorClass}`}>{meta.short}</span>
                    <b>OS-{order.number} · {order.quotes?.company || order.quotes?.customer_name || "Cliente"}</b>
                    <p>{order.quotes?.service || order.title}</p>
                    {address && <small><MapPin /> {address}</small>}
                  </div>
                  <div className="agenda-unscheduled-assign">
                    <Input
                      type="date"
                      value={quickDates[order.id] ?? todayIso}
                      onChange={(event) => setQuickDates((cur) => ({ ...cur, [order.id]: event.target.value }))}
                      aria-label={`Definir data para OS-${order.number}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={schedulingId === order.id}
                      onClick={() => void handleQuickSchedule(order.id)}
                    >
                      <PackageCheck />
                      Agendar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onSelectOrder(order)} title="Abrir OS completa">
                      <ExternalLink />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
