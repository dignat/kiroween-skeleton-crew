// Turns a potion's dominant curse into a playful tip (task 26.1). The wording
// rule (design.md, Requirement 14.12): talk about ingredients and amounts only,
// never about weight, bodies, or calorie restriction.

import { dominantCurse } from '../nutrition-math.js';
import type { Nutrition } from '../types.js';

export function curseTip(nutrition: Nutrition): string | null {
  switch (dominantCurse(nutrition)) {
    case 'sodium':
      return 'Lots of salt in this one. Try half the salty ingredients and finish with a squeeze of lemon.';
    case 'saturatedFat':
      return 'Rich with butter, cream or cheese. Ease off one of them, or swap in a lighter dairy.';
    case 'addedSugar':
      return 'Quite sweet. Cut the sugar or honey a little and lean on the fruit for sweetness.';
    default:
      return null;
  }
}
