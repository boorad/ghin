---
'@spicygolf/ghin': patch
---

Fix the `score_type` label for the `C` letter: it now transforms to `'COMPETITION'` instead of `'COMBINED'`.

Per the 2020 USGA World Handicap System ([Rule 4g](https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/Committee%20Content/USGA/LG_R4g.htm)), `C` designates a Competition score. The `'COMBINED'` label was a pre-2020 holdover and never matched what the letter means today.

**Consumers matching on `'COMBINED'` will need to switch to `'COMPETITION'`.** The published `ScoreType` union no longer includes `'COMBINED'`, so a check like `score.score_type === 'COMBINED'` stops compiling under `strict`. **Superseded by #66, in this same unreleased window:** `T` does not map to `'TOURNAMENT'` either. UAT shows `T` is the letter GHIN actually emits for Competition rows, so it now maps to `'COMPETITION'` alongside `C`, and `'TOURNAMENT'` has left the `ScoreType` union entirely. See the #66 changeset for the evidence and the migration note.
