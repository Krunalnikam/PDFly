/**
 * Dedicated Web Worker for Document Edge & Paper Detection.
 * Executes CPU-intensive image processing off the main UI thread to prevent any UI freezes.
 */

export type Corner = { x: number; y: number };
export type Quad = [Corner, Corner, Corner, Corner];

export type DetectionResult = {
  quad: Quad;
  confidence: number;
  blurry: boolean;
  isConfident: boolean;
};

const CONFIDENCE_THRESHOLD = 0.48;

const FULL_QUAD = (): Quad => [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const dist = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y);

const cross = (o: Corner, a: Corner, b: Corner) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const convexHull = (pts: Corner[]): Corner[] => {
  if (pts.length < 4) return pts.slice();
  const sorted = [...pts].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const build = (input: Corner[]) => {
    const out: Corner[] = [];
    for (const p of input) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    return out;
  };
  const lower = build(sorted);
  const upper = build(sorted.slice().reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

const polyArea = (q: Corner[]) => {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i]!;
    const n = q[(i + 1) % q.length]!;
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
};

const orderQuad = (pts: Corner[]): Quad => {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let best = 0;
  let bestScore = Infinity;
  sorted.forEach((p, i) => {
    const s = p.x + p.y;
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  });
  const rot = [...sorted.slice(best), ...sorted.slice(0, best)];
  return [rot[0]!, rot[1]!, rot[2]!, rot[3]!];
};

const padQuad = (quad: Quad, factor = 0.008): Quad => {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  return quad.map((c) => ({
    x: Math.min(1, Math.max(0, c.x + (c.x - cx) * factor)),
    y: Math.min(1, Math.max(0, c.y + (c.y - cy) * factor)),
  })) as Quad;
};

// Fast Separable 1D Blur (Horizontal then Vertical)
const fastBlur = (src: Float32Array, w: number, h: number): Float32Array => {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  // Horizontal 1D pass
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const left = x > 0 ? x - 1 : 0;
      const right = x < w - 1 ? x + 1 : w - 1;
      tmp[rowOff + x] = (src[rowOff + left]! + src[rowOff + x]! * 2 + src[rowOff + right]!) * 0.25;
    }
  }

  // Vertical 1D pass
  for (let y = 0; y < h; y++) {
    const top = y > 0 ? y - 1 : 0;
    const bot = y < h - 1 ? y + 1 : h - 1;
    const topOff = top * w;
    const midOff = y * w;
    const botOff = bot * w;
    for (let x = 0; x < w; x++) {
      out[midOff + x] = (tmp[topOff + x]! + tmp[midOff + x]! * 2 + tmp[botOff + x]!) * 0.25;
    }
  }

  return out;
};

const fastSobel = (gray: Float32Array, w: number, h: number): Float32Array => {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const rowPrev = (y - 1) * w;
    const rowCurr = y * w;
    const rowNext = (y + 1) * w;
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[rowPrev + x - 1]! -
        2 * gray[rowCurr + x - 1]! -
        gray[rowNext + x - 1]! +
        gray[rowPrev + x + 1]! +
        2 * gray[rowCurr + x + 1]! +
        gray[rowNext + x + 1]!;
      const gy =
        -gray[rowPrev + x - 1]! -
        2 * gray[rowPrev + x]! -
        gray[rowPrev + x + 1]! +
        gray[rowNext + x - 1]! +
        2 * gray[rowNext + x]! +
        gray[rowNext + x + 1]!;
      mag[rowCurr + x] = Math.hypot(gx, gy);
    }
  }
  return mag;
};

const checkBlurry = (gray: Float32Array, w: number, h: number): boolean => {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      const v = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (!n) return false;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return variance < 32;
};

const fastOtsu = (values: Float32Array, maxValue = 255): number => {
  const bins = 256;
  const hist = new Int32Array(bins);
  const total = values.length;
  for (let i = 0; i < total; i++) {
    const b = Math.max(0, Math.min(bins - 1, Math.round((values[i]! / maxValue) * 255)));
    hist[b]!++;
  }
  let sumAll = 0;
  for (let t = 0; t < bins; t++) sumAll += t * hist[t]!;
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < bins; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const between = wB * wF * (sumB / wB - (sumAll - sumB) / wF) ** 2;
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return (best / 255) * maxValue;
};

/** Fast separable morphological closing (Dilation -> Erosion) */
const morphCloseSeparable = (mask: Uint8Array, w: number, h: number, r = 3): Uint8Array => {
  // Horizontal dilation
  const hDilated = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      let hit = 0;
      const minX = Math.max(0, x - r);
      const maxX = Math.min(w - 1, x + r);
      for (let xx = minX; xx <= maxX; xx++) {
        if (mask[rowOff + xx]) {
          hit = 1;
          break;
        }
      }
      hDilated[rowOff + x] = hit;
    }
  }

  // Vertical dilation
  const dilated = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const minY = Math.max(0, y - r);
    const maxY = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let yy = minY; yy <= maxY; yy++) {
        if (hDilated[yy * w + x]) {
          hit = 1;
          break;
        }
      }
      dilated[y * w + x] = hit;
    }
  }

  // Horizontal erosion
  const hEroded = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      let all = 1;
      const minX = Math.max(0, x - r);
      const maxX = Math.min(w - 1, x + r);
      for (let xx = minX; xx <= maxX; xx++) {
        if (!dilated[rowOff + xx]) {
          all = 0;
          break;
        }
      }
      hEroded[rowOff + x] = all;
    }
  }

  // Vertical erosion
  const closed = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const minY = Math.max(0, y - r);
    const maxY = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let yy = minY; yy <= maxY; yy++) {
        if (!hEroded[yy * w + x]) {
          all = 0;
          break;
        }
      }
      closed[y * w + x] = all;
    }
  }

  return closed;
};

/** Fast typed queue flood-fill for hole closure */
const fillHolesAndConnectPaperFast = (mask: Uint8Array, w: number, h: number): Uint8Array => {
  const bg = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let qHead = 0;
  let qTail = 0;

  const pushIfBg = (idx: number) => {
    if (mask[idx] === 0 && bg[idx] === 0) {
      bg[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  const lastRow = (h - 1) * w;
  for (let x = 0; x < w; x++) {
    pushIfBg(x);
    pushIfBg(lastRow + x);
  }
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    pushIfBg(row);
    pushIfBg(row + (w - 1));
  }

  while (qHead < qTail) {
    const p = queue[qHead++]!;
    const x = p % w;
    const y = (p - x) / w;

    if (x > 0) pushIfBg(p - 1);
    if (x < w - 1) pushIfBg(p + 1);
    if (y > 0) pushIfBg(p - w);
    if (y < h - 1) pushIfBg(p + w);
  }

  const solidPaper = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    solidPaper[i] = bg[i] ? 0 : 1;
  }
  return solidPaper;
};

/** Direct outer boundary point extraction from solid paper mask */
const getPaperBoundaryFast = (mask: Uint8Array, w: number, h: number) => {
  const boundary: Corner[] = [];
  let area = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (mask[idx]) {
        area++;
        const isEdge =
          x === 0 ||
          y === 0 ||
          x === w - 1 ||
          y === h - 1 ||
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - w] === 0 ||
          mask[idx + w] === 0;
        if (isEdge) {
          boundary.push({ x, y });
        }
      }
    }
  }
  return { boundary, area };
};

const extract4SheetCorners = (hull: Corner[]): Quad | null => {
  if (hull.length < 4) return null;

  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;

  let tl: Corner | null = null;
  let tr: Corner | null = null;
  let br: Corner | null = null;
  let bl: Corner | null = null;

  let scoreTL = -Infinity;
  let scoreTR = -Infinity;
  let scoreBR = -Infinity;
  let scoreBL = -Infinity;

  for (const p of hull) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const sTL = -dx - dy;
    const sTR = dx - dy;
    const sBR = dx + dy;
    const sBL = -dx + dy;

    if (sTL > scoreTL) {
      scoreTL = sTL;
      tl = p;
    }
    if (sTR > scoreTR) {
      scoreTR = sTR;
      tr = p;
    }
    if (sBR > scoreBR) {
      scoreBR = sBR;
      br = p;
    }
    if (sBL > scoreBL) {
      scoreBL = sBL;
      bl = p;
    }
  }

  if (!tl || !tr || !br || !bl) return null;
  return orderQuad([tl, tr, br, bl]);
};

const scorePaperQuad = (
  quad: Quad,
  gray: Float32Array,
  mag: Float32Array,
  paperMask: Uint8Array,
  w: number,
  h: number,
): number => {
  const pxArea = polyArea(quad);
  const areaRatio = pxArea / (w * h);

  // Reject regions that are too small to be physical pages (prevent text block cropping)
  if (areaRatio < 0.28 || areaRatio > 0.999) return 0;

  let angleScore = 0;
  let convex = true;
  let signRef = 0;
  for (let i = 0; i < 4; i++) {
    const p = quad[i]!;
    const prev = quad[(i + 3) % 4]!;
    const next = quad[(i + 1) % 4]!;
    const v1 = { x: prev.x - p.x, y: prev.y - p.y };
    const v2 = { x: next.x - p.x, y: next.y - p.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const cosA = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
    const deg = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
    angleScore += Math.max(0, 1 - Math.abs(deg - 90) / 45);

    const c = cross(prev, p, next);
    const s = Math.sign(c);
    if (!signRef) signRef = s;
    else if (s && s !== signRef) convex = false;
  }
  angleScore /= 4;
  if (!convex) return 0;

  const s01 = dist(quad[0]!, quad[1]!);
  const s12 = dist(quad[1]!, quad[2]!);
  const s23 = dist(quad[2]!, quad[3]!);
  const s30 = dist(quad[3]!, quad[0]!);
  if (Math.min(s01, s12, s23, s30) < Math.min(w, h) * 0.2) return 0;

  const topBottomPar = Math.min(s01, s23) / Math.max(s01, s23);
  const leftRightPar = Math.min(s12, s30) / Math.max(s12, s30);
  const parallelism = topBottomPar * leftRightPar;

  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;

  let transitionScore = 0;
  let gradientHits = 0;
  let totalSamples = 0;

  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    const steps = Math.max(12, Math.round(dist(a, b) * 0.7));

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;

      const inX = Math.round(cx + (px - cx) * 0.94);
      const inY = Math.round(cy + (py - cy) * 0.94);
      const outX = Math.round(cx + (px - cx) * 1.06);
      const outY = Math.round(cy + (py - cy) * 1.06);

      if (
        inX >= 0 &&
        inX < w &&
        inY >= 0 &&
        inY < h &&
        outX >= 0 &&
        outX < w &&
        outY >= 0 &&
        outY < h
      ) {
        const inMask = paperMask[inY * w + inX]!;
        const outMask = paperMask[outY * w + outX]!;
        const inG = gray[inY * w + inX]!;
        const outG = gray[outY * w + outX]!;

        if (inMask === 1 && outMask === 0) transitionScore += 1;
        else if (Math.abs(inG - outG) > 22) transitionScore += 0.7;

        const midX = Math.min(w - 1, Math.max(0, Math.round(px)));
        const midY = Math.min(h - 1, Math.max(0, Math.round(py)));
        if (mag[midY * w + midX]! > 20) gradientHits++;

        totalSamples++;
      }
    }
  }

  const boundaryTransition = totalSamples ? transitionScore / totalSamples : 0;
  const gradientSupport = totalSamples ? gradientHits / totalSamples : 0;

  return (
    boundaryTransition * 0.4 +
    gradientSupport * 0.25 +
    angleScore * 0.15 +
    parallelism * 0.1 +
    Math.min(1, areaRatio / 0.5) * 0.1
  );
};

export function processDocumentPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): DetectionResult {
  const pixelCount = w * h;
  const gray = new Float32Array(pixelCount);
  const sat = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const r = data[off]!;
    const g = data[off + 1]!;
    const b = data[off + 2]!;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }

  const smooth = fastBlur(gray, w, h);
  const mag = fastSobel(smooth, w, h);
  const blurry = checkBlurry(gray, w, h);

  const grayOtsu = fastOtsu(smooth);
  const satOtsu = Math.max(16, fastOtsu(sat));

  const candidateMasks: Uint8Array[] = [];

  // Otsu threshold masks with hole-filling
  for (const multiplier of [0.98, 0.9, 1.08]) {
    const raw = new Uint8Array(pixelCount);
    const threshold = grayOtsu * multiplier;
    for (let i = 0; i < pixelCount; i++) {
      raw[i] = smooth[i]! >= threshold ? 1 : 0;
    }
    const closed = morphCloseSeparable(raw, w, h, 3);
    const filled = fillHolesAndConnectPaperFast(closed, w, h);
    candidateMasks.push(filled);
  }

  // Low-saturation mask for neutral paper
  {
    const raw = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      raw[i] = sat[i]! <= satOtsu && smooth[i]! > grayOtsu * 0.8 ? 1 : 0;
    }
    const closed = morphCloseSeparable(raw, w, h, 3);
    const filled = fillHolesAndConnectPaperFast(closed, w, h);
    candidateMasks.push(filled);
  }

  type ScoredCandidate = {
    quad: Quad;
    score: number;
    areaRatio: number;
  };

  const candidates: ScoredCandidate[] = [];

  for (const mask of candidateMasks) {
    const { boundary, area } = getPaperBoundaryFast(mask, w, h);
    const areaRatio = area / pixelCount;

    if (areaRatio > 0.82) {
      return {
        quad: FULL_QUAD(),
        confidence: 0.95,
        blurry,
        isConfident: true,
      };
    }

    if (areaRatio < 0.28 || boundary.length < 8) continue;

    const hull = convexHull(boundary);
    const quad = extract4SheetCorners(hull);
    if (!quad) continue;

    const score = scorePaperQuad(quad, smooth, mag, mask, w, h);
    if (score > 0) {
      candidates.push({ quad, score, areaRatio });
      // If we find a very confident match (> 0.85), early exit!
      if (score >= 0.85) break;
    }
  }

  if (candidates.length === 0) {
    return {
      quad: FULL_QUAD(),
      confidence: 0,
      blurry,
      isConfident: false,
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;

  let confidence = best.score;
  if (blurry) confidence *= 0.85;

  const isConfident = confidence >= CONFIDENCE_THRESHOLD;

  if (!isConfident) {
    return {
      quad: FULL_QUAD(),
      confidence: Math.min(1, confidence),
      blurry,
      isConfident: false,
    };
  }

  const normQuad = best.quad.map((c) => ({
    x: Math.max(0, Math.min(1, c.x / w)),
    y: Math.max(0, Math.min(1, c.y / h)),
  })) as Quad;

  const safePaddedQuad = padQuad(normQuad, 0.008);

  const touchesBorders = safePaddedQuad.filter(
    (c) => c.x <= 0.035 || c.x >= 0.965 || c.y <= 0.035 || c.y >= 0.965,
  ).length;

  if (touchesBorders >= 2 || best.areaRatio > 0.8) {
    return {
      quad: FULL_QUAD(),
      confidence: 0.95,
      blurry,
      isConfident: true,
    };
  }

  return {
    quad: safePaddedQuad,
    confidence: Math.min(1, confidence),
    blurry,
    isConfident: true,
  };
}

// Worker message handling (when running inside a Web Worker thread)
if (typeof self !== "undefined" && typeof (self as unknown as Worker).postMessage === "function") {
  self.onmessage = (
    e: MessageEvent<{ id: number; buffer: ArrayBuffer; width: number; height: number }>,
  ) => {
    const { id, buffer, width, height } = e.data;
    try {
      const data = new Uint8ClampedArray(buffer);
      const result = processDocumentPixels(data, width, height);
      (self as unknown as Worker).postMessage({ id, result, success: true });
    } catch {
      (self as unknown as Worker).postMessage({
        id,
        result: { quad: FULL_QUAD(), confidence: 0, blurry: false, isConfident: false },
        success: false,
      });
    }
  };
}
