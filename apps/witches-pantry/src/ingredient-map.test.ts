import { describe, expect, it } from 'vitest';
import { normalizeIngredient, normalizeIngredients } from './ingredient-map.js';

describe('normalizeIngredient (Requirement 6.6, 6.7)', () => {
  it('maps varietals and plurals to the normalized name', () => {
    expect(normalizeIngredient('Granny Smith')).toBe('apple');
    expect(normalizeIngredient('apples')).toBe('apple');
    expect(normalizeIngredient('tomatoes')).toBe('tomato');
    expect(normalizeIngredient('courgette')).toBe('zucchini');
    expect(normalizeIngredient('eggplant')).toBe('aubergine');
  });

  it('is case and whitespace insensitive', () => {
    expect(normalizeIngredient('  ONION  ')).toBe('onion');
  });

  it('returns null for non-food or unknown labels', () => {
    expect(normalizeIngredient('plate')).toBeNull();
    expect(normalizeIngredient('person')).toBeNull();
    expect(normalizeIngredient('')).toBeNull();
  });
});

describe('normalizeIngredients', () => {
  it('drops unknowns and de-duplicates, preserving order', () => {
    expect(normalizeIngredients(['tomatoes', 'plate', 'tomato', 'Granny Smith'])).toEqual([
      'tomato',
      'apple',
    ]);
  });
});
