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
  usedWidthMm: number;
  usedHeightMm: number;
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

type PackStrategy = "waterline-layers" | "top-left-horizontal" | "shelf-layers";

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

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
  return next.filter((rect, i) => {
    if (rect.width <= 0.5 || rect.height <= 0.5) return false;
    for (let j = 0; j < next.length; j += 1) {
      if (i !== j && isContained(rect, next[j])) return false;
    }
    return true;
  });
}

function getOrientations(item: ExpandedItem, allowRotation: boolean) {
  if (!allowRotation || Math.abs(item.width - item.height) <= 0.1) {
    return [{ w: item.width, h: item.height, rotated: false }];
  }
  // Prefer horizontal orientation (wider than tall) first so layers stay shallow across the sheet width
  const normal = { w: item.width, h: item.height, rotated: false };
  const rotated = { w: item.height, h: item.width, rotated: true };
  return item.width >= item.height ? [normal, rotated] : [rotated, normal];
}

function packMaxRectsHorizontal(
  items: ExpandedItem[],
  usableW: number,
  usableH: number,
  spacing: number,
  allowRotation: boolean,
  strategy: "waterline-layers" | "top-left-horizontal",
): { placed: PlacedRect[]; remaining: ExpandedItem[]; maxUsedY: number; maxUsedX: number } {
  let freeRects: FreeRect[] = [{ x: 0, y: 0, width: usableW, height: usableH }];
  const placed: PlacedRect[] = [];
  const remaining: ExpandedItem[] = [];
  let maxUsedY = 0;
  let maxUsedX = 0;

  for (const item of items) {
    let best: {
      x: number;
      y: number;
      w: number;
      h: number;
      rotated: boolean;
      s1: number;
      s2: number;
      s3: number;
      s4: number;
    } | null = null;

    const candidates = getOrientations(item, allowRotation);

    for (const free of freeRects) {
      for (const cand of candidates) {
        if (cand.w > free.width + 0.01 || cand.h > free.height + 0.01) continue;
        const bottom = free.y + cand.h;
        const newWaterline = Math.max(maxUsedY, bottom);
        const horizontalBias = cand.w >= cand.h ? 0 : 1;

        // waterline-layers: strictly fills open horizontal layers above current waterline before pushing downward;
        // when opening a new layer below, prefers the shallowest (horizontal) orientation first.
        // top-left-horizontal: strictly minimizes bottom edge (y + h), then top edge (y), then left edge (x).
        const s1 = strategy === "waterline-layers" ? newWaterline : bottom;
        const s2 = strategy === "waterline-layers" ? free.y : free.y;
        const s3 = strategy === "waterline-layers" ? bottom : free.x;
        const s4 = strategy === "waterline-layers" ? free.x + horizontalBias * 0.5 : horizontalBias;

        if (
          !best
          || s1 < best.s1 - 0.05
          || (Math.abs(s1 - best.s1) <= 0.05 && s2 < best.s2 - 0.05)
          || (Math.abs(s1 - best.s1) <= 0.05 && Math.abs(s2 - best.s2) <= 0.05 && s3 < best.s3 - 0.05)
          || (
            Math.abs(s1 - best.s1) <= 0.05
            && Math.abs(s2 - best.s2) <= 0.05
            && Math.abs(s3 - best.s3) <= 0.05
            && s4 < best.s4 - 0.05
          )
        ) {
          best = { x: free.x, y: free.y, w: cand.w, h: cand.h, rotated: cand.rotated, s1, s2, s3, s4 };
        }
      }
    }

    if (!best) {
      remaining.push(item);
      continue;
    }

    placed.push({
      pieceId: item.pieceId,
      label: item.label,
      colorIndex: item.colorIndex,
      x: best.x,
      y: best.y,
      width: best.w,
      height: best.h,
      origWidth: item.width,
      origHeight: item.height,
      rotated: best.rotated,
    });
    maxUsedY = Math.max(maxUsedY, best.y + best.h);
    maxUsedX = Math.max(maxUsedX, best.x + best.w);

    const ox1 = Math.max(0, best.x - spacing);
    const oy1 = Math.max(0, best.y - spacing);
    const ox2 = Math.min(usableW, best.x + best.w + spacing);
    const oy2 = Math.min(usableH, best.y + best.h + spacing);
    const occupied: FreeRect = {
      x: ox1,
      y: oy1,
      width: ox2 - ox1,
      height: oy2 - oy1,
    };
    freeRects = splitFreeRects(freeRects, occupied);
  }

  return { placed, remaining, maxUsedY, maxUsedX };
}

type ShelfBand = {
  y: number;
  height: number;
  freeRects: FreeRect[];
};

/**
 * Packs pieces in true horizontal guillotine bands ("camadas"):
 * each band spans the full usable width of the sheet, and pieces inside a band can
 * sub-stack within that band's free pockets without ever protruding downward.
 */
function packShelfLayers(
  items: ExpandedItem[],
  usableW: number,
  usableH: number,
  spacing: number,
  allowRotation: boolean,
): { placed: PlacedRect[]; remaining: ExpandedItem[]; maxUsedY: number; maxUsedX: number } {
  const shelves: ShelfBand[] = [];
  const placed: PlacedRect[] = [];
  const remaining: ExpandedItem[] = [];
  let nextShelfY = 0;
  let maxUsedY = 0;
  let maxUsedX = 0;

  for (const item of items) {
    const candidates = getOrientations(item, allowRotation);
    let bestInShelf: {
      shelfIdx: number;
      x: number;
      y: number;
      w: number;
      h: number;
      rotated: boolean;
      score: number;
    } | null = null;

    // 1) Try fitting inside any already-opened horizontal layer without increasing total height
    for (let sIdx = 0; sIdx < shelves.length; sIdx += 1) {
      const shelf = shelves[sIdx];
      for (const free of shelf.freeRects) {
        for (const cand of candidates) {
          if (cand.w > free.width + 0.01 || cand.h > free.height + 0.01) continue;
          const heightWaste = shelf.height - (free.y - shelf.y + cand.h);
          const score = shelf.y * 0.25 + heightWaste + free.x * 0.01;
          if (!bestInShelf || score < bestInShelf.score - 0.01) {
            bestInShelf = { shelfIdx: sIdx, x: free.x, y: free.y, w: cand.w, h: cand.h, rotated: cand.rotated, score };
          }
        }
      }
    }

    if (bestInShelf) {
      const shelf = shelves[bestInShelf.shelfIdx];
      placed.push({
        pieceId: item.pieceId,
        label: item.label,
        colorIndex: item.colorIndex,
        x: bestInShelf.x,
        y: bestInShelf.y,
        width: bestInShelf.w,
        height: bestInShelf.h,
        origWidth: item.width,
        origHeight: item.height,
        rotated: bestInShelf.rotated,
      });
      maxUsedY = Math.max(maxUsedY, bestInShelf.y + bestInShelf.h);
      maxUsedX = Math.max(maxUsedX, bestInShelf.x + bestInShelf.w);
      const ox1 = Math.max(0, bestInShelf.x - spacing);
      const oy1 = Math.max(shelf.y, bestInShelf.y - spacing);
      const ox2 = Math.min(usableW, bestInShelf.x + bestInShelf.w + spacing);
      const oy2 = Math.min(shelf.y + shelf.height, bestInShelf.y + bestInShelf.h + spacing);
      const occupied: FreeRect = {
        x: ox1,
        y: oy1,
        width: ox2 - ox1,
        height: oy2 - oy1,
      };
      shelf.freeRects = splitFreeRects(shelf.freeRects, occupied);
      continue;
    }

    // 2) Open a new horizontal layer below the previous layers (preferring shallow horizontal orientation)
    let bestNew: { w: number; h: number; rotated: boolean } | null = null;
    for (const cand of candidates) {
      if (cand.w > usableW + 0.01 || nextShelfY + cand.h > usableH + 0.01) continue;
      if (!bestNew || cand.h < bestNew.h - 0.01) {
        bestNew = cand;
      }
    }

    if (!bestNew) {
      remaining.push(item);
      continue;
    }

    const shelfY = nextShelfY;
    const shelfHeight = bestNew.h;
    const initialFree: FreeRect[] = [{ x: 0, y: shelfY, width: usableW, height: shelfHeight }];
    const occupied: FreeRect = {
      x: 0,
      y: shelfY,
      width: Math.min(usableW, bestNew.w + spacing),
      height: shelfHeight,
    };
    shelves.push({
      y: shelfY,
      height: shelfHeight,
      freeRects: splitFreeRects(initialFree, occupied),
    });
    nextShelfY = shelfY + shelfHeight + spacing;

    placed.push({
      pieceId: item.pieceId,
      label: item.label,
      colorIndex: item.colorIndex,
      x: 0,
      y: shelfY,
      width: bestNew.w,
      height: bestNew.h,
      origWidth: item.width,
      origHeight: item.height,
      rotated: bestNew.rotated,
    });
    maxUsedY = Math.max(maxUsedY, shelfY + bestNew.h);
    maxUsedX = Math.max(maxUsedX, bestNew.w);
  }

  return { placed, remaining, maxUsedY, maxUsedX };
}

function runBinStrategy(
  items: ExpandedItem[],
  usableW: number,
  usableH: number,
  spacing: number,
  allowRotation: boolean,
  strategy: PackStrategy,
) {
  if (strategy === "shelf-layers") {
    return packShelfLayers(items, usableW, usableH, spacing, allowRotation);
  }
  return packMaxRectsHorizontal(items, usableW, usableH, spacing, allowRotation, strategy);
}

function buildSortVariants(base: ExpandedItem[], allowRotation: boolean): ExpandedItem[][] {
  const effH = (it: ExpandedItem) => (allowRotation ? Math.min(it.width, it.height) : it.height);
  const effW = (it: ExpandedItem) => (allowRotation ? Math.max(it.width, it.height) : it.width);

  return [
    // 1) Tallest horizontal layer height first (groups tall rows first, then shallow rows cleanly below)
    [...base].sort((a, b) => effH(b) - effH(a) || effW(b) - effW(a) || b.width * b.height - a.width * a.height),
    // 2) Largest area first
    [...base].sort((a, b) => b.width * b.height - a.width * a.height || effH(b) - effH(a)),
    // 3) Widest horizontal piece first
    [...base].sort((a, b) => effW(b) - effW(a) || effH(b) - effH(a)),
    // 4) Longest side first
    [...base].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height),
  ];
}

type TrialResult = {
  sheets: Array<{ placed: PlacedRect[]; maxUsedY: number; maxUsedX: number }>;
  totalPlaced: number;
  lastSheetHeight: number;
  totalUsedHeight: number;
  verticalMoment: number;
};

function evaluateMultiSheet(
  sortedItems: ExpandedItem[],
  mode: "chapa" | "bobina",
  usableW: number,
  usableH: number,
  spacing: number,
  allowRotation: boolean,
  strategy: PackStrategy,
): TrialResult {
  if (mode === "bobina") {
    const res = runBinStrategy(sortedItems, usableW, usableH, spacing, allowRotation, strategy);
    const verticalMoment = res.placed.reduce((sum, p) => sum + (p.y + p.height * 0.5) * (p.width * p.height), 0);
    return {
      sheets: res.placed.length ? [{ placed: res.placed, maxUsedY: res.maxUsedY, maxUsedX: res.maxUsedX }] : [],
      totalPlaced: res.placed.length,
      lastSheetHeight: res.maxUsedY,
      totalUsedHeight: res.maxUsedY,
      verticalMoment,
    };
  }

  const sheets: Array<{ placed: PlacedRect[]; maxUsedY: number; maxUsedX: number }> = [];
  let pending = sortedItems;
  let guard = 0;
  let verticalMoment = 0;

  while (pending.length > 0 && guard < 60) {
    guard += 1;
    const res = runBinStrategy(pending, usableW, usableH, spacing, allowRotation, strategy);
    if (!res.placed.length) break;
    sheets.push({ placed: res.placed, maxUsedY: res.maxUsedY, maxUsedX: res.maxUsedX });
    verticalMoment += res.placed.reduce((sum, p) => sum + (p.y + p.height * 0.5) * (p.width * p.height), 0);
    pending = res.remaining;
  }

  const totalPlaced = sheets.reduce((sum, s) => sum + s.placed.length, 0);
  const lastSheetHeight = sheets.length ? sheets[sheets.length - 1].maxUsedY : 0;
  const totalUsedHeight = sheets.reduce((sum, s) => sum + s.maxUsedY, 0);
  return { sheets, totalPlaced, lastSheetHeight, totalUsedHeight, verticalMoment };
}

function isBetterTrial(candidate: TrialResult, best: TrialResult | null) {
  if (!best) return true;
  if (candidate.totalPlaced !== best.totalPlaced) return candidate.totalPlaced > best.totalPlaced;
  if (candidate.sheets.length !== best.sheets.length) return candidate.sheets.length < best.sheets.length;
  // Primary goal for single/last sheet: minimize consumed vertical length so the clean offcut is maximized
  if (Math.abs(candidate.lastSheetHeight - best.lastSheetHeight) > 0.5) {
    return candidate.lastSheetHeight < best.lastSheetHeight;
  }
  if (Math.abs(candidate.totalUsedHeight - best.totalUsedHeight) > 0.5) {
    return candidate.totalUsedHeight < best.totalUsedHeight;
  }
  return candidate.verticalMoment < best.verticalMoment;
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

  const totalPiecesRequested = pieces.reduce((sum, p) => sum + Math.max(0, Math.floor(p.quantity)), 0);
  if (!expanded.length) {
    return {
      mode,
      sheets: [],
      totalSheets: 0,
      linearMeters: 0,
      totalPiecesRequested,
      totalPiecesPlaced: 0,
      unplacedLabels,
      usedAreaM2: 0,
      purchasedAreaM2: 0,
      utilizationPercent: 0,
      wastePercent: 0,
    };
  }

  const sortVariants = buildSortVariants(expanded, allowRotation);
  const strategies: PackStrategy[] = ["waterline-layers", "shelf-layers", "top-left-horizontal"];

  let best: TrialResult | null = null;
  for (const variant of sortVariants) {
    for (const strategy of strategies) {
      const trial = evaluateMultiSheet(variant, mode, usableW, usableH, safeSpacing, allowRotation, strategy);
      if (isBetterTrial(trial, best)) {
        best = trial;
      }
    }
  }

  const chosenSheets = best?.sheets ?? [];
  const sheets: NestedSheet[] = chosenSheets.map((raw, idx) => {
    const heightMm = mode === "bobina" ? raw.maxUsedY + safeMargin * 2 : sheetHeightMm;
    const usedAreaMm2 = raw.placed.reduce((sum, p) => sum + p.width * p.height, 0);
    const totalAreaMm2 = sheetWidthMm * heightMm;
    return {
      index: idx + 1,
      widthMm: sheetWidthMm,
      heightMm,
      usedWidthMm: raw.maxUsedX > 0 ? raw.maxUsedX + safeMargin : 0,
      usedHeightMm: raw.maxUsedY > 0 ? raw.maxUsedY + safeMargin : 0,
      usedAreaMm2,
      utilizationPercent: totalAreaMm2 > 0 ? (usedAreaMm2 / totalAreaMm2) * 100 : 0,
      placements: raw.placed.map((p) => ({ ...p, x: p.x + safeMargin, y: p.y + safeMargin })),
    };
  });

  const totalPiecesPlaced = sheets.reduce((sum, s) => sum + s.placements.length, 0);
  const usedAreaM2 = sheets.reduce((sum, s) => sum + s.usedAreaMm2, 0) / 1_000_000;
  const purchasedAreaM2 =
    sheets.reduce((sum, s) => sum + s.widthMm * s.heightMm, 0) / 1_000_000;
  const utilizationPercent = purchasedAreaM2 > 0 ? (usedAreaM2 / purchasedAreaM2) * 100 : 0;
  const linearMeters = mode === "bobina" && sheets[0] ? sheets[0].heightMm / 1000 : 0;

  return {
    mode,
    sheets,
    totalSheets: sheets.length,
    linearMeters,
    totalPiecesRequested,
    totalPiecesPlaced,
    unplacedLabels,
    usedAreaM2,
    purchasedAreaM2,
    utilizationPercent,
    wastePercent: Math.max(0, 100 - utilizationPercent),
  };
}

/**
 * Exports nested rectangular sheets as an industrial DXF (millimeters, $INSUNITS = 4)
 * with CHAPA (reference boundary) and CORTE_EXTERNO (closed polylines, smallest pieces first).
 */
export function exportRectNestingDxf(
  sheets: NestedSheet[],
  options?: { sheetIndex?: number; sheetGapMm?: number },
) {
  const targetSheets = options?.sheetIndex !== undefined
    ? sheets.filter((s) => s.index === options.sheetIndex)
    : sheets;
  const gap = options?.sheetGapMm ?? 60;

  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];

  const pushRect = (x: number, yBottom: number, w: number, h: number, layer: string, aciColor: number) => {
    const x1 = round(x, 4);
    const y1 = round(yBottom, 4);
    const x2 = round(x + w, 4);
    const y2 = round(yBottom + h, 4);
    lines.push(
      "0", "LWPOLYLINE", "8", layer, "62", String(aciColor), "90", "4", "70", "1",
      "10", String(x1), "20", String(y1),
      "10", String(x2), "20", String(y1),
      "10", String(x2), "20", String(y2),
      "10", String(x1), "20", String(y2),
    );
  };

  let xCursor = 0;
  for (const sheet of targetSheets) {
    // Sheet boundary on reference layer (color 8 = gray)
    pushRect(xCursor, 0, sheet.widthMm, sheet.heightMm, "CHAPA", 8);

    // Cut rectangles sorted smallest area first (safe order for router CNC and laser)
    const sorted = [...sheet.placements].sort((a, b) => a.width * a.height - b.width * b.height);
    for (const item of sorted) {
      // Flip Y so top-left of screen maps to top-left in CAD/CorelDRAW/Aspire/RDWorks
      const yBottom = sheet.heightMm - (item.y + item.height);
      pushRect(xCursor + item.x, yBottom, item.width, item.height, "CORTE_EXTERNO", 4);
    }

    xCursor += sheet.widthMm + gap;
  }

  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\r\n");
}

/**
 * Exports a nested rectangular sheet as an exact-scale SVG in millimeters (mm)
 * ready for CorelDRAW, Illustrator, LightBurn, RDWorks and Aspire.
 */
export function exportRectNestingSvg(sheet: NestedSheet) {
  const safeW = Math.max(1, round(sheet.widthMm, 3));
  const safeH = Math.max(1, round(sheet.heightMm, 3));
  const sorted = [...sheet.placements].sort((a, b) => a.width * a.height - b.width * b.height);
  const rects = sorted.map(
    (item) =>
      `    <rect x="${round(item.x, 3)}" y="${round(item.y, 3)}" width="${round(item.width, 3)}" height="${round(item.height, 3)}" />`,
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeW}mm" height="${safeH}mm" viewBox="0 0 ${safeW} ${safeH}">`,
    `  <g id="CHAPA" fill="none" stroke="#94a3b8" stroke-width="0.4">`,
    `    <rect x="0" y="0" width="${safeW}" height="${safeH}" />`,
    `  </g>`,
    `  <g id="CORTE_EXTERNO" fill="none" stroke="#087d74" stroke-width="0.45">`,
    ...rects,
    `  </g>`,
    `</svg>`,
  ].join("\n");
}
