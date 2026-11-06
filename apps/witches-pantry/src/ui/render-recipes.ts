// Renders recipe cards (task 20.5). Each card shows matched vs missing
// ingredients and the steps. Shows an empty state when nothing matches (6.12).
// With nutrition present (Phase 6, task 26.1) it also shows a potion meter,
// a per-serving nutrition list, and a tip.

import type { Nutrition, RecipeMatch } from '../types.js';
import { curseTip } from './curse-tip.js';

function ingredientLine(cls: string, label: string, names: string[]): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = `ingredient-line ${cls}`;
  const strong = document.createElement('span');
  strong.className = 'label';
  strong.textContent = `${label}: `;
  p.append(strong);
  if (names.length === 0) {
    const none = document.createElement('span');
    none.textContent = '—';
    p.append(none);
  } else {
    names.forEach((name, i) => {
      const span = document.createElement('span');
      span.className = 'ing';
      span.textContent = name;
      p.append(span);
      if (i < names.length - 1) p.append(document.createTextNode(', '));
    });
  }
  return p;
}

const PURITY_CLASS: Record<string, string> = {
  Pure: 'purity-pure',
  Murky: 'purity-murky',
  Cursed: 'purity-cursed',
};

/** A potion-bottle meter that fills with the Curse Level. The number and label
 *  are also shown as text, so meaning never depends on colour alone (14.9). */
function potionMeter(level: number, purity: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = `potion-meter ${PURITY_CLASS[purity] ?? ''}`;

  // Fill height as a fraction of a 100-unit bottle body.
  const fillHeight = Math.max(0, Math.min(100, level));
  const svg = `
    <svg viewBox="0 0 40 100" class="potion-bottle" role="img"
         aria-label="Curse Level ${level} out of 100, ${purity}">
      <rect x="15" y="2" width="10" height="10" rx="2" class="bottle-neck" />
      <rect x="8" y="12" width="24" height="84" rx="8" class="bottle-body" />
      <clipPath id="clip-${Math.round(level)}-${purity}">
        <rect x="8" y="12" width="24" height="84" rx="8" />
      </clipPath>
      <rect x="8" y="${12 + (84 - (84 * fillHeight) / 100)}" width="24"
            height="${(84 * fillHeight) / 100}" class="bottle-fill"
            clip-path="url(#clip-${Math.round(level)}-${purity})" />
    </svg>`;
  const svgWrap = document.createElement('div');
  svgWrap.innerHTML = svg;
  wrap.append(svgWrap.firstElementChild as SVGElement);

  const text = document.createElement('p');
  text.className = 'potion-meter-label';
  text.innerHTML = `<strong>Curse Level ${level}</strong> / 100 &middot; ${purity}`;
  wrap.append(text);

  return wrap;
}

const NUTRIENT_ROWS: Array<[keyof Nutrition, string, string]> = [
  ['kcal', 'Calories', ''],
  ['protein', 'Protein', ' g'],
  ['carbs', 'Carbs', ' g'],
  ['fat', 'Fat', ' g'],
  ['satFat', 'Saturated fat', ' g'],
  ['fibre', 'Fibre', ' g'],
  ['sodiumMg', 'Sodium', ' mg'],
  ['addedSugar', 'Added sugar', ' g'],
];

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** A per-serving nutrition list (14.9). */
function nutritionList(nutrition: Nutrition): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'nutrition';
  const h4 = document.createElement('h4');
  h4.textContent = 'Per serving';
  wrap.append(h4);
  const dl = document.createElement('dl');
  for (const [key, label, unit] of NUTRIENT_ROWS) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const value = key === 'kcal' || key === 'sodiumMg' ? Math.round(nutrition[key]) : round1(nutrition[key]);
    dd.textContent = `${value}${unit}`;
    dl.append(dt, dd);
  }
  wrap.append(dl);
  return wrap;
}

function recipeCard(match: RecipeMatch): HTMLLIElement {
  const { recipe, matched, missing } = match;
  const li = document.createElement('li');
  const card = document.createElement('article');
  card.className = 'recipe-card';

  const h3 = document.createElement('h3');
  h3.textContent = recipe.name;
  card.append(h3);

  if (recipe.flavorText) {
    const flavor = document.createElement('p');
    flavor.className = 'flavor';
    flavor.textContent = recipe.flavorText;
    card.append(flavor);
  }

  // A screen-reader friendly summary of the match.
  const summary = document.createElement('p');
  summary.className = 'visually-hidden';
  summary.textContent = `${recipe.name}: you have ${matched.length} of ${
    matched.length + missing.length
  } ingredients.`;
  card.append(summary);

  card.append(ingredientLine('matched-list', 'You have', matched));
  card.append(ingredientLine('missing-list', 'You still need', missing));

  // Nutrition block (Phase 6): meter, per-serving list, and a tip (task 26.1).
  if (match.nutrition && match.curseLevel !== undefined && match.purity) {
    const nutritionWrap = document.createElement('div');
    nutritionWrap.className = 'potion-stats';
    nutritionWrap.append(potionMeter(match.curseLevel, match.purity));
    nutritionWrap.append(nutritionList(match.nutrition));
    card.append(nutritionWrap);

    const tip = curseTip(match.nutrition);
    if (tip) {
      const tipEl = document.createElement('p');
      tipEl.className = 'curse-tip';
      tipEl.textContent = `💡 ${tip}`;
      card.append(tipEl);
    }
  }

  const details = document.createElement('details');
  const summaryEl = document.createElement('summary');
  summaryEl.textContent = `How to brew (serves ${recipe.servings})`;
  details.append(summaryEl);
  const ol = document.createElement('ol');
  for (const step of recipe.steps) {
    const stepLi = document.createElement('li');
    stepLi.textContent = step;
    ol.append(stepLi);
  }
  details.append(ol);
  card.append(details);

  li.append(card);
  return li;
}

/** Renders the list of matches into the container, or an empty state. */
export function renderRecipes(
  container: HTMLUListElement,
  countEl: HTMLElement,
  matches: readonly RecipeMatch[],
): void {
  container.replaceChildren();

  if (matches.length === 0) {
    countEl.textContent = 'No potions match your ingredients yet. Add a few more above.';
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'The cauldron is quiet. Add ingredients and recipes will appear here.';
    container.append(li);
    return;
  }

  countEl.textContent = `${matches.length} potion${matches.length === 1 ? '' : 's'} you can brew, best match first.`;
  for (const match of matches) {
    container.append(recipeCard(match));
  }
}
