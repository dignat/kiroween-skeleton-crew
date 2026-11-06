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

/** Per-serving nutrition, filled in by the stretch nutrition work (Phase 6). */
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

export interface SuggestOptions {
  /** 'match' (default) sorts by matched count; 'purity' is added in Phase 6. */
  sortBy?: 'match' | 'purity';
}
