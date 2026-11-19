import type { Detection } from './types.js';
/**
 * A rule about which labels make sense together in one image. The skeleton knows no scenes, so a
 * scene is described by the labels that signal it, for example an oven and a sink for a kitchen.
 */
export interface ContextRule {
  /** Label or labels the rule applies to. */
  label: string | readonly string[];
  /** Drop the label when any of these labels is present, for example boat when an oven is present. */
  dropWhenPresent?: readonly string[];
  /** Keep the label only when any of these labels is present, for example surfboard only with a person. */
  keepOnlyWhenPresent?: readonly string[];
  /** Only detections at or above this confidence count as evidence. Default 0 (any detection counts). */
  evidenceMinConfidence?: number;
}
function isPresent(evidence: readonly Detection[], labels: readonly string[], minConfidence: number): boolean {
  return evidence.some((e) => e.confidence >= minConfidence && labels.includes(e.label));
}
/**
 * Applies context rules to one image's Detections. Every rule is checked against the same input
 * list, not against the output of earlier rules, so the result does not depend on rule order.
 * A detection is dropped when any rule that targets its label says so. Labels no rule targets are kept.
 * Pure function: does not mutate the input array.
 */
export function filterByContext(detections: readonly Detection[], rules: readonly ContextRule[]): Detection[] {
  if (rules.length === 0) return [...detections];
  return detections.filter((d) =>
    rules.every((rule) => {
      const targets = typeof rule.label === 'string' ? [rule.label] : rule.label;
      if (!targets.includes(d.label)) return true;
      const minEvidence = rule.evidenceMinConfidence ?? 0;
      if (rule.dropWhenPresent && isPresent(detections, rule.dropWhenPresent, minEvidence)) return false;
      if (rule.keepOnlyWhenPresent && !isPresent(detections, rule.keepOnlyWhenPresent, minEvidence)) return false;
      return true;
    }),
  );
}
