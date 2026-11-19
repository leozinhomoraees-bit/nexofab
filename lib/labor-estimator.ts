export type LaborEstimateInput = {
  kind: string;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  quantity?: number;
  description?: string;
  material?: string;
  letterCount?: number;
  neonLengthM?: number;
  printTimeHours?: number;
  faces?: number;
  doubleFrame?: boolean;
  painted?: boolean;
  illuminated?: boolean;
  installationIncluded?: boolean;
  complexityFactor?: number;
  cutIncluded?: boolean;
};

export type LaborEstimate = { minutes: number; explanation: string; factors: string[] };

const positive = (value: number | undefined, fallback = 0) => Math.max(0, Number(value ?? fallback));
const roundedFive = (value: number) => Math.max(5, Math.ceil(value / 5) * 5);

export function estimateLabor(input: LaborEstimateInput): LaborEstimate {
  const quantity = Math.max(1, positive(input.quantity, 1));
  const widthM = positive(input.widthMm) / 1000;
  const heightM = positive(input.heightMm) / 1000;
  const depthM = positive(input.depthMm) / 1000;
  const area = widthM * heightM * quantity;
  const perimeter = 2 * (widthM + heightM) * quantity;
  const text = `${input.description ?? ""} ${input.material ?? ""}`.toLocaleLowerCase("pt-BR");
  const factors: string[] = [];
  let minutes = 10;

  switch (input.kind) {
    case "banner":
      minutes = 10 + quantity * 5 + area * 6;
      factors.push(`${area.toFixed(2)} m² de lona`, "refile, madeiras, ponteiras e corda");
      break;
    case "faixa":
      minutes = 12 + quantity * 6 + area * 7;
      factors.push(`${area.toFixed(2)} m² de lona`, "refile e acabamento nas laterais");
      break;
    case "lona_backdrop":
      minutes = 12 + quantity * 5 + area * 7 + perimeter * 1.5;
      factors.push(`${area.toFixed(2)} m² de lona`, `${perimeter.toFixed(1)} m de perímetro`, "refile e acabamento do backdrop");
      break;
    case "adesivo_impresso":
      minutes = 8 + quantity * 2 + area * 5;
      factors.push(`${area.toFixed(2)} m² impressos`, "refile e conferência");
      break;
    case "adesivo_impresso_recorte":
      minutes = 15 + quantity * 3 + area * 12;
      factors.push(`${area.toFixed(2)} m² impressos`, "recorte, depilação e máscara");
      break;
    case "adesivo_cor":
      minutes = input.cutIncluded ? 8 + quantity * 2 + area * 10 : 5 + quantity + area * 3;
      factors.push(`${area.toFixed(2)} m² de adesivo na cor`, input.cutIncluded ? "recorte, depilação e máscara" : "refile e separação");
      break;
    case "gravacao_laser":
      minutes = 12 + quantity * 2.5;
      factors.push(`${quantity} objeto(s)`, "posicionamento, foco, limpeza e conferência");
      break;
    case "placa_adesivada":
      minutes = 8 + Math.ceil(quantity / 10) * 4 + area * 15;
      factors.push(`${area.toFixed(2)} m² de preparação e aplicação`, `${quantity} placa(s) processadas em ${Math.ceil(quantity / 10)} lote(s)`);
      break;
    case "placa_aplique":
      minutes = 15 + quantity * 6 + area * 24;
      factors.push("posicionamento, colagem e acabamento das camadas", `${area.toFixed(2)} m² de base`);
      break;
    case "caixa_expositor":
      minutes = 25 + quantity * 12 + area * 25 + depthM * quantity * 18;
      factors.push(`${quantity} caixa(s)/expositor(es)`, "separação dos painéis, esquadro, colagem e acabamento");
      break;
    case "estrutura_lona":
      minutes = 35 + perimeter * 10 + area * 10 + (input.doubleFrame ? 35 : 0) + (input.painted ? 25 : 0);
      factors.push(`${perimeter.toFixed(1)} m de perímetro estrutural`, `${area.toFixed(2)} m² de revestimento`);
      if (input.doubleFrame) factors.push("estrutura dupla");
      if (input.painted) factors.push("preparação para pintura");
      break;
    case "totem":
      minutes = 65 + perimeter * 14 + area * 20 * Math.max(1, positive(input.faces, 2)) + depthM * 45 + (input.painted ? 35 : 0) + (input.illuminated ? 45 : 0);
      factors.push("montagem e esquadro da estrutura", `${input.faces || 2} face(s)`, `${area.toFixed(2)} m² por face`);
      if (input.painted) factors.push("preparação para pintura");
      if (input.illuminated) factors.push("montagem elétrica");
      break;
    case "letra_caixa": {
      const letters = Math.max(1, positive(input.letterCount, quantity));
      minutes = 25 + letters * (input.illuminated ? 8 : 5) + area * 12 + (input.painted ? 20 : 0);
      factors.push(`${letters} letra(s)`, input.illuminated ? "montagem e teste dos LEDs" : "montagem e acabamento");
      break;
    }
    case "placa_acm_letra_caixa": {
      const letters = Math.max(1, positive(input.letterCount, 1));
      minutes = 35 + area * 15 + letters * (input.illuminated ? 7 : 4);
      factors.push("preparação da base de ACM", `${letters} letra(s)`);
      if (input.illuminated) factors.push("elétrica e teste");
      break;
    }
    case "neon_led":
      minutes = 25 + positive(input.neonLengthM) * 9 + area * 10;
      factors.push(`${positive(input.neonLengthM).toFixed(2)} m de mangueira`, "solda, colagem, elétrica e teste");
      break;
    case "impressao_3d":
      minutes = 12 + quantity * 5 + Math.min(positive(input.printTimeHours) * quantity * 1.5, 60);
      factors.push(`${quantity} peça(s)`, "preparação, retirada e pós-processamento básico");
      break;
    case "envelopamento":
      minutes = 20 + area * 38 * Math.max(1, positive(input.complexityFactor, 1));
      factors.push(`${area.toFixed(2)} m² de aplicação`, `complexidade ${positive(input.complexityFactor, 1).toFixed(1)}×`);
      break;
    case "impressao_rapida":
      minutes = 8 + Math.ceil(quantity / 100) * 4 + (area > 0 ? area * 2 : 0);
      factors.push(`${quantity} unidade(s)`, "acerto, conferência e acabamento básico");
      break;
    case "medalha":
      minutes = 15 + quantity * 1.2;
      factors.push(`${quantity} medalha(s)`, "limpeza, montagem e conferência");
      break;
    case "maquina_servico":
      minutes = 8 + quantity * 1.5;
      factors.push("recebimento, preparação e retirada do material", `${quantity} unidade(s)/chapa(s)`);
      break;
    default:
      if (/placa/.test(text) && /adesiv|vinil/.test(text)) {
        minutes = 8 + quantity * 3 + area * 15;
        factors.push(`${area.toFixed(2)} m² de placa adesivada`, `${quantity} unidade(s)`);
      } else if (/banner|faixa/.test(text)) {
        minutes = 8 + quantity * 4 + area * 6;
        factors.push(`${area.toFixed(2)} m²`, "refile e acabamento");
      } else if (/router|laser|corte/.test(text)) {
        minutes = 8 + quantity * 2 + area * 5;
        factors.push("preparação, posicionamento e retirada das peças");
      } else {
        minutes = 10 + quantity * 3 + area * 8;
        factors.push(`${quantity} unidade(s)`, area ? `${area.toFixed(2)} m²` : "preparação padrão");
      }
  }

  if (input.installationIncluded) { minutes += 15; factors.push("preparação para instalação"); }
  const result = roundedFive(minutes);
  return { minutes: result, explanation: `Sugestão inicial de ${result} min, editável após conferir o processo real.`, factors };
}
