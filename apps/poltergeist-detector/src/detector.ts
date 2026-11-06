// Node-only. Builds the COCO-SSD detector and an image sizer shared by the CLI
// and the MCP server, so both surfaces detect identically (Requirements 5.10).

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { CocoSsdAdapter, Detector, type DetectorImageInput } from '@skeleton-crew/core';
import { createNodeImageDecoder } from '@skeleton-crew/core/node';
import type { ImageSizer } from './load-scenes.js';

/**
 * Creates a Detector backed by COCO-SSD, reading images only from `allowedRoot`.
 * The model loads once on first detect() and is reused (handled by Detector).
 */
export function createCocoDetector(allowedRoot: string): Detector {
  const decodeImage = createNodeImageDecoder({ allowedRoot });
  const adapter = new CocoSsdAdapter({ decodeImage });
  return new Detector(adapter);
}

/**
 * Reads an image's pixel dimensions from its header without decoding all pixels.
 * Used by the scene loader to normalize boxes. Supports JPEG and PNG, matching
 * the detector's accepted formats.
 */
export function createImageSizer(): ImageSizer {
  return async (input: DetectorImageInput): Promise<{ width: number; height: number }> => {
    if (input.kind !== 'filePath') {
      throw new Error('createImageSizer only supports file paths');
    }
    const bytes = await readFile(input.path);
    const ext = extname(input.path).toLowerCase();
    if (ext === '.png') return readPngSize(bytes);
    return readJpegSize(bytes);
  };
}

/** PNG stores width/height as big-endian uint32 at bytes 16..23 (IHDR). */
function readPngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24) throw new Error('PNG too small to read size');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Walk JPEG markers to the SOF segment, which holds height then width. */
function readJpegSize(bytes: Buffer): { width: number; height: number } {
  let offset = 2; // skip SOI (0xFFD8)
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1]!;
    // SOF0..SOF15 carry the frame size (skip DHT 0xC4, DNL 0xC8, DAC 0xCC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return { width, height };
    }
    // Otherwise skip this segment using its length field.
    const segmentLength = bytes.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  throw new Error('Could not find JPEG size marker');
}
