// The Witch's Pantry web UI entry point (task 20). Framework-free TypeScript.
// Wires image detection, editable ingredient chips, and recipe suggestions,
// all running in the browser.

import { Detector, MobileNetFoodAdapter, UnsupportedImageError } from '@skeleton-crew/core';
import type { DetectorImageInput } from '@skeleton-crew/core';
import { createBrowserImageDecoder, fileToDetectorInput } from './browser-image-decoder.js';
import { FOOD_LABELS } from './food-labels.js';
import { describeFilters } from './dietary-filters.js';
import { assessFoodRelevance } from './food-relevance.js';
import { normalizeIngredient } from './ingredient-map.js';
import { nutritionTable } from './nutrition.js';
import { recipes } from './recipes.js';
import { suggestRecipes } from './suggest-recipes.js';
import type { DietaryFilter } from './types.js';

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
const sortRadios = document.querySelectorAll<HTMLInputElement>('input[name="sort"]');
const filterBoxes = document.querySelectorAll<HTMLInputElement>('input[name="filter"]');
const filterDesc = $<HTMLParagraphElement>('filter-desc');

// --- State: the ingredient list is the single source of truth ---
// Vibe-coded extra (task 31, not in the spec): remember the pantry across reloads
// via localStorage, so a refresh doesn't wipe what you added.
const STORAGE_KEY = 'witches-pantry:ingredients';

function loadSavedIngredients(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveIngredients(list: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors (private mode, quota): persistence is a nicety.
  }
}

const ingredients: string[] = loadSavedIngredients();
let sortBy: 'match' | 'purity' = 'match';
let filters: DietaryFilter[] = [];

// --- Detector (lazy; the model loads on first use) ---
const decodeImage = createBrowserImageDecoder();
const detector = new Detector(
  // warmUp primes the browser's WebGL backend so the first detection doesn't
  // stall on shader compilation (helps WebGL, not the Node CPU backend).
  new MobileNetFoodAdapter({ decodeImage, allowedLabels: FOOD_LABELS, warmUp: true }),
);

// --- Rendering ---
function refresh(): void {
  const have = new Set(ingredients);
  renderChips(chipsEl, ingredients, removeIngredient);
  renderQuickAdd(quickAddEl, QUICK_ADD, have, addIngredient);
  // Pass the nutrition table so cards get a Curse Level, purity and the tip,
  // and so "Purest first" can sort by it (Phase 6). Dietary filters narrow the
  // list by recipe properties — a choice, not advice.
  const matches = suggestRecipes(ingredients, recipes, { sortBy, nutritionTable, filters });
  renderRecipes(recipesEl, recipeCount, matches);
  filterDesc.textContent = describeFilters(filters);
  // Persist on every change (vibe-coded, task 31).
  saveIngredients(ingredients);
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

    // Food-relevance gate: the same shared check the check_image MCP tool uses.
    // This is a relevance check (is this a food photo?), not content moderation.
    const relevance = assessFoodRelevance(detections);
    if (!relevance.isFood) {
      setStatus(relevance.message);
      detectionSummary.textContent = relevance.message;
    } else {
      let added = 0;
      for (const name of relevance.ingredients) {
        if (!ingredients.includes(name)) {
          ingredients.push(name);
          added += 1;
        }
      }
      setStatus(relevance.message);
      detectionSummary.textContent = `Detected ${relevance.ingredients.join(', ')}. Added ${added} to your ingredients.`;
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

// Sort toggle: "Best match" vs "Purest first".
for (const radio of sortRadios) {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      sortBy = radio.value === 'purity' ? 'purity' : 'match';
      refresh();
    }
  });
}

// Dietary filters: recompute the selected set and re-run on any change.
for (const box of filterBoxes) {
  box.addEventListener('change', () => {
    filters = Array.from(filterBoxes)
      .filter((b) => b.checked)
      .map((b) => b.value as DietaryFilter);
    refresh();
  });
}

// --- Initial render ---
refresh();
