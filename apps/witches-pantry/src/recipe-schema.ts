// Zod schema for the recipe dataset. Browser-safe (zod is environment-neutral).
// Used by the schema test (task 19.1) and by loadRecipes to validate the bundled
// JSON once at module load, so a malformed dataset fails loudly and early.

import { z } from 'zod';

/** Ingredient names are normalized: lower-case, and the matching key the app uses. */
export const recipeIngredientSchema = z.object({
  name: z.string().min(1),
  grams: z.number().positive(),
});

export const recipeSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'id must be kebab-case (lower-case letters, digits and hyphens)'),
  name: z.string().min(1),
  servings: z.number().int().positive(),
  ingredients: z.array(recipeIngredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  flavorText: z.string().min(1).optional(),
});

export const recipeDatasetSchema = z.array(recipeSchema).min(25);

export type RecipeParsed = z.infer<typeof recipeSchema>;
