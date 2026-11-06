import type { SceneComparison } from './compare-scenes.js';

/**
 * Report formatter (task 15.5). Pure functions: turn a SceneComparison into a
 * human-readable "haunting report" or a stable JSON structure. No I/O.
 */

export interface HauntingReport {
  appeared: Array<{ label: string; confidence: number }>;
  vanished: Array<{ label: string; confidence: number }>;
  moved: Array<{ label: string; drift: number }>;
  unchanged: Array<{ label: string }>;
  /** True when neither photo had any detections at all. */
  nothingDetected: boolean;
}

/** Structured output for `--json` and the compare_scenes MCP tool. */
export function toReport(comparison: SceneComparison): HauntingReport {
  const nothingDetected =
    comparison.appeared.length === 0 &&
    comparison.vanished.length === 0 &&
    comparison.moved.length === 0 &&
    comparison.unchanged.length === 0;

  return {
    appeared: comparison.appeared.map((d) => ({ label: d.label, confidence: d.confidence })),
    vanished: comparison.vanished.map((d) => ({ label: d.label, confidence: d.confidence })),
    moved: comparison.moved.map((m) => ({ label: m.label, drift: m.drift })),
    unchanged: comparison.unchanged.map((m) => ({ label: m.label })),
    nothingDetected,
  };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Human-readable "haunting report" for the terminal. */
export function formatHauntingReport(comparison: SceneComparison): string {
  const report = toReport(comparison);
  const lines: string[] = [];

  lines.push('👻 Haunting report');
  lines.push('');

  if (report.nothingDetected) {
    lines.push('  Nothing was detected in either photo.');
    lines.push('  Try photos where the objects are large and clearly separated,');
    lines.push('  taken from the same spot. (The detector only knows COCO classes.)');
    return lines.join('\n');
  }

  const quiet =
    report.appeared.length === 0 && report.vanished.length === 0 && report.moved.length === 0;
  if (quiet) {
    lines.push('  The spirits are calm. Nothing appeared, vanished or moved.');
    if (report.unchanged.length > 0) {
      lines.push(`  ${report.unchanged.length} object(s) stayed put: ${report.unchanged.map((u) => u.label).join(', ')}`);
    }
    return lines.join('\n');
  }

  if (report.appeared.length > 0) {
    lines.push(`  ✨ Appeared (${report.appeared.length}):`);
    for (const a of report.appeared) lines.push(`     - ${a.label} (${pct(a.confidence)})`);
  }
  if (report.vanished.length > 0) {
    lines.push(`  🕳️  Vanished (${report.vanished.length}):`);
    for (const v of report.vanished) lines.push(`     - ${v.label} (${pct(v.confidence)})`);
  }
  if (report.moved.length > 0) {
    lines.push(`  ↔️  Moved (${report.moved.length}):`);
    for (const m of report.moved) lines.push(`     - ${m.label} (drifted ${pct(m.drift)})`);
  }
  if (report.unchanged.length > 0) {
    lines.push(`  ⚓ Unchanged (${report.unchanged.length}): ${report.unchanged.map((u) => u.label).join(', ')}`);
  }

  return lines.join('\n');
}

/** JSON string for `--json`. */
export function formatJson(comparison: SceneComparison): string {
  return JSON.stringify(toReport(comparison), null, 2);
}
