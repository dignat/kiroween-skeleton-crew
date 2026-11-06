// Maps detector labels and common synonyms to the normalized ingredient names
// the recipes use (task 19.2). Browser-safe. Shaped by Spike C: detection is a
// helper, so this is forgiving and errs toward a sensible normalized name.

/**
 * synonym -> normalized ingredient name. Keys are lower-cased on lookup, so list
 * them in lower case. Includes COCO-SSD food labels, MobileNet-style classifier
 * labels, plurals, and everyday varietal names (for example "granny smith").
 */
const SYNONYMS: Record<string, string> = {
  // apples
  apple: 'apple',
  apples: 'apple',
  'granny smith': 'apple',
  'green apple': 'apple',
  'red apple': 'apple',
  // oranges / citrus
  orange: 'orange',
  oranges: 'orange',
  mandarin: 'orange',
  clementine: 'orange',
  lemon: 'lemon',
  lemons: 'lemon',
  lime: 'lime',
  // bananas
  banana: 'banana',
  bananas: 'banana',
  // tomato
  tomato: 'tomato',
  tomatoes: 'tomato',
  'cherry tomato': 'tomato',
  'plum tomato': 'tomato',
  // onion / allium
  onion: 'onion',
  onions: 'onion',
  'spring onion': 'onion',
  scallion: 'onion',
  shallot: 'onion',
  garlic: 'garlic',
  'garlic clove': 'garlic',
  // potato
  potato: 'potato',
  potatoes: 'potato',
  // carrot
  carrot: 'carrot',
  carrots: 'carrot',
  // peppers
  pepper: 'pepper',
  peppers: 'pepper',
  'bell pepper': 'pepper',
  capsicum: 'pepper',
  chili: 'chili',
  chilli: 'chili',
  'chili pepper': 'chili',
  jalapeno: 'chili',
  // brassicas / greens
  broccoli: 'broccoli',
  cauliflower: 'cauliflower',
  cabbage: 'cabbage',
  'head cabbage': 'cabbage',
  spinach: 'spinach',
  lettuce: 'lettuce',
  // cucurbits
  cucumber: 'cucumber',
  zucchini: 'zucchini',
  courgette: 'zucchini',
  pumpkin: 'pumpkin',
  squash: 'pumpkin',
  aubergine: 'aubergine',
  eggplant: 'aubergine',
  // mushrooms
  mushroom: 'mushroom',
  mushrooms: 'mushroom',
  // dairy / eggs
  egg: 'egg',
  eggs: 'egg',
  cheese: 'cheese',
  cheddar: 'cheese',
  parmesan: 'cheese',
  mozzarella: 'cheese',
  butter: 'butter',
  milk: 'milk',
  cream: 'cream',
  yogurt: 'yogurt',
  yoghurt: 'yogurt',
  // proteins
  chicken: 'chicken',
  beef: 'beef',
  'minced beef': 'beef',
  'ground beef': 'beef',
  steak: 'beef',
  bacon: 'bacon',
  // pantry / grains
  rice: 'rice',
  pasta: 'pasta',
  spaghetti: 'pasta',
  noodle: 'noodle',
  noodles: 'noodle',
  bread: 'bread',
  flour: 'flour',
  oat: 'oat',
  oats: 'oat',
  // legumes
  bean: 'bean',
  beans: 'bean',
  chickpea: 'chickpea',
  chickpeas: 'chickpea',
  pea: 'pea',
  peas: 'pea',
};

/**
 * Normalizes one label or typed ingredient to the name recipes use.
 * Returns null when the label is not food we know (for example "plate", "person"),
 * so callers can drop non-ingredient detections.
 */
export function normalizeIngredient(label: string): string | null {
  const key = label.trim().toLowerCase();
  if (key.length === 0) return null;
  return SYNONYMS[key] ?? null;
}

/** Normalizes a list of labels, dropping unknowns and de-duplicating, order preserved. */
export function normalizeIngredients(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const name = normalizeIngredient(label);
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
