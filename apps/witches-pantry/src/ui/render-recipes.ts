// Renders recipe cards (task 20.5). Each card shows matched vs missing
// ingredients and the steps. Shows an empty state when nothing matches (6.12).

import type { RecipeMatch } from '../types.js';

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
