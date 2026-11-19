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
type RotationFrame = Rect & { angle: number; cosine: number; sine: number };

const rotationFrames = new WeakMap<CutContour[], Map<number, RotationFrame>>();
const simplifiedOuters = new WeakMap<CutContour[], CutPoint[]>();
const preciseOuters = new WeakMap<CutContour[], CutPoint[]>();

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const samePoint = (a: CutPoint, b: CutPoint, tolerance = .05) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
const signedArea = (points: CutPoint[]) => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0) / 2;
const perimeter = (points: CutPoint[]) => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + Math.hypot(next.x - point.x, next.y - point.y);
}, 0);
const bounds = (points: CutPoint[]) => ({
  minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)), maxY: Math.max(...points.map((point) => point.y)),
});

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
    if (points.length < 3 || Math.abs(signedArea(points)) < .01) { warnings.push(`Contorno ${index + 1} ignorado: área inválida.`); return []; }
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
  return next.filter((rect) => rect.width > .01 && rect.height > .01).filter((rect, index, all) => !all.some((candidate, candidateIndex) => candidateIndex !== index && contains(candidate, rect)));
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
function simplifiedOuter(part: CutPart) {
  const cached = simplifiedOuters.get(part.contours); if (cached) return cached;
  const source = part.contours[0].points;
  const simplified = simplifyLine([...source, source[0]], .08).slice(0, -1);
  const valid = simplified.length >= 3 ? simplified : source;
  const step = Math.max(1, Math.ceil(valid.length / 48));
  const result = valid.filter((_, index) => index % step === 0).slice(0, 48);
  simplifiedOuters.set(part.contours, result); return result;
}
function preciseOuter(part: CutPart) {
  const cached = preciseOuters.get(part.contours); if (cached) return cached;
  const source = part.contours[0].points;
  const simplified = simplifyLine([...source, source[0]], .02).slice(0, -1);
  const result = simplified.length >= 3 ? simplified : source;
  preciseOuters.set(part.contours, result); return result;
}
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
function outerPolygon(placement: CutPlacement) { return simplifiedOuter(placement.part).map((point) => { const rotated = rotateLocal(point, placement.part, placement.rotation); return { x: rotated.x + placement.x, y: rotated.y + placement.y }; }); }
function precisePolygon(placement: CutPlacement) { return preciseOuter(placement.part).map((point) => { const rotated = rotateLocal(point, placement.part, placement.rotation); return { x: rotated.x + placement.x, y: rotated.y + placement.y }; }); }

function polygonsConflict(a: CutPoint[], b: CutPoint[], spacing: number) {
  const aBox = bounds(a), bBox = bounds(b);
  if (aBox.maxX + spacing <= bBox.minX || bBox.maxX + spacing <= aBox.minX || aBox.maxY + spacing <= bBox.minY || bBox.maxY + spacing <= aBox.minY) return false;
  for (let ai = 0; ai < a.length; ai++) for (let bi = 0; bi < b.length; bi++) {
    const a1 = a[ai], a2 = a[(ai + 1) % a.length], b1 = b[bi], b2 = b[(bi + 1) % b.length];
    if (properIntersection(a1, a2, b1, b2) || (spacing > 0 && segmentDistance(a1, a2, b1, b2) < spacing - .01)) return true;
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

function candidatePositions(part: CutPart, rotation: CutRotation, placed: CutPlacement[], margin: number, spacing: number, limit: number) {
  const size = rotatedSize(part, rotation); const values = new Map<string, { x: number; y: number }>();
  const add = (x: number, y: number) => { const rounded = { x: round(x, 3), y: round(y, 3) }; values.set(`${rounded.x}:${rounded.y}`, rounded); };
  add(margin, margin);
  const localVertices = samplePoints(part.contours[0].points.map((point) => rotateLocal(point, part, rotation)));
  const frontier = [...(placed.length <= 12 ? placed : placed.slice(-12))].reverse();
  for (const existing of frontier) {
    const box = placementBounds(existing);
    add(box.x + box.width + spacing, box.y); add(box.x - size.width - spacing, box.y); add(box.x, box.y + box.height + spacing); add(box.x, box.y - size.height - spacing);
    add(margin, box.y); add(box.x, margin); add(margin, box.y + box.height + spacing); add(box.x + box.width + spacing, margin);
    const horizontalStep = Math.max(2, Math.min(size.width, box.width) / 18);
    for (let x = box.x - size.width + spacing; x <= box.x + box.width - spacing; x += horizontalStep) {
      add(x, box.y);
      add(x, box.y + (box.height - size.height) / 2);
      add(x, box.y + box.height - size.height);
    }
    const existingVertices = samplePoints(outerPolygon(existing));
    for (const anchor of existingVertices) for (const vertex of localVertices) {
      const baseX = anchor.x - vertex.x, baseY = anchor.y - vertex.y;
      const candidateCenterX = baseX + size.width / 2, candidateCenterY = baseY + size.height / 2;
      const existingCenterX = box.x + box.width / 2, existingCenterY = box.y + box.height / 2;
      const vectorX = candidateCenterX - existingCenterX, vectorY = candidateCenterY - existingCenterY;
      const vectorLength = Math.max(Math.hypot(vectorX, vectorY), .0001);
      add(baseX + vectorX / vectorLength * spacing, baseY + vectorY / vectorLength * spacing);
      add(baseX + spacing, baseY); add(baseX - spacing, baseY);
      add(baseX, baseY + spacing); add(baseX, baseY - spacing);
    }
  }
  return [...values.values()].slice(0, limit);
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

function rotationCandidates(allowRotation: boolean, parts: CutPart[], attemptSeed: number) {
  if (!allowRotation) return [0];
  const angles = new Set<number>([0, 90, 180, 270, 45, 135, 225, 315]);
  const uniqueContours = [...new Map(parts.map((part) => [part.contours, part])).values()].slice(0, 16);
  const edges = uniqueContours.flatMap((part) => simplifiedOuter(part).map((point, index, points) => {
    const next = points[(index + 1) % points.length];
    return { angle: Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI, length: Math.hypot(next.x - point.x, next.y - point.y) };
  })).sort((a, b) => b.length - a.length);
  const selectedEdges: typeof edges = [];
  for (const edge of edges) {
    const direction = normalizedAngle(edge.angle) % 90;
    if (selectedEdges.some((item) => Math.abs((normalizedAngle(item.angle) % 90) - direction) < .5)) continue;
    selectedEdges.push(edge); if (selectedEdges.length === 3) break;
  }
  for (const edge of selectedEdges) {
    const aligned = normalizedAngle(-edge.angle);
    angles.add(aligned); angles.add(normalizedAngle(aligned + 90)); angles.add(normalizedAngle(aligned + 180)); angles.add(normalizedAngle(aligned + 270));
  }
  const random = seededRandom(attemptSeed || 1);
  const randomAngles = parts.length <= 20 ? 4 : 2;
  for (let index = 0; index < randomAngles; index++) angles.add(round(random() * 360, 3));
  return [...angles].sort((a, b) => a - b);
}

function packIrregular(parts: CutPart[], sheetWidth: number, sheetHeight: number, spacing: number, margin: number, allowRotation: boolean, attemptSeed: number) {
  const rotations = rotationCandidates(allowRotation, parts, attemptSeed);
  const candidateLimit = rotations.length > 16 ? 190 : rotations.length > 8 ? 260 : 800;
  const sheets: CutPlacement[][] = [];
  for (const part of parts) {
    const variation = seededRandom(Math.imul(attemptSeed || 1, 2654435761) ^ textSeed(part.id));
    let best: { sheet: number; placement: CutPlacement; score: number } | null = null;
    const inspect = (sheet: number, placed: CutPlacement[]) => {
      const candidates: Array<{ sheet: number; placement: CutPlacement; score: number }> = [];
      for (const rotation of rotations) {
        const size = rotatedSize(part, rotation);
        for (const candidate of candidatePositions(part, rotation, placed, margin, spacing, candidateLimit)) {
          if (candidate.x < margin - .01 || candidate.y < margin - .01 || candidate.x + size.width > sheetWidth - margin + .01 || candidate.y + size.height > sheetHeight - margin + .01) continue;
          const placement: CutPlacement = { part, sheet, x: candidate.x, y: candidate.y, rotation };
          const polygon = outerPolygon(placement);
          if (placed.some((other) => polygonsConflict(polygon, outerPolygon(other), spacing))) continue;
          const all = [...placed, placement].map(placementBounds);
          const minX = Math.min(...all.map((box) => box.x)), minY = Math.min(...all.map((box) => box.y));
          const maxX = Math.max(...all.map((box) => box.x + box.width)), maxY = Math.max(...all.map((box) => box.y + box.height));
          const usedWidth = maxX - minX, usedHeight = maxY - minY;
          const baseScore = usedHeight * sheetWidth + usedWidth;
          const score = baseScore + (attemptSeed > 1 ? variation() * sheetWidth * .28 : 0);
          candidates.push({ sheet, placement, score });
        }
      }
      const precisePlaced = placed.map(precisePolygon);
      for (const candidate of candidates.sort((a, b) => a.score - b.score)) {
        const polygon = precisePolygon(candidate.placement);
        if (precisePlaced.some((other) => polygonsConflict(polygon, other, spacing))) continue;
        if (!best || candidate.score < best.score) best = candidate;
        break;
      }
    };
    sheets.forEach((placed, sheet) => inspect(sheet, placed));
    if (!best) { sheets.push([]); inspect(sheets.length - 1, sheets.at(-1)!); }
    if (!best) throw new Error(`${part.name} (${round(part.width)} × ${round(part.height)} mm) não cabe na chapa selecionada.`);
    const selected = best as { sheet: number; placement: CutPlacement; score: number }; sheets[selected.sheet].push(selected.placement);
  }
  return { placements: sheets.flat(), sheets: sheets.length };
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

export function createCutPlan(parts: CutPart[], options: { sheetWidth: number; sheetHeight: number; quantity: number; spacing: number; margin: number; allowRotation: boolean; attemptSeed?: number; speedMmMin: number; setupMinutes: number }) {
  if (!parts.length) throw new Error("Carregue ao menos uma peça fechada.");
  const copies = Array.from({ length: Math.max(1, Math.floor(options.quantity)) }, () => parts).flat().map((part, index) => ({ ...part, id: `${part.id}-copy-${index + 1}` }));
  const random = seededRandom(options.attemptSeed ?? 1);
  const ranks = new Map(copies.map((part) => [part.id, random()]));
  const strategies = [
    [...copies].sort((a, b) => b.area - a.area || (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0)),
    [...copies].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || (ranks.get(b.id) ?? 0) - (ranks.get(a.id) ?? 0)),
    [...copies].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0)),
  ];
  const selectedStrategy = strategies[Math.abs((options.attemptSeed ?? 1) - 1) % strategies.length];
  const attempts = [selectedStrategy].flatMap((ordered) => ordered.length <= 40
    ? [
        packIrregular(ordered, options.sheetWidth, options.sheetHeight, options.spacing, options.margin, options.allowRotation, options.attemptSeed ?? 1),
        ...(options.allowRotation ? [packIrregular(ordered, options.sheetWidth, options.sheetHeight, options.spacing, options.margin, false, options.attemptSeed ?? 1)] : []),
      ]
    : [packRectangles(ordered, options.sheetWidth, options.sheetHeight, options.spacing, options.margin, options.allowRotation)]);
  const best = attempts.sort((a, b) => a.sheets - b.sheets || planLayoutScore(a.placements, a.sheets, options.sheetWidth) - planLayoutScore(b.placements, b.sheets, options.sheetWidth))[0];
  const totalArea = copies.reduce((sum, part) => sum + part.area, 0);
  const totalCutLength = copies.reduce((sum, part) => sum + part.cutLength, 0);
  return { ...best, utilisation: totalArea / Math.max(options.sheetWidth * options.sheetHeight * best.sheets, 1) * 100, layoutScore: planLayoutScore(best.placements, best.sheets, options.sheetWidth), totalCutLength, estimatedMinutes: options.setupMinutes + totalCutLength / Math.max(options.speedMmMin, 1), warnings: [] } satisfies CutPlan;
}

export function transformContour(contour: CutContour, placement: CutPlacement) {
  return contour.points.map((point) => { const rotated = rotateLocal(point, placement.part, placement.rotation); return { x: placement.x + rotated.x, y: placement.y + rotated.y }; });
}

export function exportCutPlanDxf(plan: CutPlan) {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  const layerColors = new Map<string, number>(); const colors = [1, 3, 5, 2, 6, 4, 7];
  for (const placement of plan.placements) for (const contour of placement.part.contours) {
    const points = transformContour(contour, placement);
    const layer = contour.layer || "CORTE"; if (!layerColors.has(layer)) layerColors.set(layer, colors[layerColors.size % colors.length]);
    lines.push("0", "LWPOLYLINE", "8", layer, "62", String(layerColors.get(layer)), "90", String(points.length), "70", "1");
    for (const point of points) lines.push("10", String(round(point.x, 4)), "20", String(round(point.y, 4)));
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\r\n");
}
