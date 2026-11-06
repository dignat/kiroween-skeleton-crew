// Loads and validates the bundled recipe dataset. Browser-safe: the JSON is a
// static import, not a file read. The same module backs the web UI and the MCP
// tool, so there is exactly one copy of the data (design.md).

import rawRecipes from './data/recipes.json' with { type: 'json' };
import { recipeDatasetSchema } from './recipe-schema.js';
import type { Recipe } from './types.js';

/**
 * The validated recipe dataset. Parsing at module load means a malformed dataset
 * throws here, not deep inside the UI or an MCP call.
 */
export const recipes: Recipe[] = recipeDatasetSchema.parse(rawRecipes);
