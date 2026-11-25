import type { SpecialProjectKind } from "./special-project-engine";

export type GuidedProjectOption = {
  kind: SpecialProjectKind;
  label: string;
  shortLabel: string;
  category: "Impressão & Adesivos" | "Placas, Fachadas & Estruturas" | "Laser, CNC, Acrílico & 3D";
};

export const guidedProjectOptions: GuidedProjectOption[] = [
  // Impressão & Adesivos
  { kind: "banner", label: "Banner — lona + acabamento completo", shortLabel: "Banner", category: "Impressão & Adesivos" },
  { kind: "faixa", label: "Faixa — lona + acabamento completo", shortLabel: "Faixa", category: "Impressão & Adesivos" },
  { kind: "lona_backdrop", label: "Lona backdrop — ilhós ou outro acabamento", shortLabel: "Lona backdrop", category: "Impressão & Adesivos" },
  { kind: "adesivo_impresso", label: "Adesivo impresso", shortLabel: "Adesivo impresso", category: "Impressão & Adesivos" },
  { kind: "adesivo_impresso_recorte", label: "Adesivo impresso com recorte", shortLabel: "Adesivo c/ recorte", category: "Impressão & Adesivos" },
  { kind: "adesivo_cor", label: "Adesivo na cor — liso ou com recorte", shortLabel: "Adesivo de cor", category: "Impressão & Adesivos" },
  { kind: "envelopamento", label: "Plotagem / envelopamento de veículo", shortLabel: "Envelopamento", category: "Impressão & Adesivos" },
  { kind: "impressao_rapida", label: "Impressão rápida em papel", shortLabel: "Impressão em papel", category: "Impressão & Adesivos" },

  // Placas, Fachadas & Estruturas
  { kind: "placa_adesivada", label: "Placa adesivada — chapa + adesivo", shortLabel: "Placa adesivada", category: "Placas, Fachadas & Estruturas" },
  { kind: "placa_aplique", label: "Placa com aplique — base + uma ou mais camadas", shortLabel: "Placa com aplique", category: "Placas, Fachadas & Estruturas" },
  { kind: "placa_acm_letra_caixa", label: "Placa de ACM com letras em PVC ou 3D", shortLabel: "ACM + letra caixa", category: "Placas, Fachadas & Estruturas" },
  { kind: "letra_caixa", label: "Letra-caixa (maciça, com retorno ou LED)", shortLabel: "Letra-caixa", category: "Placas, Fachadas & Estruturas" },
  { kind: "estrutura_lona", label: "Estrutura revestida — lona, ACM ou galvanizado", shortLabel: "Estrutura revestida", category: "Placas, Fachadas & Estruturas" },
  { kind: "totem", label: "Totem — estrutura, faces, base e elétrica", shortLabel: "Totem", category: "Placas, Fachadas & Estruturas" },
  { kind: "neon_led", label: "Neon LED 2ª geração — base, mangueira e fonte", shortLabel: "Neon LED", category: "Placas, Fachadas & Estruturas" },

  // Laser, CNC, Acrílico & 3D
  { kind: "gravacao_laser", label: "Gravação a laser — copos e objetos", shortLabel: "Gravação a laser", category: "Laser, CNC, Acrílico & 3D" },
  { kind: "caixa_expositor", label: "Caixas e expositores — MDF, acrílico ou PVC", shortLabel: "Caixas e expositores", category: "Laser, CNC, Acrílico & 3D" },
  { kind: "medalha", label: "Medalhas personalizadas", shortLabel: "Medalhas", category: "Laser, CNC, Acrílico & 3D" },
  { kind: "impressao_3d", label: "Impressão 3D — peso, filamento e tempo", shortLabel: "Impressão 3D", category: "Laser, CNC, Acrílico & 3D" },
];

export const guidedProjectKindsSet = new Set<string>(guidedProjectOptions.map((item) => item.kind));

export const guidedProjectPresets: Array<{ id: string; label: string; enabled: SpecialProjectKind[] }> = [
  {
    id: "all",
    label: "Mostrar todos (19)",
    enabled: guidedProjectOptions.map((item) => item.kind),
  },
  {
    id: "comunicacao_visual",
    label: "Comunicação Visual",
    enabled: [
      "banner",
      "faixa",
      "lona_backdrop",
      "adesivo_impresso",
      "adesivo_impresso_recorte",
      "adesivo_cor",
      "placa_adesivada",
      "placa_aplique",
      "placa_acm_letra_caixa",
      "letra_caixa",
      "estrutura_lona",
      "totem",
      "neon_led",
    ],
  },
  {
    id: "laser_cnc",
    label: "Laser, Acrílico & Troféus",
    enabled: [
      "gravacao_laser",
      "placa_aplique",
      "caixa_expositor",
      "letra_caixa",
      "neon_led",
      "medalha",
      "impressao_3d",
    ],
  },
  {
    id: "grafica_rapida",
    label: "Gráfica Rápida & Adesivos",
    enabled: [
      "banner",
      "faixa",
      "adesivo_impresso",
      "adesivo_impresso_recorte",
      "adesivo_cor",
      "impressao_rapida",
      "placa_adesivada",
    ],
  },
];
