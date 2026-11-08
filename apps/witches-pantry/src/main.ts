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
import { renderCalculator, type CalculatorState } from './ui/render-calculator.js';
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
const clearAllButton = $<HTMLButtonElement>('clear-all');
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

// Names added by the most recent image detection. A new image replaces these
// (its ingredients belong to it), while ingredients the user added by hand or
// via quick-add are kept. Restored ingredients from a previous session start
// as "not from this image", so the first upload clears none of them.
let detectedIngredients: string[] = [];

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
  // Offer "Start over" only when there is something to clear.
  clearAllButton.hidden = ingredients.length === 0 && preview.hidden;
  // Keep a visible, pantry-synced calculator in step with pantry edits.
  onPantryChanged();
}

// Assigned by the calculator wiring below; a no-op until then. Lets the pantry
// refresh re-render the calculator when it is showing in synced mode.
let onPantryChanged: () => void = () => {};

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
    // Stop tracking it as a detected name, so a later image doesn't try to
    // re-clear something the user already removed.
    const d = detectedIngredients.indexOf(name);
    if (d >= 0) detectedIngredients.splice(d, 1);
    refresh();
  }
}

// Fresh start: clear the image preview, every ingredient (detected and manual),
// the detection tracking, and the saved list. The separate calculator list is a
// deliberate scratchpad, so it is left alone; the synced calculator empties with
// the pantry.
function clearAll(): void {
  ingredients.length = 0;
  detectedIngredients = [];
  preview.hidden = true;
  const ctx = overlay.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  detectionSummary.textContent = '';
  setStatus('');
  setError(null);
  // Let the same file be chosen again right after clearing.
  fileInput.value = '';
  refresh();
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
      // A new image replaces the previous image's detections. Remove only the
      // names the last detection added (and that the user hasn't since made
      // their own by, say, re-adding) — manual and quick-add ingredients stay.
      const newlyDetected = new Set(relevance.ingredients);
      for (const name of detectedIngredients) {
        if (!newlyDetected.has(name)) {
          const i = ingredients.indexOf(name);
          if (i >= 0) ingredients.splice(i, 1);
        }
      }

      let added = 0;
      for (const name of relevance.ingredients) {
        if (!ingredients.includes(name)) {
          ingredients.push(name);
          added += 1;
        }
      }
      detectedIngredients = [...relevance.ingredients];

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

clearAllButton.addEventListener('click', () => clearAll());

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

// --- The Cauldron Calculator: a standalone view (nutrition-calculator feature) ---
const pantryView = $<HTMLDivElement>('pantry-view');
const calculatorView = $<HTMLDivElement>('calculator-view');
const navPantry = $<HTMLButtonElement>('nav-pantry');
const navCalculator = $<HTMLButtonElement>('nav-calculator');
const calculatorEl = $<HTMLDivElement>('calculator');

// The calculator has two modes: 'synced' mirrors the pantry ingredient list
// (names read-only, grams editable), 'separate' is a free scratchpad. It opens
// synced so it starts from what you already have.
const calculatorState: CalculatorState = {
  mode: 'synced',
  rows: [{ name: '', grams: 100 }],
  servings: 1,
  targets: {},
  gramsByName: {},
};

function refreshCalculator(): void {
  renderCalculator(calculatorEl, calculatorState, ingredients, nutritionTable, refreshCalculator);
}

// When the pantry changes, re-render the calculator if it is showing and in
// synced mode (so its rows track the pantry live). No-op otherwise.
onPantryChanged = () => {
  if (!calculatorView.hidden && calculatorState.mode === 'synced') {
    refreshCalculator();
  }
};

function showView(view: 'pantry' | 'calculator'): void {
  const isPantry = view === 'pantry';
  pantryView.hidden = !isPantry;
  calculatorView.hidden = isPantry;
  navPantry.classList.toggle('is-active', isPantry);
  navCalculator.classList.toggle('is-active', !isPantry);
  navPantry.setAttribute('aria-pressed', String(isPantry));
  navCalculator.setAttribute('aria-pressed', String(!isPantry));
  if (!isPantry) refreshCalculator();
}

navPantry.addEventListener('click', () => showView('pantry'));
navCalculator.addEventListener('click', () => showView('calculator'));

// --- Initial render ---
refresh();
