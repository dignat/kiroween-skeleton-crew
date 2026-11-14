import type { Detection } from '@skeleton-playground/core';

/**
 * Poltergeist Detector core logic (task 15.1). Pure function, no I/O.
 *
 * Compares the objects detected in a "before" photo with those in an "after"
 * photo of the same place and reports what appeared, vanished, moved or stayed.
 *
 * Box coordinates are expected to be NORMALIZED to 0..1 (centre and size as a
 * fraction of image width/height), so centre-distance is comparable regardless
 * of image resolution. The scene loader (task 15.6) normalizes COCO-SSD's pixel
 * boxes before calling this. See the Spike E result in design.md: an unchanged
 * object drifts ~2.4%, so the default moveTolerance of 0.05 (5%) separates
 * "unchanged" from "moved" while absorbing camera jitter.
 */

export const DEFAULT_MOVE_TOLERANCE = 0.05;

export interface CompareScenesOptions {
  /**
   * Maximum normalized centre distance for a matched object to count as
   * "unchanged". Above this, a matched object is "moved". Default 0.05.
   */
  moveTolerance?: number | undefined;
}

/** One object present in both photos under the same label. */
export interface MatchedChange {
  label: string;
  /** Normalized centre distance between the before and after boxes (0 if either lacks a box). */
  drift: number;
  before: Detection;
  after: Detection;
}

export interface SceneComparison {
  /** In the after photo only — a new object (the poltergeist brought something). */
  appeared: Detection[];
  /** In the before photo only — an object is gone (the poltergeist took it). */
  vanished: Detection[];
  /** Matched in both, centre drift greater than moveTolerance. */
  moved: MatchedChange[];
  /** Matched in both, centre drift within moveTolerance. */
  unchanged: MatchedChange[];
}

/** Normalized centre of a detection's box, or null when it has no box. */
function centreOf(d: Detection): { cx: number; cy: number } | null {
  if (!d.box) return null;
  return { cx: d.box.x + d.box.width / 2, cy: d.box.y + d.box.height / 2 };
}

function centreDistance(a: Detection, b: Detection): number {
  const ca = centreOf(a);
  const cb = centreOf(b);
  // When either detection has no box (whole-image classifier), drift is not
  // measurable; treat it as 0 so a same-label match counts as unchanged.
  if (!ca || !cb) return 0;
  return Math.hypot(ca.cx - cb.cx, ca.cy - cb.cy);
}

/**
 * Greedily match before/after detections within each label by nearest centre.
 *
 * For each label we repeatedly take the closest available before/after pair.
 * Greedy nearest-pair matching is stable and good enough here: scenes have a
 * handful of objects per label, and Spike E showed detections are sparse.
 */
export function compareScenes(
  before: readonly Detection[],
  after: readonly Detection[],
  options: CompareScenesOptions = {},
): SceneComparison {
  const moveTolerance = options.moveTolerance ?? DEFAULT_MOVE_TOLERANCE;

  const appeared: Detection[] = [];
  const vanished: Detection[] = [];
  const moved: MatchedChange[] = [];
  const unchanged: MatchedChange[] = [];

  // Group indices by label so we only ever match same-label objects.
  const labels = new Set<string>([...before.map((d) => d.label), ...after.map((d) => d.label)]);

  for (const label of labels) {
    const befores = before.filter((d) => d.label === label);
    const afters = after.filter((d) => d.label === label);

    const usedAfter = new Set<number>();
    const matchedBefore = new Set<number>();

    // Build all candidate pairs for this label, sorted by centre distance.
    const pairs: Array<{ bi: number; ai: number; dist: number }> = [];
    befores.forEach((b, bi) => {
      afters.forEach((a, ai) => {
        pairs.push({ bi, ai, dist: centreDistance(b, a) });
      });
    });
    pairs.sort((p, q) => p.dist - q.dist);

    // Greedily accept the closest pair whose endpoints are both still free.
    for (const { bi, ai, dist } of pairs) {
      if (matchedBefore.has(bi) || usedAfter.has(ai)) continue;
      matchedBefore.add(bi);
      usedAfter.add(ai);
      const change: MatchedChange = { label, drift: dist, before: befores[bi]!, after: afters[ai]! };
      if (dist > moveTolerance) moved.push(change);
      else unchanged.push(change);
    }

    // Leftovers: a before with no partner vanished; an after with no partner appeared.
    befores.forEach((b, bi) => {
      if (!matchedBefore.has(bi)) vanished.push(b);
    });
    afters.forEach((a, ai) => {
      if (!usedAfter.has(ai)) appeared.push(a);
    });
  }

  return { appeared, vanished, moved, unchanged };
}
