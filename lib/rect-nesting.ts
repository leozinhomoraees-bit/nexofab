export type RectPieceInput = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
};

export type PlacedRect = {
  pieceId: string;
  label: string;
  colorIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  rotated: boolean;
};

export type NestedSheet = {
  index: number;
  widthMm: number;
  heightMm: number;
  usedAreaMm2: number;
  utilizationPercent: number;
  placements: PlacedRect[];
};

export type RectNestingResult = {
  mode: "chapa" | "bobina";
  sheets: NestedSheet[];
  totalSheets: number;
  linearMeters: number;
  totalPiecesRequested: number;
  totalPiecesPlaced: number;
  unplacedLabels: string[];
  usedAreaM2: number;
  purchasedAreaM2: number;
  utilizationPercent: number;
  wastePercent: number;
};

type FreeRect = { x: number; y: number; width: number; height: number };

type ExpandedItem = {
  pieceId: string;
  label: string;
  colorIndex: number;
  width: number;
  height: number;
};

function intersect(a: FreeRect, b: FreeRect) {
  return !(b.x >= a.x + a.width || b.x + b.width <= a.x || b.y >= a.y + a.height || b.y + b.height <= a.y);
}

function isContained(a: FreeRect, b: FreeRect) {
  return a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
}

function splitFreeRects(freeRects: FreeRect[], used: FreeRect): FreeRect[] {
  const next: FreeRect[] = [];
  for (const rect of freeRects) {
    if (!intersect(rect, used)) {
      next.push(rect);
      continue;
    }
    if (used.x > rect.x && used.x < rect.x + rect.width) {
      next.push({ x: rect.x, y: rect.y, width: used.x - rect.x, height: rect.height });
    }
    if (used.x + used.width < rect.x + rect.width) {
      next.push({
        x: used.x + used.width,
        y: rect.y,
        width: rect.x + rect.width - (used.x + used.width),
        height: rect.height,
      });
    }
    if (used.y > rect.y && used.y < rect.y + rect.height) {
      next.push({ x: rect.x, y: rect.y, width: rect.width, height: used.y - rect.y });
    }
    if (used.y + used.height < rect.y + rect.height) {
      next.push({
        x: rect.x,
        y: used.y + used.height,
        width: rect.width,
        height: rect.y + rect.height - (used.y + used.height),
      });
    }
  }
  // Remove rectangles fully contained inside another free rectangle
  return next.filter((rect, i) => {
    if (rect.width <= 0.5 || rect.height <= 0.5) return false;
    for (let j = 0; j < next.length; j += 1) {
      if (i !== j && isContained(rect, next[j])) return false;
    }
    return true;
  });
}

function packIntoBin(
  items: ExpandedItem[],
  usableW: number,
  usableH: number,
  spacing: number,
  allowRotation: boolean,
  preferMinimizeHeight: boolean,
): { placed: PlacedRect[]; remaining: ExpandedItem[]; maxUsedY: number } {
  let freeRects: FreeRect[] = [{ x: 0, y: 0, width: usableW, height: usableH }];
  const placed: PlacedRect[] = [];
  const remaining: ExpandedItem[] = [];
  let maxUsedY = 0;

  for (const item of items) {
    let bestRect: { x: number; y: number; w: number; h: number; rotated: boolean; score1: number; score2: number } | null = null;
    const candidates = allowRotation && Math.abs(item.width - item.height) > 0.1
      ? [
          { w: item.width, h: item.height, rotated: false },
          { w: item.height, h: item.width, rotated: true },
        ]
      : [{ w: item.width, h: item.height, rotated: false }];

    for (const free of freeRects) {
      for (const cand of candidates) {
        if (cand.w <= free.width + 0.01 && cand.h <= free.height + 0.01) {
          const leftoverX = free.width - cand.w;
          const leftoverY = free.height - cand.h;
          const score1 = preferMinimizeHeight ? free.y + cand.h : Math.min(leftoverX, leftoverY);
          const score2 = preferMinimizeHeight ? free.x : Math.max(leftoverX, leftoverY);
          if (
            !bestRect
            || score1 < bestRect.score1 - 0.01
            || (Math.abs(score1 - bestRect.score1) <= 0.01 && score2 < bestRect.score2)
          ) {
            bestRect = { x: free.x, y: free.y, w: cand.w, h: cand.h, rotated: cand.rotated, score1, score2 };
          }
        }
      }
    }

    if (!bestRect) {
      remaining.push(item);
      continue;
    }

    placed.push({
      pieceId: item.pieceId,
      label: item.label,
      colorIndex: item.colorIndex,
      x: bestRect.x,
      y: bestRect.y,
      width: bestRect.w,
      height: bestRect.h,
      origWidth: item.width,
      origHeight: item.height,
      rotated: bestRect.rotated,
    });
    maxUsedY = Math.max(maxUsedY, bestRect.y + bestRect.h);

    const occupied: FreeRect = {
      x: bestRect.x,
      y: bestRect.y,
      width: Math.min(usableW - bestRect.x, bestRect.w + spacing),
      height: Math.min(usableH - bestRect.y, bestRect.h + spacing),
    };
    freeRects = splitFreeRects(freeRects, occupied);
  }

  return { placed, remaining, maxUsedY };
}

export function computeRectNesting({
  mode,
  sheetWidthMm,
  sheetHeightMm,
  marginMm,
  spacingMm,
  allowRotation,
  pieces,
}: {
  mode: "chapa" | "bobina";
  sheetWidthMm: number;
  sheetHeightMm: number;
  marginMm: number;
  spacingMm: number;
  allowRotation: boolean;
  pieces: RectPieceInput[];
}): RectNestingResult {
  const safeMargin = Math.max(0, marginMm);
  const safeSpacing = Math.max(0, spacingMm);
  const usableW = Math.max(1, sheetWidthMm - safeMargin * 2);
  const usableH = mode === "bobina" ? 500_000 : Math.max(1, sheetHeightMm - safeMargin * 2);

  const expanded: ExpandedItem[] = [];
  const unplacedLabels: string[] = [];

  pieces.forEach((piece, index) => {
    const qty = Math.min(500, Math.max(0, Math.floor(piece.quantity)));
    if (qty <= 0 || piece.widthMm <= 0 || piece.heightMm <= 0) return;
    const fitsNormal = piece.widthMm <= usableW + 0.01 && piece.heightMm <= usableH + 0.01;
    const fitsRotated = allowRotation && piece.heightMm <= usableW + 0.01 && piece.widthMm <= usableH + 0.01;
    if (!fitsNormal && !fitsRotated) {
      unplacedLabels.push(piece.label || `Peça ${index + 1}`);
      return;
    }
    for (let i = 0; i < qty; i += 1) {
      expanded.push({
        pieceId: piece.id,
        label: piece.label || `Peça ${index + 1}`,
        colorIndex: index % 6,
        width: piece.widthMm,
        height: piece.heightMm,
      });
    }
  });

  // Sort largest area / longest side first for higher packing density
  expanded.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height);

  const totalPiecesRequested = pieces.reduce((sum, p) => sum + Math.max(0, Math.floor(p.quantity)), 0);
  const sheets: NestedSheet[] = [];

  if (mode === "bobina") {
    const { placed, maxUsedY } = packIntoBin(expanded, usableW, usableH, safeSpacing, allowRotation, true);
    const totalLengthMm = placed.length > 0 ? maxUsedY + safeMargin * 2 : 0;
    const usedAreaMm2 = placed.reduce((sum, p) => sum + p.width * p.height, 0);
    const purchasedAreaMm2 = sheetWidthMm * totalLengthMm;
    if (placed.length > 0) {
      sheets.push({
        index: 1,
        widthMm: sheetWidthMm,
        heightMm: totalLengthMm,
        usedAreaMm2,
        utilizationPercent: purchasedAreaMm2 > 0 ? (usedAreaMm2 / purchasedAreaMm2) * 100 : 0,
        placements: placed.map((p) => ({ ...p, x: p.x + safeMargin, y: p.y + safeMargin })),
      });
    }
    const usedAreaM2 = usedAreaMm2 / 1_000_000;
    const purchasedAreaM2 = purchasedAreaMm2 / 1_000_000;
    const utilizationPercent = purchasedAreaM2 > 0 ? (usedAreaM2 / purchasedAreaM2) * 100 : 0;
    return {
      mode,
      sheets,
      totalSheets: sheets.length,
      linearMeters: totalLengthMm / 1000,
      totalPiecesRequested,
      totalPiecesPlaced: placed.length,
      unplacedLabels,
      usedAreaM2,
      purchasedAreaM2,
      utilizationPercent,
      wastePercent: Math.max(0, 100 - utilizationPercent),
    };
  }

  let pending = expanded;
  let guard = 0;
  while (pending.length > 0 && guard < 60) {
    guard += 1;
    const { placed, remaining } = packIntoBin(pending, usableW, usableH, safeSpacing, allowRotation, false);
    if (!placed.length) break;
    const usedAreaMm2 = placed.reduce((sum, p) => sum + p.width * p.height, 0);
    const sheetAreaMm2 = sheetWidthMm * sheetHeightMm;
    sheets.push({
      index: sheets.length + 1,
      widthMm: sheetWidthMm,
      heightMm: sheetHeightMm,
      usedAreaMm2,
      utilizationPercent: sheetAreaMm2 > 0 ? (usedAreaMm2 / sheetAreaMm2) * 100 : 0,
      placements: placed.map((p) => ({ ...p, x: p.x + safeMargin, y: p.y + safeMargin })),
    });
    pending = remaining;
  }

  const totalPiecesPlaced = sheets.reduce((sum, s) => sum + s.placements.length, 0);
  const usedAreaM2 = sheets.reduce((sum, s) => sum + s.usedAreaMm2, 0) / 1_000_000;
  const purchasedAreaM2 = (sheets.length * sheetWidthMm * sheetHeightMm) / 1_000_000;
  const utilizationPercent = purchasedAreaM2 > 0 ? (usedAreaM2 / purchasedAreaM2) * 100 : 0;

  return {
    mode,
    sheets,
    totalSheets: sheets.length,
    linearMeters: 0,
    totalPiecesRequested,
    totalPiecesPlaced,
    unplacedLabels,
    usedAreaM2,
    purchasedAreaM2,
    utilizationPercent,
    wastePercent: Math.max(0, 100 - utilizationPercent),
  };
}
