export type CutPoint = { x: number; y: number };
export type CutContour = { points: CutPoint[]; layer: string };
export type CutPart = {
  id: string;
  name: string;
  contours: CutContour[];
  width: number;
  height: number;
  area: number;
  cutLength: number;
};
export type CutRotation = number;
export type CutPlacement = { part: CutPart; sheet: number; x: number; y: number; rotation: CutRotation };
export type CutPlan = {
  placements: CutPlacement[];
  sheets: number;
  utilisation: number;
  layoutScore: number;
  totalCutLength: number;
  estimatedMinutes: number;
  warnings: string[];
};

type Rect = { x: number; y: number; width: number; height: number };
type Box = { minX: number; maxX: number; minY: number; maxY: number };
type RotationFrame = Rect & { angle: number; cosine: number; sine: number };
type PlacedHole = { points: CutPoint[]; box: Box };
type PlacedGeo = {
  placement: CutPlacement;
  box: Box;
  outer: CutPoint[];
  holes: PlacedHole[];
};

const rotationFrames = new WeakMap<CutContour[], Map<number, RotationFrame>>();
const simplifiedContoursCache = new WeakMap<CutContour, CutPoint[]>();
const preciseContoursCache = new WeakMap<CutContour, CutPoint[]>();

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const samePoint = (a: CutPoint, b: CutPoint, tolerance = 0.05) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
const signedArea = (points: CutPoint[]) => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0) / 2;
const perimeter = (points: CutPoint[]) => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + Math.hypot(next.x - point.x, next.y - point.y);
}, 0);
const bounds = (points: CutPoint[]): Box => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, maxX, minY, maxY };
};

function pointInPolygon(point: CutPoint, polygon: CutPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

export function contoursToParts(raw: Array<{ vertices: Array<[number, number]>; layer?: string }>) {
  const warnings: string[] = [];
  const ready: Array<{ points: CutPoint[]; layer: string }> = [];
  const open = raw.flatMap((entry) => {
    const points = entry.vertices.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])).map(([x, y]) => ({ x, y }));
    if (points.length < 2) return [];
    if (points.length >= 3 && samePoint(points[0], points.at(-1)!)) { ready.push({ points, layer: entry.layer || "CORTE" }); return []; }
    return [{ points, layer: entry.layer || "CORTE" }];
  });
  while (open.length) {
    const path = open.shift()!;
    let joined = true;
    while (joined && !samePoint(path.points[0], path.points.at(-1)!)) {
      joined = false;
      const end = path.points.at(-1)!;
      const matchIndex = open.findIndex((candidate) => candidate.layer === path.layer && (samePoint(end, candidate.points[0]) || samePoint(end, candidate.points.at(-1)!)));
      if (matchIndex >= 0) {
        const candidate = open.splice(matchIndex, 1)[0];
        if (samePoint(end, candidate.points.at(-1)!)) candidate.points.reverse();
        path.points.push(...candidate.points.slice(1)); joined = true;
      } else {
        const start = path.points[0];
        const prependIndex = open.findIndex((candidate) => candidate.layer === path.layer && (samePoint(start, candidate.points[0]) || samePoint(start, candidate.points.at(-1)!)));
        if (prependIndex >= 0) {
          const candidate = open.splice(prependIndex, 1)[0];
          if (samePoint(start, candidate.points[0])) candidate.points.reverse();
          path.points.unshift(...candidate.points.slice(0, -1)); joined = true;
        }
      }
    }
    if (path.points.length >= 3 && samePoint(path.points[0], path.points.at(-1)!)) ready.push(path);
    else warnings.push(`Um contorno aberto com ${path.points.length} pontos foi ignorado. Use “Join/Fechar curvas” no arquivo original.`);
  }
  const contours = ready.flatMap((entry, index) => {
    const points = [...entry.points];
    points.pop();
    if (points.length < 3 || Math.abs(signedArea(points)) < 0.01) { warnings.push(`Contorno ${index + 1} ignorado: área inválida.`); return []; }
    return [{ points, layer: entry.layer, area: Math.abs(signedArea(points)), parent: -1, depth: 0 }];
  });
  const ordered = contours.map((contour, index) => ({ ...contour, index })).sort((a, b) => b.area - a.area);
  for (let childIndex = 0; childIndex < ordered.length; childIndex++) {
    const child = ordered[childIndex];
    for (let parentIndex = childIndex - 1; parentIndex >= 0; parentIndex--) {
      const parent = ordered[parentIndex];
      if (parent.area > child.area && pointInPolygon(child.points[0], parent.points)) {
        child.parent = parent.index;
        child.depth = parent.depth + 1;
        break;
      }
    }
  }
  const parts: CutPart[] = [];
  for (const outer of ordered.filter((item) => item.depth % 2 === 0)) {
    const related = [outer, ...ordered.filter((item) => item.parent === outer.index && item.depth === outer.depth + 1)];
    const box = bounds(outer.points);
    const normalized = related.map((contour) => ({ layer: contour.layer, points: contour.points.map((point) => ({ x: point.x - box.minX, y: point.y - box.minY })) }));
    const holesArea = related.slice(1).reduce((sum, item) => sum + item.area, 0);
    parts.push({ id: `part-${outer.index + 1}`, name: `Peça ${parts.length + 1}`, contours: normalized, width: box.maxX - box.minX, height: box.maxY - box.minY, area: Math.max(0, outer.area - holesArea), cutLength: related.reduce((sum, item) => sum + perimeter(item.points), 0) });
  }
  if (!parts.length) warnings.push("Nenhuma peça fechada foi encontrada no arquivo.");
  return { parts, warnings };
}

function intersects(a: Rect, b: Rect) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function contains(a: Rect, b: Rect) { return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height; }

function splitFreeRectangles(free: Rect[], used: Rect) {
  const next: Rect[] = [];
  for (const current of free) {
    if (!intersects(current, used)) { next.push(current); continue; }
    if (used.x > current.x) next.push({ x: current.x, y: current.y, width: used.x - current.x, height: current.height });
    if (used.x + used.width < current.x + current.width) next.push({ x: used.x + used.width, y: current.y, width: current.x + current.width - used.x - used.width, height: current.height });
    if (used.y > current.y) next.push({ x: current.x, y: current.y, width: current.width, height: used.y - current.y });
    if (used.y + used.height < current.y + current.height) next.push({ x: current.x, y: used.y + used.height, width: current.width, height: current.y + current.height - used.y - used.height });
  }
  return next.filter((rect) => rect.width > 0.01 && rect.height > 0.01).filter((rect, index, all) => !all.some((candidate, candidateIndex) => candidateIndex !== index && contains(candidate, rect)));
}

function packRectangles(parts: CutPart[], sheetWidth: number, sheetHeight: number, spacing: number, margin: number, allowRotation: boolean) {
  const sheets: Rect[][] = [];
  const placements: CutPlacement[] = [];
  for (const part of parts) {
    let best: { sheet: number; free: Rect; rotation: CutRotation; score: number } | null = null;
    const candidates: Array<{ width: number; height: number; rotation: CutRotation }> = [{ width: part.width + spacing, height: part.height + spacing, rotation: 0 }, ...(allowRotation ? [{ width: part.height + spacing, height: part.width + spacing, rotation: 90 as CutRotation }] : [])];
    const inspect = (sheet: number, freeRects: Rect[]) => {
      for (const free of freeRects) for (const candidate of candidates) {
        if (candidate.width > free.width || candidate.height > free.height) continue;
        const score = Math.min(free.width - candidate.width, free.height - candidate.height) + Math.max(free.width - candidate.width, free.height - candidate.height) / 1000;
        if (!best || score < best.score) best = { sheet, free, rotation: candidate.rotation, score };
      }
    };
    sheets.forEach((freeRects, sheet) => inspect(sheet, freeRects));
    if (!best) {
      const usable = { x: margin, y: margin, width: sheetWidth - margin * 2, height: sheetHeight - margin * 2 };
      if (candidates.every((candidate) => candidate.width > usable.width || candidate.height > usable.height)) throw new Error(`${part.name} (${round(part.width)} × ${round(part.height)} mm) não cabe na chapa selecionada.`);
      sheets.push([usable]);
      inspect(sheets.length - 1, sheets.at(-1)!);
    }
    if (!best) throw new Error(`Não foi possível posicionar ${part.name}.`);
    const selected = best as { sheet: number; free: Rect; rotation: CutRotation; score: number };
    const quarterTurn = selected.rotation === 90 || selected.rotation === 270;
    const placedWidth = (quarterTurn ? part.height : part.width) + spacing;
    const placedHeight = (quarterTurn ? part.width : part.height) + spacing;
    const used = { x: selected.free.x, y: selected.free.y, width: placedWidth, height: placedHeight };
    sheets[selected.sheet] = splitFreeRectangles(sheets[selected.sheet], used);
    placements.push({ part, sheet: selected.sheet, x: used.x + spacing / 2, y: used.y + spacing / 2, rotation: selected.rotation });
  }
  return { placements, sheets: sheets.length };
}

function normalizedAngle(rotation: number) { return round(((rotation % 360) + 360) % 360, 3); }
function rotationFrame(part: CutPart, rotation: CutRotation) {
  const angle = normalizedAngle(rotation);
  let frames = rotationFrames.get(part.contours);
  if (!frames) { frames = new Map(); rotationFrames.set(part.contours, frames); }
  const cached = frames.get(angle); if (cached) return cached;
  const radians = angle * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  const rotated = part.contours[0].points.map((point) => ({ x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine }));
  const box = bounds(rotated);
  const frame = { angle, cosine, sine, x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY };
  frames.set(angle, frame); return frame;
}
function rotatedSize(part: CutPart, rotation: CutRotation) { const frame = rotationFrame(part, rotation); return { width: frame.width, height: frame.height }; }
export function getRotatedPartSize(part: CutPart, rotation: CutRotation) { return rotatedSize(part, rotation); }
function rotateLocal(point: CutPoint, part: CutPart, rotation: CutRotation): CutPoint {
  const frame = rotationFrame(part, rotation);
  return { x: point.x * frame.cosine - point.y * frame.sine - frame.x, y: point.x * frame.sine + point.y * frame.cosine - frame.y };
}
function placementBounds(placement: CutPlacement): Rect { const size = rotatedSize(placement.part, placement.rotation); return { x: placement.x, y: placement.y, ...size }; }
function cross(a: CutPoint, b: CutPoint, c: CutPoint) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function properIntersection(a: CutPoint, b: CutPoint, c: CutPoint, d: CutPoint) { return cross(a, b, c) * cross(a, b, d) < -1e-7 && cross(c, d, a) * cross(c, d, b) < -1e-7; }
function pointSegmentDistance(point: CutPoint, start: CutPoint, end: CutPoint) {
  const dx = end.x - start.x, dy = end.y - start.y; const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
function segmentDistance(a: CutPoint, b: CutPoint, c: CutPoint, d: CutPoint) { return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b)); }
function simplifyLine(points: CutPoint[], tolerance: number): CutPoint[] {
  if (points.length <= 2) return points;
  let farthest = 0, farthestIndex = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const distance = pointSegmentDistance(points[index], points[0], points.at(-1)!);
    if (distance > farthest) { farthest = distance; farthestIndex = index; }
  }
  if (farthest <= tolerance) return [points[0], points.at(-1)!];
  return [...simplifyLine(points.slice(0, farthestIndex + 1), tolerance).slice(0, -1), ...simplifyLine(points.slice(farthestIndex), tolerance)];
}
function simplifiedContour(contour: CutContour) {
  const cached = simplifiedContoursCache.get(contour); if (cached) return cached;
  const source = contour.points;
  const simplified = simplifyLine([...source, source[0]], 0.12).slice(0, -1);
  const valid = simplified.length >= 3 ? simplified : source;
  const step = Math.max(1, Math.ceil(valid.length / 40));
  const result = valid.filter((_, index) => index % step === 0).slice(0, 40);
  simplifiedContoursCache.set(contour, result); return result;
}
function preciseContour(contour: CutContour) {
  const cached = preciseContoursCache.get(contour); if (cached) return cached;
  const source = contour.points;
  const simplified = simplifyLine([...source, source[0]], 0.025).slice(0, -1);
  const result = simplified.length >= 3 ? simplified : source;
  preciseContoursCache.set(contour, result); return result;
}
function simplifiedOuter(part: CutPart) { return simplifiedContour(part.contours[0]); }

function samplePoints(points: CutPoint[], limit = 12) {
  if (points.length <= limit) return points;
  const selected = new Map<string, CutPoint>();
  const add = (point: CutPoint) => selected.set(`${round(point.x, 4)}:${round(point.y, 4)}`, point);
  add(points.reduce((best, point) => point.x < best.x ? point : best));
  add(points.reduce((best, point) => point.x > best.x ? point : best));
  add(points.reduce((best, point) => point.y < best.y ? point : best));
  add(points.reduce((best, point) => point.y > best.y ? point : best));
  const remaining = Math.max(1, limit - selected.size);
  const step = points.length / remaining;
  for (let index = 0; index < remaining; index++) add(points[Math.min(points.length - 1, Math.floor(index * step))]);
  return [...selected.values()].slice(0, limit);
}

function buildPlacedGeo(placement: CutPlacement, precise: boolean): PlacedGeo {
  const mapper = precise ? preciseContour : simplifiedContour;
  const toWorld = (pts: CutPoint[]) => pts.map((point) => {
    const rotated = rotateLocal(point, placement.part, placement.rotation);
    return { x: rotated.x + placement.x, y: rotated.y + placement.y };
  });
  const outer = toWorld(mapper(placement.part.contours[0]));
  const box = bounds(outer);
  const holes: PlacedHole[] = [];
  for (let index = 1; index < placement.part.contours.length; index++) {
    const pts = toWorld(mapper(placement.part.contours[index]));
    holes.push({ points: pts, box: bounds(pts) });
  }
  return { placement, box, outer, holes };
}

function boxesOverlap(a: Box, b: Box, spacing: number) {
  return !(a.maxX + spacing <= b.minX || b.maxX + spacing <= a.minX || a.maxY + spacing <= b.minY || b.maxY + spacing <= a.minY);
}

function ringsTooClose(a: CutPoint[], b: CutPoint[], spacing: number) {
  const minDist = Math.max(0, spacing - 0.01);
  for (let ai = 0; ai < a.length; ai++) {
    const a1 = a[ai], a2 = a[(ai + 1) % a.length];
    for (let bi = 0; bi < b.length; bi++) {
      const b1 = b[bi], b2 = b[(bi + 1) % b.length];
      if (properIntersection(a1, a2, b1, b2)) return true;
      if (minDist > 0 && segmentDistance(a1, a2, b1, b2) < minDist) return true;
    }
  }
  return false;
}

function pointInsideSolid(point: CutPoint, outer: CutPoint[], holes: PlacedHole[]) {
  if (!pointInPolygon(point, outer)) return false;
  for (const hole of holes) {
    if (point.x >= hole.box.minX && point.x <= hole.box.maxX && point.y >= hole.box.minY && point.y <= hole.box.maxY && pointInPolygon(point, hole.points)) {
      return false;
    }
  }
  return true;
}

// Hole-aware conflict check: allows smaller parts to nest cleanly inside internal holes of larger parts!
function geosConflict(a: PlacedGeo, b: PlacedGeo, spacing: number) {
  if (!boxesOverlap(a.box, b.box, spacing)) return false;
  if (ringsTooClose(a.outer, b.outer, spacing)) return true;
  for (const hole of b.holes) {
    if (boxesOverlap(a.box, hole.box, spacing) && ringsTooClose(a.outer, hole.points, spacing)) return true;
  }
  for (const hole of a.holes) {
    if (boxesOverlap(b.box, hole.box, spacing) && ringsTooClose(b.outer, hole.points, spacing)) return true;
  }
  if (pointInsideSolid(a.outer[0], b.outer, b.holes)) return true;
  if (pointInsideSolid(b.outer[0], a.outer, a.holes)) return true;
  return false;
}

function buildSpatialFrontier(placed: PlacedGeo[]): PlacedGeo[] {
  if (placed.length <= 16) return placed;
  const selected = new Set<PlacedGeo>();
  // Keep earliest (largest bottom-left) parts so small late pieces backfill initial pockets
  for (let i = 0; i < Math.min(6, placed.length); i++) selected.add(placed[i]);
  // Keep latest frontier parts
  for (let i = Math.max(0, placed.length - 10); i < placed.length; i++) selected.add(placed[i]);
  // Always include parts that have internal holes so small pieces can nest inside them
  for (const item of placed) {
    if (item.holes.length > 0) selected.add(item);
  }
  return [...selected];
}

function candidatePositions(part: CutPart, rotation: CutRotation, placed: PlacedGeo[], sheetWidth: number, sheetHeight: number, margin: number, spacing: number, limit: number) {
  const size = rotatedSize(part, rotation);
  const values = new Map<string, { x: number; y: number }>();
  const add = (x: number, y: number) => {
    const rounded = { x: round(x, 2), y: round(y, 2) };
    values.set(`${rounded.x}:${rounded.y}`, rounded);
  };
  add(margin, margin);
  // Top-right & mid-sheet start points let sliding compaction interlock diagonal wedges & triangles!
  const maxX = sheetWidth - margin - size.width;
  const maxY = sheetHeight - margin - size.height;
  if (placed.length > 0 && maxX >= margin && maxY >= margin) {
    add(maxX, maxY);
    add(maxX, margin);
    add(margin, maxY);
  }
  const localVertices = samplePoints(simplifiedOuter(part).map((point) => rotateLocal(point, part, rotation)), 10);
  const frontier = buildSpatialFrontier(placed).reverse();

  for (const existing of frontier) {
    const box = { x: existing.box.minX, y: existing.box.minY, width: existing.box.maxX - existing.box.minX, height: existing.box.maxY - existing.box.minY };

    // Diagonal interlock anchors (triangles, wedges, trapezoids, letters A/V/W/N/Z)
    const diagOffset = Math.max(spacing * 1.5, 2);
    add(box.x + diagOffset, box.y + diagOffset);
    add(box.x + box.width - size.width + diagOffset, box.y + box.height - size.height + diagOffset);

    // 1. Hole-interior candidates (nest smaller pieces inside rings, letters O/D/0, frames)
    for (const hole of existing.holes) {
      const holeW = hole.box.maxX - hole.box.minX;
      const holeH = hole.box.maxY - hole.box.minY;
      if (holeW >= size.width + spacing * 2 && holeH >= size.height + spacing * 2) {
        add(hole.box.minX + spacing, hole.box.minY + spacing);
        add(hole.box.minX + (holeW - size.width) / 2, hole.box.minY + (holeH - size.height) / 2);
        add(hole.box.maxX - size.width - spacing, hole.box.minY + spacing);
        add(hole.box.minX + spacing, hole.box.maxY - size.height - spacing);
      }
    }

    // 2. Bounding-box flush & wall-aligned anchors
    add(box.x + box.width + spacing, box.y);
    add(box.x - size.width - spacing, box.y);
    add(box.x, box.y + box.height + spacing);
    add(box.x, box.y - size.height - spacing);
    add(margin, box.y);
    add(box.x, margin);
    add(margin, box.y + box.height + spacing);
    add(box.x + box.width + spacing, margin);

    // 3. Sliding scan along existing bounding box
    const horizontalStep = Math.max(4, Math.min(size.width, box.width) / 10);
    for (let x = box.x - size.width + spacing; x <= box.x + box.width - spacing; x += horizontalStep) {
      add(x, box.y);
      add(x, box.y + (box.height - size.height) / 2);
      add(x, box.y + box.height - size.height);
    }

    // 4. Vertex-to-vertex interlocking anchors
    const existingVertices = samplePoints(existing.outer, 10);
    for (const anchor of existingVertices) {
      for (const vertex of localVertices) {
        const baseX = anchor.x - vertex.x, baseY = anchor.y - vertex.y;
        const candidateCenterX = baseX + size.width / 2, candidateCenterY = baseY + size.height / 2;
        const existingCenterX = box.x + box.width / 2, existingCenterY = box.y + box.height / 2;
        const vectorX = candidateCenterX - existingCenterX, vectorY = candidateCenterY - existingCenterY;
        const vectorLength = Math.max(Math.hypot(vectorX, vectorY), 0.0001);
        add(baseX + vectorX / vectorLength * spacing, baseY + vectorY / vectorLength * spacing);
        add(baseX + spacing, baseY);
        add(baseX, baseY + spacing);
      }
    }
    if (values.size >= limit) break;
  }
  return [...values.values()].slice(0, limit);
}

// Binary-search bottom-left sliding compaction: pulls each piece down (-Y) and left (-X) until exact spacing!
function compactPlacement(
  placement: CutPlacement,
  placed: PlacedGeo[],
  sheetWidth: number,
  sheetHeight: number,
  margin: number,
  spacing: number,
  precise: boolean,
): CutPlacement {
  const size = rotatedSize(placement.part, placement.rotation);
  const maxX = sheetWidth - margin - size.width;
  const maxY = sheetHeight - margin - size.height;

  const fits = (x: number, y: number) => {
    if (x < margin - 0.01 || y < margin - 0.01 || x > maxX + 0.01 || y > maxY + 0.01) return false;
    const geo = buildPlacedGeo({ ...placement, x, y }, precise);
    for (const other of placed) {
      if (geosConflict(geo, other, spacing)) return false;
    }
    return true;
  };

  let curX = placement.x;
  let curY = placement.y;

  const slideDown = () => {
    if (curY <= margin + 0.35) return;
    if (fits(curX, margin)) { curY = margin; return; }
    let lo = margin, hi = curY;
    for (let iter = 0; iter < 9; iter++) {
      const mid = (lo + hi) / 2;
      if (fits(curX, mid)) hi = mid;
      else lo = mid;
      if (hi - lo < 0.35) break;
    }
    curY = hi;
  };

  const slideLeft = () => {
    if (curX <= margin + 0.35) return;
    if (fits(margin, curY)) { curX = margin; return; }
    let lo = margin, hi = curX;
    for (let iter = 0; iter < 9; iter++) {
      const mid = (lo + hi) / 2;
      if (fits(mid, curY)) hi = mid;
      else lo = mid;
      if (hi - lo < 0.35) break;
    }
    curX = hi;
  };

  // Two alternating gravity passes settle irregular curves and diagonals deeply into pockets
  slideDown();
  slideLeft();
  slideDown();
  slideLeft();

  return { ...placement, x: round(curX, 3), y: round(curY, 3) };
}

function seededRandom(seedValue: number) {
  let seed = seedValue >>> 0;
  return () => { seed += 0x6D2B79F5; let value = seed; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}

function textSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function rotationCandidates(allowRotation: boolean, parts: CutPart[], attemptSeed: number, orthogonalOnly = false) {
  if (!allowRotation) return [0];
  if (orthogonalOnly || parts.length > 60) return [0, 90, 180, 270];
  const angles = new Set<number>([0, 90, 180, 270, 45, 135, 225, 315]);
  if (parts.length <= 24) {
    [30, 60, 120, 150, 210, 240, 300, 330].forEach((a) => angles.add(a));
  }
  const uniqueContours = [...new Map(parts.map((part) => [part.contours, part])).values()].slice(0, 12);
  const edges = uniqueContours.flatMap((part) => simplifiedOuter(part).map((point, index, points) => {
    const next = points[(index + 1) % points.length];
    return { angle: Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI, length: Math.hypot(next.x - point.x, next.y - point.y) };
  })).sort((a, b) => b.length - a.length);
  const edgeLimit = parts.length <= 24 ? 3 : 2;
  const selectedEdges: typeof edges = [];
  for (const edge of edges) {
    const direction = normalizedAngle(edge.angle) % 90;
    if (selectedEdges.some((item) => Math.abs((normalizedAngle(item.angle) % 90) - direction) < 1)) continue;
    selectedEdges.push(edge);
    if (selectedEdges.length === edgeLimit) break;
  }
  for (const edge of selectedEdges) {
    const aligned = normalizedAngle(-edge.angle);
    angles.add(aligned); angles.add(normalizedAngle(aligned + 90)); angles.add(normalizedAngle(aligned + 180)); angles.add(normalizedAngle(aligned + 270));
  }
  if (attemptSeed > 1) {
    const random = seededRandom(attemptSeed);
    const randomAngles = parts.length <= 24 ? 4 : 2;
    for (let index = 0; index < randomAngles; index++) angles.add(round(random() * 360, 2));
  }
  return [...angles].sort((a, b) => a - b);
}

function sheetEnvelopeScore(placed: PlacedGeo[], candidate: PlacedGeo, sheetWidth: number) {
  let minX = candidate.box.minX, minY = candidate.box.minY, maxX = candidate.box.maxX, maxY = candidate.box.maxY;
  for (const item of placed) {
    if (item.box.minX < minX) minX = item.box.minX;
    if (item.box.minY < minY) minY = item.box.minY;
    if (item.box.maxX > maxX) maxX = item.box.maxX;
    if (item.box.maxY > maxY) maxY = item.box.maxY;
  }
  const usedWidth = maxX - minX;
  const usedHeight = maxY - minY;
  const bboxArea = usedWidth * usedHeight;
  return bboxArea * 0.55 + usedHeight * sheetWidth * 0.45 + (candidate.placement.y * sheetWidth + candidate.placement.x) * 0.002;
}

function packIrregular(
  parts: CutPart[],
  sheetWidth: number,
  sheetHeight: number,
  spacing: number,
  margin: number,
  allowRotation: boolean,
  attemptSeed: number,
  orthogonalOnly = false,
) {
  const rotations = rotationCandidates(allowRotation, parts, attemptSeed, orthogonalOnly);
  const candidateLimit = parts.length > 60 ? 90 : rotations.length > 16 ? 140 : rotations.length > 8 ? 200 : 320;
  const sheetsSimple: PlacedGeo[][] = [];
  const sheetsPrecise: PlacedGeo[][] = [];

  for (const part of parts) {
    const variation = seededRandom(Math.imul(attemptSeed || 1, 2654435761) ^ textSeed(part.id));
    let best: { sheet: number; placement: CutPlacement; score: number } | null = null;

    const inspect = (sheet: number, placedSimple: PlacedGeo[], placedPrecise: PlacedGeo[]) => {
      const candidates: Array<{ sheet: number; placement: CutPlacement; score: number }> = [];
      for (const rotation of rotations) {
        const size = rotatedSize(part, rotation);
        if (size.width > sheetWidth - margin * 2 + 0.01 || size.height > sheetHeight - margin * 2 + 0.01) continue;
        for (const candidate of candidatePositions(part, rotation, placedSimple, sheetWidth, sheetHeight, margin, spacing, candidateLimit)) {
          if (candidate.x < margin - 0.01 || candidate.y < margin - 0.01 || candidate.x + size.width > sheetWidth - margin + 0.01 || candidate.y + size.height > sheetHeight - margin + 0.01) continue;
          const placement: CutPlacement = { part, sheet, x: candidate.x, y: candidate.y, rotation };
          const geo = buildPlacedGeo(placement, false);
          if (placedSimple.some((other) => geosConflict(geo, other, spacing))) continue;
          const baseScore = sheetEnvelopeScore(placedSimple, geo, sheetWidth);
          const score = baseScore + (attemptSeed > 1 ? variation() * sheetWidth * 0.22 : 0);
          candidates.push({ sheet, placement, score });
        }
      }
      if (!candidates.length) return;
      candidates.sort((a, b) => a.score - b.score);
      // Verify and binary-search compact the top 3 distinct valid placements on precise contours!
      let checkedValid = 0;
      for (const candidate of candidates) {
        const preciseGeo = buildPlacedGeo(candidate.placement, true);
        if (placedPrecise.some((other) => geosConflict(preciseGeo, other, spacing))) continue;
        const compacted = compactPlacement(candidate.placement, placedPrecise, sheetWidth, sheetHeight, margin, spacing, true);
        const compactedGeo = buildPlacedGeo(compacted, true);
        const compactedScore = sheetEnvelopeScore(placedPrecise, compactedGeo, sheetWidth);
        if (!best || compactedScore < best.score) {
          best = { sheet, placement: compacted, score: compactedScore };
        }
        checkedValid += 1;
        if (checkedValid >= (parts.length > 50 ? 1 : 3)) break;
      }
    };

    for (let sheet = 0; sheet < sheetsSimple.length; sheet++) {
      inspect(sheet, sheetsSimple[sheet], sheetsPrecise[sheet]);
      if (best) break;
    }
    if (!best) {
      sheetsSimple.push([]);
      sheetsPrecise.push([]);
      const nextSheet = sheetsSimple.length - 1;
      inspect(nextSheet, sheetsSimple[nextSheet], sheetsPrecise[nextSheet]);
    }
    if (!best) throw new Error(`${part.name} (${round(part.width)} × ${round(part.height)} mm) não cabe na chapa selecionada.`);
    const selected = best as { sheet: number; placement: CutPlacement; score: number };
    sheetsSimple[selected.sheet].push(buildPlacedGeo(selected.placement, false));
    sheetsPrecise[selected.sheet].push(buildPlacedGeo(selected.placement, true));
  }

  return {
    placements: sheetsPrecise.flatMap((sheet) => sheet.map((geo) => geo.placement)),
    sheets: sheetsPrecise.length,
  };
}

function planLayoutScore(placements: CutPlacement[], sheets: number, sheetWidth: number) {
  return Array.from({ length: sheets }, (_, sheet) => {
    const boxes = placements.filter((item) => item.sheet === sheet).map(placementBounds);
    if (!boxes.length) return 0;
    const minX = Math.min(...boxes.map((box) => box.x)), minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width)), maxY = Math.max(...boxes.map((box) => box.y + box.height));
    return (maxY - minY) * sheetWidth + (maxX - minX);
  }).reduce((sum, area) => sum + area, 0);
}

export function scaleCutParts(parts: CutPart[], factor: number): CutPart[] {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return parts;
  return parts.map((part) => ({
    ...part,
    width: part.width * factor,
    height: part.height * factor,
    area: part.area * factor * factor,
    cutLength: part.cutLength * factor,
    contours: part.contours.map((contour) => ({
      ...contour,
      points: contour.points.map((point) => ({ x: point.x * factor, y: point.y * factor })),
    })),
  }));
}

export function createCutPlan(parts: CutPart[], options: { sheetWidth: number; sheetHeight: number; quantity: number; pieceQuantities?: Record<string, number>; spacing: number; margin: number; allowRotation: boolean; attemptSeed?: number; speedMmMin: number; setupMinutes: number }) {
  if (!parts.length) throw new Error("Carregue ao menos uma peça fechada.");
  const multiplier = Math.max(1, Math.floor(options.quantity));
  const copies: CutPart[] = [];
  let copyCounter = 0;
  for (const part of parts) {
    const perPart = options.pieceQuantities ? Math.max(0, Math.floor(options.pieceQuantities[part.id] ?? 1)) : 1;
    const totalForPart = perPart * multiplier;
    for (let index = 0; index < totalForPart; index++) {
      copyCounter += 1;
      copies.push({ ...part, id: `${part.id}-copy-${copyCounter}` });
    }
  }
  if (!copies.length) throw new Error("Ative ao menos uma peça com quantidade maior que zero.");

  const seed = options.attemptSeed ?? 1;
  const random = seededRandom(seed);
  const ranks = new Map(copies.map((part) => [part.id, random()]));
  const strategies = [
    // 1. Maior área primeiro (coloca peças grandes / com furos primeiro para pequenas entrarem depois)
    [...copies].sort((a, b) => (b.width * b.height) - (a.width * a.height) || b.area - a.area),
    // 2. Maior dimensão linear primeiro (ótimo para peças compridas e estreitas)
    [...copies].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.area - a.area),
    // 3. Peças com furos e maior perímetro primeiro (maximiza encaixe interno)
    [...copies].sort((a, b) => (b.contours.length - a.contours.length) || b.cutLength - a.cutLength),
    // 4. Ordem perturbada para tentativas alternativas
    [...copies].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0)),
  ];

  const startedAt = Date.now();
  const timeBudgetMs = copies.length > 50 ? 6000 : 4500;
  const attempts: Array<{ placements: CutPlacement[]; sheets: number }> = [];

  if (copies.length <= 120) {
    if (seed <= 1) {
      // No 1º clique, avalia automaticamente encaixe ortogonal (0/90/180/270) + livre (todos os ângulos) em múltiplas ordens
      if (options.allowRotation) {
        attempts.push(packIrregular(strategies[0], options.sheetWidth, options.sheetHeight, options.spacing, options.margin, true, 1, true));
      }
      for (let i = 0; i < 3; i++) {
        if (Date.now() - startedAt > timeBudgetMs) break;
        attempts.push(packIrregular(strategies[i], options.sheetWidth, options.sheetHeight, options.spacing, options.margin, options.allowRotation, 1, false));
      }
      if (options.allowRotation && Date.now() - startedAt <= timeBudgetMs) {
        attempts.push(packIrregular(strategies[1], options.sheetWidth, options.sheetHeight, options.spacing, options.margin, true, 1, true));
      }
    } else {
      const selectedStrategy = strategies[Math.abs(seed - 1) % strategies.length];
      attempts.push(packIrregular(selectedStrategy, options.sheetWidth, options.sheetHeight, options.spacing, options.margin, options.allowRotation, seed, false));
      if (options.allowRotation && Date.now() - startedAt <= timeBudgetMs) {
        attempts.push(packIrregular(strategies[3], options.sheetWidth, options.sheetHeight, options.spacing, options.margin, true, seed + 17, seed % 2 === 0));
      }
    }
  } else {
    attempts.push(packRectangles(strategies[0], options.sheetWidth, options.sheetHeight, options.spacing, options.margin, options.allowRotation));
    attempts.push(packRectangles(strategies[1], options.sheetWidth, options.sheetHeight, options.spacing, options.margin, options.allowRotation));
  }

  const best = attempts.sort((a, b) => a.sheets - b.sheets || planLayoutScore(a.placements, a.sheets, options.sheetWidth) - planLayoutScore(b.placements, b.sheets, options.sheetWidth))[0];
  const totalArea = copies.reduce((sum, part) => sum + part.area, 0);
  const totalCutLength = copies.reduce((sum, part) => sum + part.cutLength, 0);
  return {
    ...best,
    utilisation: totalArea / Math.max(options.sheetWidth * options.sheetHeight * best.sheets, 1) * 100,
    layoutScore: planLayoutScore(best.placements, best.sheets, options.sheetWidth),
    totalCutLength,
    estimatedMinutes: options.setupMinutes + totalCutLength / Math.max(options.speedMmMin, 1),
    warnings: [],
  } satisfies CutPlan;
}

export function transformContour(contour: CutContour, placement: CutPlacement) {
  return contour.points.map((point) => { const rotated = rotateLocal(point, placement.part, placement.rotation); return { x: placement.x + rotated.x, y: placement.y + rotated.y }; });
}

export function exportCutPlanDxf(plan: CutPlan, options?: { sheetIndex?: number; sheetWidth?: number; sheetGapMm?: number }) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  const targetPlacements = options?.sheetIndex !== undefined
    ? plan.placements.filter((item) => item.sheet === options.sheetIndex)
    : plan.placements;
  const sheetStride = options?.sheetIndex === undefined && options?.sheetWidth && options.sheetWidth > 0
    ? options.sheetWidth + (options.sheetGapMm ?? 60)
    : 0;

  const pushContour = (points: CutPoint[], layer: string, aciColor: number, xOffset: number) => {
    lines.push("0", "LWPOLYLINE", "8", layer, "62", String(aciColor), "90", String(points.length), "70", "1");
    for (const point of points) {
      lines.push("10", String(round(point.x + xOffset, 4)), "20", String(round(point.y, 4)));
    }
  };

  // Pass 1: furos internos primeiro (ordem segura em laser e router CNC)
  for (const placement of targetPlacements) {
    const xOffset = placement.sheet * sheetStride;
    for (let index = 1; index < placement.part.contours.length; index++) {
      const points = transformContour(placement.part.contours[index], placement);
      pushContour(points, "FUROS_INTERNOS", 1, xOffset);
    }
  }
  // Pass 2: contornos externos por último (peças menores primeiro para corte seguro de peças encaixadas em furos)
  const sortedOuters = [...targetPlacements].sort((a, b) => a.part.area - b.part.area);
  for (const placement of sortedOuters) {
    const xOffset = placement.sheet * sheetStride;
    if (placement.part.contours[0]) {
      const points = transformContour(placement.part.contours[0], placement);
      pushContour(points, "CORTE_EXTERNO", 4, xOffset);
    }
  }

  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\r\n");
}

export function exportCutPlanSvg(plan: CutPlan, sheetWidth: number, sheetHeight: number, sheetIndex = 0) {
  const safeW = Math.max(1, round(sheetWidth, 3));
  const safeH = Math.max(1, round(sheetHeight, 3));
  const placements = plan.placements.filter((item) => item.sheet === sheetIndex);
  const toSvgPoints = (points: CutPoint[]) =>
    points.map((point) => `${round(point.x, 3)},${round(safeH - point.y, 3)}`).join(" ");

  const holes: string[] = [];
  const outers: string[] = [];
  for (const placement of placements) {
    for (let index = 1; index < placement.part.contours.length; index++) {
      const pts = toSvgPoints(transformContour(placement.part.contours[index], placement));
      holes.push(`    <polygon points="${pts}" />`);
    }
  }
  for (const placement of [...placements].sort((a, b) => a.part.area - b.part.area)) {
    if (placement.part.contours[0]) {
      const pts = toSvgPoints(transformContour(placement.part.contours[0], placement));
      outers.push(`    <polygon points="${pts}" />`);
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeW}mm" height="${safeH}mm" viewBox="0 0 ${safeW} ${safeH}">`,
    `  <g id="CHAPA" fill="none" stroke="#94a3b8" stroke-width="0.4">`,
    `    <rect x="0" y="0" width="${safeW}" height="${safeH}" />`,
    `  </g>`,
    `  <g id="FUROS_INTERNOS" fill="none" stroke="#e45c25" stroke-width="0.35">`,
    ...holes,
    `  </g>`,
    `  <g id="CORTE_EXTERNO" fill="none" stroke="#087d74" stroke-width="0.45">`,
    ...outers,
    `  </g>`,
    `</svg>`,
  ].join("\n");
}
