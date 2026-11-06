// The Witch's Pantry web UI entry point (task 20). Framework-free TypeScript.
// Wires image detection, editable ingredient chips, and recipe suggestions,
// all running in the browser.

import { Detector, MobileNetFoodAdapter, UnsupportedImageError } from '@skeleton-crew/core';
import type { DetectorImageInput } from '@skeleton-crew/core';
import { createBrowserImageDecoder, fileToDetectorInput } from './browser-image-decoder.js';
import { FOOD_LABELS } from './food-labels.js';
import { normalizeIngredients, normalizeIngredient } from './ingredient-map.js';
import { recipes } from './recipes.js';
import { suggestRecipes } from './suggest-recipes.js';
import { drawDetections, drawImageToCanvas } from './ui/draw-overlay.js';
import { renderChips, renderQuickAdd } from './ui/render-chips.js';
import { renderRecipes } from './ui/render-recipes.js';

// --- Common ingredients offered as quick-add, drawn from the dataset ---
const QUICK_ADD = [
  'onion',
  'garlic',
  'tomato',
  'potato',
  'carrot',
  'egg',
  'cheese',
  'butter',
  'rice',
  'pasta',
  'mushroom',
  'chicken',
];

// --- Grab elements once ---
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const dropzone = $<HTMLDivElement>('dropzone');
const fileInput = $<HTMLInputElement>('file-input');
const fileError = $<HTMLParagraphElement>('file-error');
const statusEl = $<HTMLParagraphElement>('status');
const preview = $<HTMLElement>('preview');
const overlay = $<HTMLCanvasElement>('overlay');
const detectionSummary = $<HTMLElement>('detection-summary');
const chipsEl = $<HTMLUListElement>('chips');
const addForm = $<HTMLFormElement>('add-form');
const addInput = $<HTMLInputElement>('add-input');
const quickAddEl = $<HTMLUListElement>('quick-add');
const recipesEl = $<HTMLUListElement>('recipes');
const recipeCount = $<HTMLParagraphElement>('recipe-count');

// --- State: the ingredient list is the single source of truth ---
const ingredients: string[] = [];

// --- Detector (lazy; the model loads on first use) ---
const decodeImage = createBrowserImageDecoder();
const detector = new Detector(
  new MobileNetFoodAdapter({ decodeImage, allowedLabels: FOOD_LABELS }),
);

// --- Rendering ---
function refresh(): void {
  const have = new Set(ingredients);
  renderChips(chipsEl, ingredients, removeIngredient);
  renderQuickAdd(quickAddEl, QUICK_ADD, have, addIngredient);
  const matches = suggestRecipes(ingredients, recipes);
  renderRecipes(recipesEl, recipeCount, matches);
}

function addIngredient(raw: string): void {
  const name = normalizeIngredient(raw) ?? raw.trim().toLowerCase();
  if (name.length === 0 || ingredients.includes(name)) return;
  ingredients.push(name);
  refresh();
}

function removeIngredient(name: string): void {
  const i = ingredients.indexOf(name);
  if (i >= 0) {
    ingredients.splice(i, 1);
    refresh();
  }
}

function setError(message: string | null): void {
  if (message) {
    fileError.textContent = message;
    fileError.hidden = false;
  } else {
    fileError.textContent = '';
    fileError.hidden = true;
  }
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

// --- Detection flow ---
async function handleFile(file: File): Promise<void> {
  setError(null);

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    setError('Please choose a JPEG or PNG image.');
    return;
  }

  setStatus('Peering into the cauldron… loading the model and reading your photo.');

  let input: DetectorImageInput;
  try {
    input = await fileToDetectorInput(file);
  } catch {
    setStatus('');
    setError('Could not read that file. Try another image.');
    return;
  }
  // fileToDetectorInput always returns a base64 input; guard so TS can narrow.
  if (input.kind !== 'base64') {
    setError('Could not read that file. Try another image.');
    return;
  }
  const dataUrl = `data:${input.mimeType};base64,${input.data}`;

  // Show the image on the canvas immediately.
  const img = new Image();
  img.onload = () => {
    preview.hidden = false;
    drawImageToCanvas(overlay, img);
  };
  img.src = dataUrl;

  try {
    const detections = await detector.detect(input);
    // Redraw image then overlay (image may have finished loading by now).
    if (img.complete) drawImageToCanvas(overlay, img);
    drawDetections(overlay, detections);

    const found = normalizeIngredients(detections.map((d) => d.label));
    if (found.length === 0) {
      setStatus('No ingredients recognized. Add them by hand below, or try a clearer photo.');
      detectionSummary.textContent = 'No ingredients were detected in the image.';
    } else {
      let added = 0;
      for (const name of found) {
        if (!ingredients.includes(name)) {
          ingredients.push(name);
          added += 1;
        }
      }
      setStatus(
        `Found ${found.length} possible ingredient${found.length === 1 ? '' : 's'}: ${found.join(
          ', ',
        )}. Please check them below.`,
      );
      detectionSummary.textContent = `Detected ${found.join(', ')}. Added ${added} to your ingredients.`;
      refresh();
    }
  } catch (error) {
    const message =
      error instanceof UnsupportedImageError
        ? error.message
        : 'Something went wrong while reading the image. You can still add ingredients by hand.';
    setStatus('');
    setError(message);
  }
}

// --- Events ---
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

// Dropzone: click and keyboard open the file picker; drag-and-drop loads a file.
dropzone.addEventListener('click', (e) => {
  // Don't double-trigger when the label's own input is clicked.
  if ((e.target as HTMLElement).closest('.file-button')) return;
  fileInput.click();
});
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addIngredient(addInput.value);
  addInput.value = '';
  addInput.focus();
});

// --- Initial render ---
refresh();
