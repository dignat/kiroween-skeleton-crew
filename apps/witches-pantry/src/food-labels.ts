// Allowlist of ImageNet labels the MobileNet food adapter keeps (Spike C).
// These are the whole-image classes that are actually food and that the model
// returns with usable confidence. Everything else (plate, tray, ...) is dropped.
// normalizeIngredient() then maps these to the names the recipes use.

export const FOOD_LABELS: readonly string[] = [
  'broccoli',
  'cauliflower',
  'cucumber',
  'zucchini',
  'bell pepper',
  'mushroom',
  'banana',
  'lemon',
  'orange',
  'strawberry',
  'pineapple',
  'head cabbage',
  'cardoon',
  'spaghetti squash',
  'butternut squash',
  'acorn squash',
  'corn',
  'artichoke',
];
