// Renders the standalone Cauldron Calculator view (nutrition-calculator
// feature). Framework-free TypeScript, matching the chip/recipe renderers.
//
// The calculator shows total and per-serving nutrition for a list of
// ingredient rows, and — only when the user types their own targets — each
// amount as a percentage of those targets. It never supplies target values.

import {
  calculateTotals,
  NUTRIENT_KEYS,
  percentOfTargets,
  type CalculatorIngredient,
  type UserTargets,
  type NutrientKey,
} from '../nutrition-calculator.js';
import type { Nutrition, NutritionTable } from '../types.js';

/** A row in the calculator: an ingredient name and grams the user can edit. */
export interface CalculatorRow {
  name: string;
  grams: number;
}

/**
 * How the calculator sources its ingredients:
 * - 'synced'   rows mirror the pantry list (names read-only, grams editable)
 * - 'separate' a free scratchpad the user edits directly
 */
export type CalculatorMode = 'synced' | 'separate';

export interface CalculatorState {
  mode: CalculatorMode;
  /** Rows used in 'separate' mode (the free scratchpad). */
  rows: CalculatorRow[];
  servings: number;
  targets: UserTargets;
  /**
   * Remembered grams per ingredient name, so switching modes or changing the
   * pantry does not wipe amounts the user already set. Defaults to 100 g for a
   * name not seen before.
   */
  gramsByName: Record<string, number>;
}

/** Default grams for an ingredient the user has not weighed yet. */
const DEFAULT_GRAMS = 100;

/** The rows the calculator should show, given its mode and the pantry list. */
function rowsForMode(state: CalculatorState, pantry: readonly string[]): CalculatorRow[] {
  if (state.mode === 'synced') {
    return pantry.map((name) => ({
      name,
      grams: state.gramsByName[name] ?? DEFAULT_GRAMS,
    }));
  }
  return state.rows;
}

/** Display metadata for each nutrient: a label and its unit. */
const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protein', unit: 'g' },
  carbs: { label: 'Carbs', unit: 'g' },
  fat: { label: 'Fat', unit: 'g' },
  satFat: { label: 'Saturated fat', unit: 'g' },
  fibre: { label: 'Fibre', unit: 'g' },
  sodiumMg: { label: 'Sodium', unit: 'mg' },
  addedSugar: { label: 'Added sugar', unit: 'g' },
};

const round1 = (x: number): number => Math.round(x * 10) / 10;

function amountCell(key: NutrientKey, n: Nutrition): string {
  const unit = NUTRIENT_META[key].unit;
  const value = key === 'kcal' || key === 'sodiumMg' ? Math.round(n[key]) : round1(n[key]);
  return `${value} ${unit}`;
}

/**
 * Render the whole calculator into `root`.
 *
 * `pantry` is the current pantry ingredient list, used when the mode is
 * 'synced'. `onChange` is called whenever the user edits anything (the caller
 * re-renders) — state is mutated in place.
 */
export function renderCalculator(
  root: HTMLElement,
  state: CalculatorState,
  pantry: readonly string[],
  table: NutritionTable,
  onChange: () => void,
): void {
  root.replaceChildren();

  const synced = state.mode === 'synced';

  // --- Mode selector ---
  const modeWrap = document.createElement('div');
  modeWrap.className = 'calc-mode';
  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Ingredients';
  const modeSelect = document.createElement('select');
  const syncedOpt = document.createElement('option');
  syncedOpt.value = 'synced';
  syncedOpt.textContent = 'Synced with pantry';
  const separateOpt = document.createElement('option');
  separateOpt.value = 'separate';
  separateOpt.textContent = 'Separate list';
  modeSelect.append(syncedOpt, separateOpt);
  modeSelect.value = state.mode;
  modeSelect.addEventListener('change', () => {
    state.mode = modeSelect.value === 'separate' ? 'separate' : 'synced';
    onChange();
  });
  modeLabel.append(modeSelect);
  modeWrap.append(modeLabel);

  const modeHint = document.createElement('p');
  modeHint.className = 'hint';
  modeHint.textContent = synced
    ? 'These follow your pantry list. Edit the names in the Pantry view; set the amount in grams here.'
    : 'A separate list, independent of your pantry. Add, remove and edit rows freely.';
  modeWrap.append(modeHint);

  // --- Ingredient rows ---
  const rows = rowsForMode(state, pantry);
  const rowsWrap = document.createElement('div');
  rowsWrap.className = 'calc-rows';

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = synced
      ? 'Your pantry is empty. Add ingredients in the Pantry view, or switch to a separate list.'
      : 'No ingredients yet. Add one below to start calculating.';
    rowsWrap.append(empty);
  }

  rows.forEach((row, index) => {
    const line = document.createElement('div');
    line.className = 'calc-row';

    if (synced) {
      // Read-only name: the pantry owns it. Shown as text, not an input.
      const nameText = document.createElement('span');
      nameText.className = 'calc-name';
      nameText.textContent = row.name;
      line.append(nameText);
    } else {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = row.name;
      nameInput.placeholder = 'ingredient';
      nameInput.setAttribute('aria-label', `Ingredient name for row ${index + 1}`);
      nameInput.addEventListener('input', () => {
        row.name = nameInput.value.trim().toLowerCase();
        onChange();
      });
      line.append(nameInput);
    }

    const gramsInput = document.createElement('input');
    gramsInput.type = 'number';
    gramsInput.min = '0';
    gramsInput.step = '10';
    gramsInput.value = String(row.grams);
    gramsInput.setAttribute('aria-label', `Grams for ${row.name || `row ${index + 1}`}`);
    gramsInput.addEventListener('input', () => {
      const n = Number(gramsInput.value);
      const grams = Number.isFinite(n) && n >= 0 ? n : 0;
      if (synced) {
        // Remember the amount against the name so it survives a pantry change.
        state.gramsByName[row.name] = grams;
      } else {
        row.grams = grams;
      }
      onChange();
    });

    const gramsUnit = document.createElement('span');
    gramsUnit.className = 'calc-unit';
    gramsUnit.textContent = 'g';

    line.append(gramsInput, gramsUnit);

    if (!synced) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'calc-remove';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `Remove row ${index + 1}`);
      remove.addEventListener('click', () => {
        state.rows.splice(index, 1);
        onChange();
      });
      line.append(remove);
    }

    rowsWrap.append(line);
  });

  // Add-ingredient is only for the separate scratchpad; synced follows the pantry.
  const addRow = document.createElement('button');
  addRow.type = 'button';
  addRow.className = 'calc-add';
  addRow.textContent = '+ Add ingredient';
  addRow.hidden = synced;
  addRow.addEventListener('click', () => {
    state.rows.push({ name: '', grams: DEFAULT_GRAMS });
    onChange();
  });

  // --- Servings ---
  const servingsWrap = document.createElement('div');
  servingsWrap.className = 'calc-servings';
  const servingsLabel = document.createElement('label');
  servingsLabel.textContent = 'Servings';
  const servingsInput = document.createElement('input');
  servingsInput.type = 'number';
  servingsInput.min = '1';
  servingsInput.step = '1';
  servingsInput.value = String(state.servings);
  servingsInput.addEventListener('input', () => {
    const n = Number(servingsInput.value);
    state.servings = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    onChange();
  });
  servingsLabel.append(servingsInput);
  servingsWrap.append(servingsLabel);

  // --- Compute (from the mode-aware rows, not state.rows directly) ---
  const ingredients: CalculatorIngredient[] = rows
    .filter((r) => r.name.length > 0)
    .map((r) => ({ name: r.name, grams: r.grams }));
  const totals = calculateTotals(ingredients, table, state.servings);

  // --- Totals table ---
  const table1 = document.createElement('table');
  table1.className = 'calc-table';
  table1.innerHTML =
    '<thead><tr><th scope="col">Nutrient</th><th scope="col">Total</th><th scope="col">Per serving</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const key of NUTRIENT_KEYS) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = NUTRIENT_META[key].label;
    const totalTd = document.createElement('td');
    totalTd.textContent = amountCell(key, totals.total);
    const perTd = document.createElement('td');
    perTd.textContent = amountCell(key, totals.perServing);
    tr.append(th, totalTd, perTd);
    tbody.append(tr);
  }
  table1.append(tbody);

  // --- Missing-data notice ---
  const notices: HTMLElement[] = [];
  if (totals.missing.length > 0) {
    const notice = document.createElement('p');
    notice.className = 'calc-missing';
    notice.setAttribute('role', 'status');
    notice.textContent = `No nutrition data for: ${totals.missing.join(', ')}. These were not counted.`;
    notices.push(notice);
  }

  // --- Your targets ---
  const targetsSection = document.createElement('div');
  targetsSection.className = 'calc-targets';
  const targetsHeading = document.createElement('h3');
  targetsHeading.textContent = 'Your daily targets (optional)';
  const targetsHint = document.createElement('p');
  targetsHint.className = 'hint';
  targetsHint.textContent =
    'Enter your own numbers to see each total as a percentage of them. Leave blank to skip. These are your numbers, not a recommendation.';
  targetsSection.append(targetsHeading, targetsHint);

  const targetsGrid = document.createElement('div');
  targetsGrid.className = 'calc-targets-grid';
  for (const key of NUTRIENT_KEYS) {
    const label = document.createElement('label');
    label.textContent = `${NUTRIENT_META[key].label} (${NUTRIENT_META[key].unit})`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.placeholder = '—';
    const current = state.targets[key];
    if (current !== undefined) input.value = String(current);
    input.addEventListener('input', () => {
      const n = Number(input.value);
      if (input.value.trim() === '' || !Number.isFinite(n) || n <= 0) {
        delete state.targets[key];
      } else {
        state.targets[key] = n;
      }
      onChange();
    });
    label.append(input);
    targetsGrid.append(label);
  }
  targetsSection.append(targetsGrid);

  // --- Percentage-of-target bars (only when targets are set) ---
  const totalPercents = percentOfTargets(totals.total, state.targets);
  const perServingPercents = percentOfTargets(totals.perServing, state.targets);
  if (totalPercents.length > 0) {
    const bars = document.createElement('div');
    bars.className = 'calc-bars';
    const barsHeading = document.createElement('h3');
    barsHeading.textContent = 'Percentage of your targets';
    bars.append(barsHeading);

    for (const entry of totalPercents) {
      const perServing = perServingPercents.find((p) => p.nutrient === entry.nutrient);
      const meta = NUTRIENT_META[entry.nutrient];

      const barRow = document.createElement('div');
      barRow.className = 'calc-bar-row';

      const label = document.createElement('span');
      label.className = 'calc-bar-label';
      label.textContent = `${meta.label}: ${entry.percent}% of ${entry.target} ${meta.unit}`;

      const track = document.createElement('div');
      track.className = 'calc-bar-track';
      track.setAttribute('role', 'img');
      track.setAttribute(
        'aria-label',
        `${meta.label}: ${entry.percent} percent of your target${perServing ? `, ${perServing.percent} percent per serving` : ''}`,
      );
      const fill = document.createElement('div');
      fill.className = 'calc-bar-fill';
      fill.style.width = `${Math.min(entry.percent, 100)}%`;
      track.append(fill);

      barRow.append(label, track);
      bars.append(barRow);
    }
    notices.push(bars);
  }

  // --- Disclaimer ---
  const disclaimer = document.createElement('p');
  disclaimer.className = 'disclaimer';
  disclaimer.textContent =
    'This calculator adds up standard nutrition values for the amounts you enter. Percentages are of the targets you type in. It is a calculation, not medical or dietary advice.';

  root.append(
    modeWrap,
    rowsWrap,
    addRow,
    servingsWrap,
    table1,
    ...notices,
    targetsSection,
    disclaimer,
  );
}
