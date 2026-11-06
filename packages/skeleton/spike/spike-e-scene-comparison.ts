/**
 * Spike E: scene comparison on real photos (blocks task 15).
 *
 * Runs COCO-SSD on before/after photo pairs and measures:
 *  1. Does it find the same objects in both photos of an unchanged scene?
 *  2. How far do box centres drift between two photos of the (nearly) same scene?
 *  3. Does a moved object keep its label?
 *
 * The drift measured on the SMALLEST real change in each pair sets the floor
 * for the default `moveTolerance` used by task 15's compareScenes.
 *
 * Run with:
 *   node --import tsx packages/skeleton/spike/spike-e-scene-comparison.ts
 *
 * Expects before/after JPEG pairs in ./samples. Pairs are matched by the
 * stem after stripping a leading before/after token.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as jpeg from 'jpeg-js';

const SAMPLES_DIR = './samples';
const MIN_CONFIDENCE = Number(process.env.MIN_CONF ?? 0.5);

// ---------------------------------------------------------------------------
// Image loading (JPEG only for this spike; the real photos are all .jpg)
// ---------------------------------------------------------------------------

function loadJpeg(filePath: string): { data: Buffer; width: number; height: number } {
  const raw = fs.readFileSync(filePath);
  const { data, width, height } = jpeg.decode(raw, { useTArray: false, maxMemoryUsageInMB: 1024 });
  return { data: data as unknown as Buffer, width, height };
}

// ---------------------------------------------------------------------------
// Detection types and a normalized box-centre
// ---------------------------------------------------------------------------

interface Det {
  label: string;
  score: number;
  // normalized centre (0..1) so drift is comparable across image sizes
  cx: number;
  cy: number;
}

async function detect(
  model: cocoSsd.ObjectDetection,
  filePath: string,
): Promise<{ dets: Det[]; width: number; height: number; ms: number }> {
  const { data, width, height } = loadJpeg(filePath);
  const t0 = performance.now();
  const preds = await model.detect({ data, width, height } as unknown as ImageData);
  const ms = performance.now() - t0;
  const dets: Det[] = preds
    .filter(p => p.score >= MIN_CONFIDENCE)
    .map(p => {
      const [x, y, w, h] = p.bbox;
      return {
        label: p.class,
        score: p.score,
        cx: (x + w / 2) / width,
        cy: (y + h / 2) / height,
      };
    });
  return { dets, width, height, ms };
}

// ---------------------------------------------------------------------------
// Match detections between two frames, per label, by nearest centre
// ---------------------------------------------------------------------------

function dist(a: Det, b: Det): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

interface MatchResult {
  matched: Array<{ label: string; drift: number }>;
  appeared: Det[]; // in after only
  vanished: Det[]; // in before only
}

/** Greedy nearest-centre matching within each label. */
function matchScenes(before: Det[], after: Det[]): MatchResult {
  const matched: Array<{ label: string; drift: number }> = [];
  const usedAfter = new Set<number>();
  const vanished: Det[] = [];

  // Group after-indices by label for quick lookup.
  for (const b of before) {
    let bestIdx = -1;
    let bestDist = Infinity;
    after.forEach((a, i) => {
      if (usedAfter.has(i) || a.label !== b.label) return;
      const d = dist(a, b);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx >= 0) {
      usedAfter.add(bestIdx);
      matched.push({ label: b.label, drift: bestDist });
    } else {
      vanished.push(b);
    }
  }

  const appeared = after.filter((_, i) => !usedAfter.has(i));
  return { matched, appeared, vanished };
}

// ---------------------------------------------------------------------------
// Pair discovery
// ---------------------------------------------------------------------------

/** Strip a leading before/after token and normalize separators to find the pair stem. */
function stemOf(fileName: string): { role: 'before' | 'after' | null; stem: string } {
  const base = fileName.replace(/\.jpe?g$/i, '');
  const m = base.match(/^(before|after)[-_](.+)$/i);
  if (!m) return { role: null, stem: base };
  const role = m[1].toLowerCase() as 'before' | 'after';
  const stem = m[2].toLowerCase();
  return { role, stem };
}

function findPairs(dir: string): Array<{ stem: string; before: string; after: string }> {
  const files = fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f));
  const befores = new Map<string, string>();
  const afters = new Map<string, string>();
  for (const f of files) {
    const { role, stem } = stemOf(f);
    if (role === 'before') befores.set(stem, f);
    else if (role === 'after') afters.set(stem, f);
  }
  const pairs: Array<{ stem: string; before: string; after: string }> = [];
  for (const [stem, before] of befores) {
    const after = afters.get(stem);
    if (after) pairs.push({ stem, before: path.join(dir, before), after: path.join(dir, after) });
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  const pairs = findPairs(SAMPLES_DIR);
  if (pairs.length === 0) {
    console.error(`[spike-e] No before/after JPEG pairs found in ${SAMPLES_DIR}.`);
    console.error(`          Expected files like before-coffee.jpg / after_coffee.jpg`);
    process.exit(1);
  }

  console.error(`[spike-e] Found ${pairs.length} before/after pair(s)`);
  console.error('[spike-e] Loading COCO-SSD model…');
  const model = await cocoSsd.load();

  console.log(`\n=== Spike E: scene comparison (COCO-SSD, pure-JS CPU, min conf ${MIN_CONFIDENCE}) ===\n`);

  const allMatchedDrifts: number[] = [];

  for (const pair of pairs) {
    const b = await detect(model, pair.before);
    const a = await detect(model, pair.after);
    const { matched, appeared, vanished } = matchScenes(b.dets, a.dets);

    console.log(`Pair: ${pair.stem}`);
    console.log(`  before (${path.basename(pair.before)}): ${b.dets.length} objects — ${b.dets.map(d => d.label).join(', ') || '(none)'}`);
    console.log(`  after  (${path.basename(pair.after)}): ${a.dets.length} objects — ${a.dets.map(d => d.label).join(', ') || '(none)'}`);
    console.log(`  matched (same label, nearest centre): ${matched.length}`);
    for (const m of matched) {
      console.log(`    - ${m.label.padEnd(16)} centre drift: ${(m.drift * 100).toFixed(1)}% of image diagonal-ish`);
      allMatchedDrifts.push(m.drift);
    }
    console.log(`  vanished (before only): ${vanished.map(d => d.label).join(', ') || '(none)'}`);
    console.log(`  appeared (after only):  ${appeared.map(d => d.label).join(', ') || '(none)'}`);
    console.log('');
  }

  // --- Drift stats across all matched objects ---
  if (allMatchedDrifts.length > 0) {
    const sorted = [...allMatchedDrifts].sort((x, y) => x - y);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const p90 = sorted[Math.floor(sorted.length * 0.9)];

    console.log('Matched-object centre drift (normalized 0..1):');
    console.log(`  count : ${sorted.length}`);
    console.log(`  min   : ${(min * 100).toFixed(1)}%`);
    console.log(`  median: ${(median * 100).toFixed(1)}%`);
    console.log(`  mean  : ${(mean * 100).toFixed(1)}%`);
    console.log(`  p90   : ${(p90 * 100).toFixed(1)}%`);
    console.log(`  max   : ${(max * 100).toFixed(1)}%`);

    console.log('\nThreshold guidance:');
    console.log(`  An object is "unchanged" if its centre drift is below moveTolerance.`);
    console.log(`  To absorb camera jitter on an unchanged object, set moveTolerance just above`);
    console.log(`  the small end of the drift seen when nothing really moved. A moved object should`);
    console.log(`  land well above it. Inspect the per-pair lines to pick the gap.`);
    console.log(`  Suggested starting moveTolerance: ${(Math.max(0.05, p90 * 0.5) * 100).toFixed(0)}% (tune against the pairs above).`);
  } else {
    console.log('No matched objects across any pair — COCO-SSD labels differ too much to measure drift.');
    console.log('Fallback (per design.md): compare counts per label only (appeared / vanished, no "moved").');
  }
}

run().catch(err => {
  console.error('[spike-e] Fatal:', err);
  process.exit(1);
});
