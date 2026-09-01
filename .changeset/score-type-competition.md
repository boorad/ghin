---
'@spicygolf/ghin': patch
---

Fix the `score_type` label for the `C` letter: it now transforms to `'COMPETITION'` instead of `'COMBINED'`.

Per the 2020 USGA World Handicap System ([Rule 4g](https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/Committee%20Content/USGA/LG_R4g.htm)), `C` designates a Competition score. The `'COMBINED'` label was a pre-2020 holdover and never matched what the letter means today.

**Consumers matching on `'COMBINED'` will need to switch to `'COMPETITION'`.** The published `ScoreType` union no longer includes `'COMBINED'`, so a check like `score.score_type === 'COMBINED'` stops compiling under `strict`. The legacy `T` → `'TOURNAMENT'` mapping is kept — GHIN still emits `T` on pre-2020 scores, and dropping it would reject real rows.
