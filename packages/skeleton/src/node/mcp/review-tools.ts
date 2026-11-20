// Node-only. Two tools that let an agent act as a reviewer of detector output:
//   get_detections  returns the detections as structured JSON (id, class, score, box, image size)
//   submit_review   takes one verdict per detection and validates it, so a malformed or invented
//                   review comes back as an error the agent must fix and resubmit
// Validation lives here, in code, because a prompt cannot enforce a schema.
import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import type { Detection, Detector } from '../../detector/types.js';
import { defineTool } from './serve-app.js';
import type { AnyToolDefinition } from './serve-app.js';
import { jsonResult } from './results.js';
/** How many pending detection sets the server remembers. Older ones are forgotten first. */
const MAX_PENDING_REVIEWS = 20;
export const VERDICTS = ['confirmed', 'rejected', 'uncertain'] as const;
export type Verdict = (typeof VERDICTS)[number];
interface PendingReview {
  imagePath: string;
  ids: string[];
  /** Class label per detection id, kept so an app can relate accepted verdicts to ingredient names. */
  labels: Record<string, string>;
}
/** A review that submit_review accepted. */
export interface AcceptedReview {
  reviewId: string;
  imagePath: string;
  /** Verdict and class label for each reviewed detection. */
  items: { id: string; label: string; verdict: Verdict }[];
}
/** The review tools plus a way for an app tool to ask whether a review was accepted. */
export interface ReviewKit {
  /** get_detections and submit_review. Pass to an app server's `tools` list. */
  tools: AnyToolDefinition[];
  /** The accepted review for this id, or undefined if it is unknown, not yet accepted or forgotten. */
  getAcceptedReview(reviewId: string): AcceptedReview | undefined;
}
const getDetectionsInput = z.object({
  imagePath: z
    .string()
    .min(1)
    .describe('Path to a JPEG or PNG image. Relative paths are resolved inside the allowed images folder.'),
  minConfidence: z.number().min(0).max(1).optional().describe('Ignore detections below this confidence, from 0 to 1.'),
});
const reviewItem = z.object({
  id: z.string().min(1).describe('The detection id from get_detections, for example "d1".'),
  verdict: z.enum(VERDICTS).describe('confirmed, rejected, or uncertain. Use uncertain when the evidence does not decide it.'),
  evidence: z
    .string()
    .min(1)
    .max(300)
    .describe('What you can see in the data first: the box size, position, image size and the other detections.'),
  reason: z.string().min(1).max(200).describe('One short sentence giving the verdict, based on the evidence.'),
});
const submitReviewInput = z.object({
  reviewId: z.string().min(1).describe('The reviewId returned by get_detections.'),
  items: z.array(reviewItem).describe('Exactly one item per detection id, no more and no less.'),
});
/** Everything wrong with a submitted review, as plain sentences. Empty when it is valid. */
export function reviewProblems(expectedIds: readonly string[], items: readonly { id: string }[]): string[] {
  const problems: string[] = [];
  const expected = new Set(expectedIds);
  const seen = new Set<string>();
  for (const { id } of items) {
    if (!expected.has(id)) problems.push(`Unknown detection id "${id}". Only review detections that get_detections returned.`);
    else if (seen.has(id)) problems.push(`Detection id "${id}" appears more than once.`);
    seen.add(id);
  }
  const missing = expectedIds.filter((id) => !seen.has(id));
  if (missing.length > 0) problems.push(`Missing a verdict for: ${missing.join(', ')}.`);
  return problems;
}
function toWire(detection: Detection, id: string) {
  return {
    id,
    class: detection.label,
    score: detection.confidence,
    // null for whole-image classifiers, which have no box.
    box: detection.box ?? null,
  };
}
/** Forget the oldest entries once a map holds more than `max`. */
function trim<V>(map: Map<string, V>, max: number): void {
  while (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}
/**
 * Builds get_detections and submit_review for one detector, and a lookup for accepted reviews, so an
 * app tool can require one. Pending and accepted reviews are kept in memory, so a review is checked
 * against exactly what get_detections returned.
 */
export function createReviewKit(detector: Detector): ReviewKit {
  const pending = new Map<string, PendingReview>();
  const accepted = new Map<string, AcceptedReview>();
  const getDetections = defineTool({
    name: 'get_detections',
    description:
      'Run the detector on an image and return its detections as structured JSON: a reviewId, the image size in ' +
      'pixels, and for each detection an id, class, score (0 to 1, not calibrated) and box {x, y, width, height} in ' +
      'pixels (null for whole-image classifiers). Use this before submit_review.',
    inputSchema: getDetectionsInput,
    handler: async (input) => {
      const image = { kind: 'filePath' as const, path: input.imagePath };
      const options = input.minConfidence === undefined ? {} : { minConfidence: input.minConfidence };
      const info = detector.detectWithInfo
        ? await detector.detectWithInfo(image, options)
        : { detections: await detector.detect(image, options) };
      const wire = info.detections.map((d, i) => toWire(d, `d${i + 1}`));
      const reviewId = randomUUID();
      pending.set(reviewId, {
        imagePath: input.imagePath,
        ids: wire.map((w) => w.id),
        labels: Object.fromEntries(wire.map((w) => [w.id, w.class])),
      });
      trim(pending, MAX_PENDING_REVIEWS);
      return jsonResult({
        reviewId,
        imagePath: input.imagePath,
        imageSize: ('imageSize' in info ? info.imageSize : undefined) ?? null,
        detections: wire,
      });
    },
  });
  const submitReview = defineTool({
    name: 'submit_review',
    description:
      'Submit your review of the detections from get_detections: one item per detection id, each with a verdict ' +
      '(confirmed, rejected or uncertain), the evidence you based it on, and a short reason. The review is checked: ' +
      'an unknown id, a duplicate, a missing detection or a malformed item returns an error that lists what to fix. ' +
      'Correct it and call submit_review again with the same reviewId.',
    inputSchema: submitReviewInput,
    handler: async (input) => {
      const review = pending.get(input.reviewId);
      if (!review) {
        throw new Error('Unknown reviewId. Call get_detections first and use the reviewId it returns.');
      }
      const problems = reviewProblems(review.ids, input.items);
      if (problems.length > 0) {
        throw new Error(`Review rejected. Fix these and call submit_review again with the same reviewId:\n- ${problems.join('\n- ')}`);
      }
      pending.delete(input.reviewId);
      accepted.set(input.reviewId, {
        reviewId: input.reviewId,
        imagePath: review.imagePath,
        items: input.items.map((i) => ({ id: i.id, label: review.labels[i.id] ?? '', verdict: i.verdict })),
      });
      trim(accepted, MAX_PENDING_REVIEWS);
      const counts = { confirmed: 0, rejected: 0, uncertain: 0 };
      for (const item of input.items) counts[item.verdict] += 1;
      return jsonResult({ accepted: true, imagePath: review.imagePath, counts, items: input.items });
    },
  });
  return { tools: [getDetections, submitReview], getAcceptedReview: (reviewId) => accepted.get(reviewId) };
}
/** Just the two tools, for apps that do not need to require a review elsewhere. */
export function createReviewTools(detector: Detector): AnyToolDefinition[] {
  return createReviewKit(detector).tools;
}
