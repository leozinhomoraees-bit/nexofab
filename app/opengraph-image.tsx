import { ImageResponse } from "next/og";

export const alt = "NexoFab — Gestão para comunicação visual e fabricação";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const highlights = [
  "Orçamentos e precificação real",
  "Plano de corte e produção",
  "Portal público /p/sua-empresa",
  "Financeiro e ponto de equilíbrio",
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #07131e 0%, #0b2630 55%, #0f3836 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <span style={{ color: "#c6f054" }}>Nexo</span>
            <span style={{ color: "#ffffff" }}>Fab</span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(198,240,84,0.4)",
              background: "rgba(198,240,84,0.14)",
              color: "#c6f054",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            7 dias grátis · Sem cartão
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 960 }}>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#ffffff",
            }}
          >
            Do orçamento técnico ao caixa realizado no mesmo sistema.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.4,
              color: "#b7ced1",
            }}
          >
            Gestão completa para comunicação visual, marcenaria CNC, corte a laser, grandes formatos e fabricação sob medida.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 820 }}>
            {highlights.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#e6f2f1",
                  fontSize: 19,
                  fontWeight: 600,
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 18, color: "#9eb8bc" }}>Plano Completo</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: "#c6f054" }}>A partir de R$ 20/mês</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
