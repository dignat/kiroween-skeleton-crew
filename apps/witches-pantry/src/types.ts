// The Witch's Pantry data model. Browser-safe: no Node imports.
// Shapes follow design.md. Nutrition fields on RecipeMatch stay optional until
// the stretch nutrition work (Requirement 14, Phase 6) fills them in.

export interface RecipeIngredient {
  /** Normalized, lower-case ingredient name, for example "onion". */
  name: string;
  /** Amount in grams, used later by the nutrition feature. */
  grams: number;
}

export interface Recipe {
  /** Stable kebab-case id, for example "midnight-marrow-broth". */
  id: string;
  /** Display name, themed as a potion. */
  name: string;
  /** Number of servings the amounts make. */
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Short atmospheric blurb shown on the card. */
  flavorText?: string | undefined;
}

/** Per-serving (or per-100 g, for table entries) nutrition values. */
export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  satFat: number;
  fibre: number;
  sodiumMg: number;
  addedSugar: number;
}

/** One ingredient's per-100 g nutrition, with its data source. */
export interface NutritionEntry extends Nutrition {
  /** Where the values came from, for example "USDA FDC". */
  source: string;
}

/** Per-100 g nutrition keyed by normalized ingredient name. */
export type NutritionTable = Record<string, NutritionEntry>;

export type Purity = 'Pure' | 'Murky' | 'Cursed';

export interface RecipeMatch {
  recipe: Recipe;
  /** Ingredient names the user has that this recipe uses. */
  matched: string[];
  /** Ingredient names this recipe needs that the user does not have. */
  missing: string[];
  /** Filled in by Phase 6 (nutrition / Curse Level). */
  nutrition?: Nutrition;
  curseLevel?: number;
  purity?: Purity;
}

/**
 * Dietary preference filters (a user choice, not advice). Each is an objective
 * property of a recipe computed from its ingredients and per-serving nutrition:
 * - 'vegetarian'    no meat, poultry or fish ingredients
 * - 'lowerSugar'    added sugar per serving at or below a threshold
 * - 'lowerSodium'   sodium per serving at or below a threshold
 * - 'higherFibre'   fibre per serving at or above a threshold
 * - 'higherProtein' protein per serving at or above a threshold
 * - 'lighter'       calories per serving at or below a threshold
 */
export type DietaryFilter =
  | 'vegetarian'
  | 'lowerSugar'
  | 'lowerSodium'
  | 'higherFibre'
  | 'higherProtein'
  | 'lighter';

export interface SuggestOptions {
  /** 'match' (default) sorts by matched count; 'purity' sorts by Curse Level ascending. */
  sortBy?: 'match' | 'purity';
  /**
   * When provided, each match is enriched with per-serving nutrition, Curse Level
   * and purity, and 'purity' sorting becomes available (Requirement 14). Omit it
   * and the core name-only matching runs unchanged.
   */
  nutritionTable?: NutritionTable | undefined;
  /**
   * Dietary preference filters applied before sorting (all must pass, AND). They
   * describe the recipes, they are not dietary advice. 'vegetarian' works from
   * ingredient names alone; the nutrition-based filters need `nutritionTable`.
   */
  filters?: readonly DietaryFilter[] | undefined;
}
