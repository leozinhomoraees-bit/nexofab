"use client";

import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(".", ",")}k`;
  return `${sign}R$ ${Math.round(abs)}`;
};

export type CashSeriesPoint = {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
};

export function CashflowBarLineChart({
  data,
  emptyText = "Registre recebimentos e despesas pagas para visualizar a evolução financeira.",
}: {
  data: CashSeriesPoint[];
  emptyText?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const hasAny = data.some((d) => d.revenue > 0 || d.expenses > 0);

  if (!data.length || !hasAny) {
    return <div className="exec-chart-empty">{emptyText}</div>;
  }

  const width = 640;
  const height = 240;
  const pad = { top: 20, right: 18, bottom: 34, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.revenue, d.expenses, Math.max(d.profit, 0)]),
    1,
  );
  const ceiling = maxVal * 1.12;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: ceiling * ratio,
    y: pad.top + plotH * (1 - ratio),
  }));

  const stepX = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, Math.max(8, stepX * 0.28));
  const gap = Math.min(6, Math.max(2, barW * 0.2));

  const yOf = (val: number) => pad.top + plotH - (Math.max(val, 0) / ceiling) * plotH;

  const profitPoints = data.map((d, i) => {
    const cx = pad.left + stepX * i + stepX / 2;
    const clamped = Math.max(0, d.profit);
    return { cx, cy: yOf(clamped), value: d.profit };
  });
  const linePath = profitPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.cx.toFixed(1)} ${pt.cy.toFixed(1)}`).join(" ");

  const activePoint = hovered !== null ? data[hovered] : data[data.length - 1];

  return (
    <div className="exec-chart-wrap">
      <div className="exec-chart-readout">
        <div className="exec-chart-legend">
          <span><i className="dot rev" />Entradas</span>
          <span><i className="dot exp" />Saídas</span>
          <span><i className="dot prof" />Saldo</span>
        </div>
        {activePoint && (
          <div className="exec-chart-pill">
            <b>{activePoint.label}</b>
            <span className="rev">+{currency.format(activePoint.revenue)}</span>
            <span className="exp">−{currency.format(activePoint.expenses)}</span>
            <strong className={activePoint.profit < 0 ? "neg" : "pos"}>
              {activePoint.profit >= 0 ? "+" : ""}{currency.format(activePoint.profit)}
            </strong>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="exec-chart-svg"
        role="img"
        aria-label="Gráfico de entradas, saídas e saldo"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="nxfRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14a599" />
            <stop offset="100%" stopColor="#0b6f68" />
          </linearGradient>
          <linearGradient id="nxfExpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec7d63" />
            <stop offset="100%" stopColor="#d14f38" />
          </linearGradient>
        </defs>

        {ticks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={tick.y}
              y2={tick.y}
              stroke={idx === 0 ? "#cbd9dd" : "#e9f0f2"}
              strokeDasharray={idx === 0 ? undefined : "3 3"}
            />
            <text
              x={pad.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#6a8188"
              fontSize="10.5"
              fontWeight="600"
            >
              {compactCurrency(tick.value)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = pad.left + stepX * i + stepX / 2;
          const revH = (d.revenue / ceiling) * plotH;
          const expH = (d.expenses / ceiling) * plotH;
          const isActive = hovered === i;
          return (
            <g
              key={d.month}
              onMouseEnter={() => setHovered(i)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={pad.left + stepX * i + 2}
                y={pad.top}
                width={Math.max(stepX - 4, 8)}
                height={plotH}
                rx="8"
                fill={isActive ? "rgba(14, 139, 129, 0.07)" : "transparent"}
              />
              <rect
                x={cx - barW - gap / 2}
                y={pad.top + plotH - revH}
                width={barW}
                height={Math.max(revH, d.revenue > 0 ? 3 : 0)}
                rx="4"
                fill="url(#nxfRevGrad)"
                opacity={hovered === null || isActive ? 1 : 0.45}
              />
              <rect
                x={cx + gap / 2}
                y={pad.top + plotH - expH}
                width={barW}
                height={Math.max(expH, d.expenses > 0 ? 3 : 0)}
                rx="4"
                fill="url(#nxfExpGrad)"
                opacity={hovered === null || isActive ? 1 : 0.45}
              />
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                fill={isActive ? "#0d2630" : "#5e757c"}
                fontSize="11"
                fontWeight={isActive ? "800" : "600"}
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {data.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#081927"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {profitPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.cx}
            cy={pt.cy}
            r={hovered === i ? 5.5 : 3.8}
            fill={pt.value < 0 ? "#d14f38" : "#c6f054"}
            stroke="#081927"
            strokeWidth="2"
            style={{ pointerEvents: "none" }}
          />
        ))}
      </svg>
    </div>
  );
}

export type CommercialFunnelData = {
  totalCount: number;
  totalValue: number;
  negotiatingCount: number;
  negotiatingValue: number;
  approvedCount: number;
  approvedValue: number;
  convertedCount: number;
  convertedValue: number;
  conversionRate: number;
  averageTicket: number;
};

export function CommercialFunnelChart({ data }: { data: CommercialFunnelData }) {
  if (!data.totalCount) {
    return <div className="exec-chart-empty">Crie os primeiros orçamentos para acompanhar a conversão do funil.</div>;
  }

  const base = Math.max(data.totalCount, 1);
  const steps = [
    { key: "total", label: "Propostas criadas", count: data.totalCount, value: data.totalValue, pct: 100, tone: "slate" },
    { key: "negotiating", label: "Em negociação", count: data.negotiatingCount, value: data.negotiatingValue, pct: (data.negotiatingCount / base) * 100, tone: "blue" },
    { key: "approved", label: "Aprovadas / fechadas", count: data.approvedCount, value: data.approvedValue, pct: (data.approvedCount / base) * 100, tone: "teal" },
    { key: "converted", label: "Convertidas em OS", count: data.convertedCount, value: data.convertedValue, pct: (data.convertedCount / base) * 100, tone: "emerald" },
  ];

  return (
    <div className="exec-funnel">
      <div className="exec-funnel-kpis">
        <div>
          <small>TAXA DE CONVERSÃO</small>
          <b>{data.conversionRate.toFixed(1).replace(".", ",")}%</b>
        </div>
        <div>
          <small>TICKET MÉDIO FECHADO</small>
          <b>{currency.format(data.averageTicket)}</b>
        </div>
      </div>
      <div className="exec-funnel-bars">
        {steps.map((step) => (
          <div key={step.key} className="exec-funnel-row">
            <div className="exec-funnel-row-head">
              <span><b>{step.label}</b> · {step.count}</span>
              <strong>{currency.format(step.value)}</strong>
            </div>
            <div className="exec-funnel-track">
              <span
                className={`exec-funnel-fill ${step.tone}`}
                style={{ width: `${Math.max(step.count > 0 ? 6 : 0, Math.min(step.pct, 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const donutPalette = ["#0e8b81", "#143c52", "#e06c4b", "#d9981e", "#6e5bd6", "#31b4a6"];

export function DonutBreakdownChart({
  rows,
  emptyText = "Sem movimentações neste período.",
}: {
  rows: Array<{ name: string; total: number }>;
  emptyText?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const clean = rows.filter((r) => r.total > 0);
  const total = clean.reduce((sum, r) => sum + r.total, 0);

  if (!clean.length || total <= 0) {
    return <div className="exec-chart-empty">{emptyText}</div>;
  }

  const top = clean.slice(0, 5);
  const others = clean.slice(5).reduce((sum, r) => sum + r.total, 0);
  const slices = others > 0 ? [...top, { name: "Outros", total: others }] : top;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.reduce<Array<{ name: string; total: number; pct: number; color: string; dash: number; offset: number }>>((acc, slice, index) => {
    const prevSum = acc.reduce((sum, item) => sum + item.total, 0);
    const ratio = slice.total / total;
    const dash = ratio * circumference;
    const offset = -(prevSum / total) * circumference;
    acc.push({
      name: slice.name,
      total: slice.total,
      pct: ratio * 100,
      color: donutPalette[index % donutPalette.length],
      dash,
      offset,
    });
    return acc;
  }, []);

  const current = activeIndex !== null ? segments[activeIndex] : null;

  return (
    <div className="exec-donut-wrap">
      <div className="exec-donut-ring">
        <svg viewBox="0 0 148 148" role="img" aria-label="Distribuição por categoria">
          <circle cx="74" cy="74" r={radius} fill="none" stroke="#ebf1f3" strokeWidth="18" />
          <g transform="rotate(-90 74 74)">
            {segments.map((seg, idx) => (
              <circle
                key={seg.name}
                cx="74"
                cy="74"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={activeIndex === idx ? 21 : 18}
                strokeDasharray={`${Math.max(seg.dash - 1.5, 1)} ${circumference}`}
                strokeDashoffset={seg.offset}
                opacity={activeIndex === null || activeIndex === idx ? 1 : 0.35}
                style={{ cursor: "pointer", transition: "stroke-width 0.15s ease, opacity 0.15s ease" }}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              />
            ))}
          </g>
        </svg>
        <div className="exec-donut-center">
          <small>{current ? `${current.pct.toFixed(0)}%` : "TOTAL"}</small>
          <b>{compactCurrency(current ? current.total : total)}</b>
        </div>
      </div>

      <div className="exec-donut-legend">
        {segments.map((seg, idx) => (
          <button
            key={seg.name}
            type="button"
            className={activeIndex === idx ? "active" : ""}
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <i style={{ background: seg.color }} />
            <span>{seg.name}</span>
            <b>{currency.format(seg.total)}</b>
            <small>{seg.pct.toFixed(0)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CashForecastAreaChart({
  data,
}: {
  data: Array<{ date: string; receivable: number; payable: number; balance: number; accumulated: number }>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data.length) {
    return <div className="exec-chart-empty">Nenhum vencimento futuro programado neste período.</div>;
  }

  const width = 620;
  const height = 200;
  const pad = { top: 18, right: 18, bottom: 30, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const vals = data.map((d) => d.accumulated);
  const minVal = Math.min(...vals, 0);
  const maxVal = Math.max(...vals, 1);
  const span = Math.max(maxVal - minVal, 1);
  const yOf = (val: number) => pad.top + plotH - ((val - minVal) / span) * plotH;
  const zeroY = yOf(0);

  const pts = data.map((d, i) => ({
    x: data.length === 1 ? pad.left + plotW / 2 : pad.left + (plotW / (data.length - 1)) * i,
    y: yOf(d.accumulated),
    row: d,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
  const active = hovered !== null ? data[hovered] : data[data.length - 1];
  const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return (
    <div className="exec-chart-wrap">
      {active && (
        <div className="exec-chart-readout">
          <div className="exec-chart-legend">
            <span><i className="dot rev" />Saldo acumulado projetado</span>
          </div>
          <div className="exec-chart-pill">
            <b>{shortDate(active.date)}</b>
            <span className="rev">+{currency.format(active.receivable)}</span>
            <span className="exp">−{currency.format(active.payable)}</span>
            <strong className={active.accumulated < 0 ? "neg" : "pos"}>{currency.format(active.accumulated)}</strong>
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="exec-chart-svg"
        role="img"
        aria-label="Fluxo de caixa acumulado projetado"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="nxfAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14a599" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#14a599" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={pad.left} x2={width - pad.right} y1={zeroY} y2={zeroY} stroke="#b8cbd1" strokeDasharray="4 4" />
        <text x={pad.left - 8} y={pad.top + 4} textAnchor="end" fill="#6a8188" fontSize="10.5" fontWeight="600">
          {compactCurrency(maxVal)}
        </text>
        <text x={pad.left - 8} y={zeroY + 4} textAnchor="end" fill="#6a8188" fontSize="10.5" fontWeight="600">
          R$ 0
        </text>
        {minVal < 0 && (
          <text x={pad.left - 8} y={height - pad.bottom} textAnchor="end" fill="#c74b36" fontSize="10.5" fontWeight="600">
            {compactCurrency(minVal)}
          </text>
        )}
        {pts.length > 1 && <path d={area} fill="url(#nxfAreaGrad)" />}
        {pts.length > 1 && <path d={line} fill="none" stroke="#0d857b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((pt, idx) => (
          <g key={pt.row.date} onMouseEnter={() => setHovered(idx)} style={{ cursor: "pointer" }}>
            <circle cx={pt.x} cy={pt.y} r="12" fill="transparent" />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hovered === idx ? 5.5 : 3.6}
              fill={pt.row.accumulated < 0 ? "#d14f38" : "#0e8b81"}
              stroke="#ffffff"
              strokeWidth="2"
            />
            {(idx === 0 || idx === pts.length - 1 || idx === hovered || (pts.length <= 8)) && (
              <text x={pt.x} y={height - 8} textAnchor="middle" fill="#60787f" fontSize="10.5" fontWeight="600">
                {shortDate(pt.row.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
