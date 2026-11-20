import { describe, expect, it } from 'vitest';
import type { Detection, Detector } from '../../detector/types.js';
import { createAppServer } from './serve-app.js';
import { reviewProblems, createReviewKit } from './review-tools.js';
import { connectClient, textOf } from './test-helpers.js';
const detections: Detection[] = [
  { label: 'cup', confidence: 0.9, box: { x: 1, y: 2, width: 30, height: 40 } },
  { label: 'bowl', confidence: 0.4, box: { x: 5, y: 6, width: 70, height: 20 } },
];
const detector: Detector = {
  async detect() {
    return detections;
  },
  async detectWithInfo() {
    return { detections, imageSize: { width: 640, height: 480 } };
  },
};
const item = (id: string, verdict = 'confirmed') => ({ id, verdict, evidence: 'box is 30x40 px of 640x480', reason: 'plausible size' });
const text = (r: unknown) => textOf(r as { content: unknown[] });
async function setup(d: Detector = detector) {
  const kit = createReviewKit(d);
  const server = createAppServer({ name: 'app', version: '1.0.0', detector: d, tools: kit.tools });
  const client = await connectClient(server);
  const got = await client.callTool({ name: 'get_detections', arguments: { imagePath: 'a.jpg' } });
  return { client, got: JSON.parse(text(got)), kit };
}
describe('get_detections', () => {
  it('returns ids, class, score, box and the image size', async () => {
    const { got } = await setup();
    expect(got.imageSize).toEqual({ width: 640, height: 480 });
    expect(got.detections).toEqual([
      { id: 'd1', class: 'cup', score: 0.9, box: { x: 1, y: 2, width: 30, height: 40 } },
      { id: 'd2', class: 'bowl', score: 0.4, box: { x: 5, y: 6, width: 70, height: 20 } },
    ]);
    expect(typeof got.reviewId).toBe('string');
  });
  it('returns imageSize null and box null when the detector reports neither', async () => {
    const { got } = await setup({ async detect() { return [{ label: 'banana', confidence: 0.8 }]; } });
    expect(got.imageSize).toBeNull();
    expect(got.detections[0].box).toBeNull();
  });
});
describe('submit_review', () => {
  it('accepts a complete review and counts the verdicts', async () => {
    const { client, got } = await setup();
    const result = await client.callTool({
      name: 'submit_review',
      arguments: { reviewId: got.reviewId, items: [item('d1'), item('d2', 'uncertain')] },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result)).counts).toEqual({ confirmed: 1, rejected: 0, uncertain: 1 });
  });
  it('rejects an unknown id, a duplicate and a missing verdict, then accepts the corrected retry', async () => {
    const { client, got } = await setup();
    const bad = await client.callTool({
      name: 'submit_review',
      arguments: { reviewId: got.reviewId, items: [item('d1'), item('d1'), item('d9')] },
    });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toMatch(/Unknown detection id "d9"/);
    expect(text(bad)).toMatch(/"d1" appears more than once/);
    expect(text(bad)).toMatch(/Missing a verdict for: d2/);
    const retry = await client.callTool({
      name: 'submit_review',
      arguments: { reviewId: got.reviewId, items: [item('d1', 'rejected'), item('d2')] },
    });
    expect(retry.isError).toBeFalsy();
  });
  it('rejects an invalid verdict or an empty evidence through the schema', async () => {
    const { client, got } = await setup();
    const badVerdict = await client.callTool({
      name: 'submit_review',
      arguments: { reviewId: got.reviewId, items: [item('d1', 'maybe'), item('d2')] },
    });
    expect(badVerdict.isError).toBe(true);
    const noEvidence = await client.callTool({
      name: 'submit_review',
      arguments: { reviewId: got.reviewId, items: [{ ...item('d1'), evidence: '' }, item('d2')] },
    });
    expect(noEvidence.isError).toBe(true);
  });
  it('rejects an unknown reviewId and a reviewId that was already accepted', async () => {
    const { client, got } = await setup();
    const unknown = await client.callTool({ name: 'submit_review', arguments: { reviewId: 'nope', items: [] } });
    expect(unknown.isError).toBe(true);
    await client.callTool({ name: 'submit_review', arguments: { reviewId: got.reviewId, items: [item('d1'), item('d2')] } });
    const again = await client.callTool({ name: 'submit_review', arguments: { reviewId: got.reviewId, items: [item('d1'), item('d2')] } });
    expect(again.isError).toBe(true);
  });
  it('accepts an empty review when there are no detections', async () => {
    const empty: Detector = { async detect() { return []; } };
    const { client, got } = await setup(empty);
    const result = await client.callTool({ name: 'submit_review', arguments: { reviewId: got.reviewId, items: [] } });
    expect(result.isError).toBeFalsy();
  });
});
describe('getAcceptedReview', () => {
  it('is undefined until the review is accepted, then returns the verdicts with their labels', async () => {
    const { client, got, kit } = await setup();
    expect(kit.getAcceptedReview(got.reviewId)).toBeUndefined();
    await client.callTool({ name: 'submit_review', arguments: { reviewId: got.reviewId, items: [item('d1'), item('d2', 'rejected')] } });
    expect(kit.getAcceptedReview(got.reviewId)?.items).toEqual([
      { id: 'd1', label: 'cup', verdict: 'confirmed' },
      { id: 'd2', label: 'bowl', verdict: 'rejected' },
    ]);
    expect(kit.getAcceptedReview('nope')).toBeUndefined();
  });
  it('stays undefined after a rejected submission', async () => {
    const { client, got, kit } = await setup();
    await client.callTool({ name: 'submit_review', arguments: { reviewId: got.reviewId, items: [item('d1')] } });
    expect(kit.getAcceptedReview(got.reviewId)).toBeUndefined();
  });
});
describe('reviewProblems', () => {
  it('is empty for an exact match in any order', () => {
    expect(reviewProblems(['d1', 'd2'], [{ id: 'd2' }, { id: 'd1' }])).toEqual([]);
  });
});
