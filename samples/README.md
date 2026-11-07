# Sample Images

All images in this folder are **original photos taken by the project author** with a phone camera. No stock photos, logos, brands, or images from other sources are stored here.

There are two sets:

## Set 1 — fridge / pantry photos (Witch's Pantry)

Four original photos, each with rotated copies (`-rot90`, `-rot180`, `-rot270`) — the same photo turned, not separate scenes, useful for checking that detection handles orientation.

| File | Subject |
|---|---|
| `fridge-salad-drawer.jpg` | Salad drawer of a fridge: leaves, carrots, bananas, tomatoes |
| `potatoes-in-pan.jpg` | Boiled potatoes in a pan |
| `freezer-chicken.jpg` | Freezer drawer with chicken breasts and frozen vegetables |
| `freezer-blurry.jpg` | Deliberately blurry freezer shot, to see how detection behaves on a poor photo |

## Set 2 — before / after pairs (Poltergeist Detector)

Pairs of the same scene photographed from the same spot, with objects moved or removed between the two shots, used to test `compare_scenes`:

| Before | After | Scene |
|---|---|---|
| `before_apple.jpg` | `after_apple.jpg` | a table with fruit and a mug |
| `before_one_apple.jpg` | `after_one_apple.jpg` | a single apple on a table |
| `before_tomatoes.jpg` | `after_tomatoes.jpg` | tomatoes and a cucumber on a board |

## Preparation

- Photos were shrunk on the long side and camera metadata was removed.
- Any brand names, logos, barcodes or printed labels on packaging were pixelated, and the camera's corner stamp was cropped off. This is why some areas look blocky.
- Please check any new photo for visible brands, logos or people before adding it here.
