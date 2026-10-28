# SADA Typography & Font Hierarchy — full reference

A copy of the matching permanent section of the SADA project `CLAUDE.md`, kept inside the
skill so the rules travel with it. If the project folder is available, `CLAUDE.md` is the
source of truth.

# PERMANENT TYPOGRAPHY & FONT HIERARCHY

**Applies to every SADA output — carousels, social posts, presentations, company profiles, PDFs,
brand documents, visual systems, diagrams, charts, editorial layouts.**

## T0 — The permanent rule

> **ZAIN IS THE PRIMARY SADA TYPEFACE. IT IS NOT THE ONLY ONE.**

Zain carries the brand voice. It does not carry every word. Setting an entire deck in Zain is not
art direction — it is autopilot, and it is the note that produced this section.

```
ZAIN        →  the primary voice: hooks, covers, short impactful statements, CTA headlines
THMANYAH    →  the reading default, in BOTH scripts: educational copy, body, explanations
BRAND CAPS  →  overlines, counters, index numbers, technical labels
LATIN       →  numbers, labels, UI, captions — the partner in every pairing
```

**Zain is never used for a paragraph.**

## T1 — The library and its roles

| Face | Weights | Role | Status |
|---|---|---|---|
| **Zain** · Arabic | 200 / 600 / 800 | Main headlines, hooks, cover slides, short impactful statements, CTA headlines. **Never long paragraphs** | embedded |
| **Thmanyah** · Arabic + Latin | 300 / 500 / 700 / 900 (the library lists 400; no file embedded) | Educational content, body, explanations, professional copy, long reading. **The reading default in both scripts** | embedded |
| **Felfel** · Arabic | 700 | Creative campaigns, emotional headlines, social covers, attention words. Sparingly | embedded |
| **Bein** · Arabic | — | Premium branding, corporate communication, elegant captions | **file pending** |
| **Montserrat** · Latin | default | Numbers, labels, UI, small text, captions. The partner face in every recommended pairing | **file pending** |
| **Moderniz** · brand | CAPS ONLY | Wordmark geometry. Overlines, counters, index numbers, technical labels. **Never Arabic, body copy, buttons or form labels** | **file pending** |
| **Anton** · Latin | 400 | Huge English headlines, strong emphasis only. Never paragraphs | **file pending** |
| **Bebas Neue** · Latin | — | Campaign titles, large numbers, short English words. Never body text | **file pending** |

Five of these have no font file in `assets/`. The carousel core base64-embeds its faces so a deck
renders identically offline and inside the PNG export — a face that is not embedded falls back
silently and the export ships in the wrong font. Until the files arrive, `--font-latin` and
`--font-brand` both resolve to **Thmanyah**, which carries Latin as well as Arabic. That substitution
is the one knowing deviation from the design system, and it is marked in the core.

**To fix it:** drop the files into the skill's `assets/`, add them to `_FACES`, and the two tokens
pick them up with no other change.

## T2 — Face by slide category

Identify the category before choosing a face. This table is the rule, not a suggestion:

| Category | Headline face | Support | Why |
|---|---|---|---|
| **Hook** | Zain 800 | Latin 500 | Stops the scroll in three words |
| **Educational** | Thmanyah Bold | Thmanyah Light body | Built for long reading, not for shouting |
| **Comparison** | Thmanyah Black | Latin 600 labels | One face keeps both columns neutral |
| **Framework** | Thmanyah Bold | brand caps `STEP 01` | Numbered steps need a technical label face |
| **Statistics** | condensed numerals | Thmanyah Light caption | Condensed numerals read big at small sizes |
| **CTA** | Zain 800 | Latin 600 button | Same voice as the hook, closing the loop |

## T3 — Mixing rules

**Never more than two font families in one slide.** The recommended pairings:

```
Zain + Latin        Thmanyah + Latin      Felfel + Latin
Bein + Latin        Anton + Latin (EN only)     Bebas Neue + Latin (EN only)
```

Not acceptable: Zain + Thmanyah + Felfel + a fourth, all competing on one slide. Default is
**Zain + one supporting family**; two Arabic families plus one Latin only in exceptional cases.

## T4 — Hierarchy comes from size, not from family

Build hierarchy from **size · weight · width · spacing · colour · position.** Family changes are
secondary. A typical slide: Zain Bold for the primary message, Thmanyah for the explanation, the
Latin face for a technical label. That is three roles and two families.

Do not switch family to fake a hierarchy that scale and weight should carry.

## T5 — Weights that actually exist

| Level | Zain | Thmanyah |
|---|---|---|
| Display / headline | **800** `.ar-disp` | **900** `.ar-black` · **700** `.ar-h` |
| Secondary | **600** `.ar-disp-m` | **500** `.ar-b` |
| Body / light | **200** `.ar-disp-l` | **300** `.ar-l` |

Requesting a weight a face does not ship — 400 or 700 from Zain, 400/600/800 from Thmanyah — makes
the browser synthesise it, and it smears in the PNG export.

> **Known gap.** Zain has no true Regular 400, which is one more reason paragraphs belong to
> Thmanyah rather than to Zain.

## T6 — Arabic is not a translation of the Latin setting

Sizes, line-height and measure are tuned separately, and these are hard rules:

- **Tracking is always 0 — never negative.**
- Headline line-height **1.28–1.45**, never below 1.25.
- Body line-height **1.45–1.65**; Arabic body runs **+2px larger and +0.2 looser** than its Latin
  counterpart.
- Paragraph measure caps at **56 characters**, not 72.
- Buttons gain 2px vertical padding to seat the taller ascenders.
- The brand caps face is uppercase-only: maximum three words per display line, 0.16–0.22em tracking,
  and never a full sentence.

## T7 — Zain's metrics, and why lines must be measured

Zain's isolated and final letterforms carry advances of **3.2–4.0 em** — ن alone is 3619 units on a
1000-unit em. Those long sweeping tails are what makes a SADA headline recognisable, and they mean
Zain needs roughly twice the horizontal room a Latin face would.

Consequences, both mandatory:

1. **Measure every display line against the 936px content width before setting its size.** Measure
   inside the built page, where the real embedded fonts are — a standalone harness loading the files
   over `file://` falls back to a system face and under-reports by about half.
2. **Give every hand-broken display line `white-space: nowrap`.** A line that silently wraps gets
   kashida-stretched by the renderer, which is what makes a headline look elongated and broken.
   `nowrap` turns that into a visible overflow the QC pass catches.

## T8 — Zain with Latin

Arabic in Zain or Thmanyah; Latin in the Latin face, wrapped so the bidi order stays correct. Latin
complements the Arabic rather than dominating it — unless the English word itself is the strategic
emphasis.

Terms that stay English because Tunisian professionals say them in English: Branding, Creative,
Digital, Marketing, Strategy, Content, Growth, Views, Reach, CTA, Conversion, Algorithm, DM, post.

Arabic stays visually dominant. Latin works as accent, category, technical term, metadata or
secondary label. Never alternate Arabic families inside a single sentence.

## T9 — Typography inside charts and diagrams

A diagram is part of the typographic system, not an exception to it.

Diagram titles and Arabic labels follow the slide's category — a framework diagram is Thmanyah Bold,
not Zain. Index numbers, step markers, axis values and compact technical labels take the brand caps
face. Never build a diagram out of five different faces, and never drop a label below the 30px floor
to make it fit — restructure the diagram instead.

## T10 — Numbers

Sequence markers (`01 / 02 / 03`), counters, dates and technical values take the brand caps face.
Statistics and big numerals take the condensed Latin face. A large Arabic editorial statement that
happens to contain a numeral stays in its headline face. The choice is deliberate and consistent
across the deck.

## T11 — Visual dominance test

After each slide is designed, mentally remove the logo and ask: **can I still recognise the SADA
typographic voice?**

- The supporting face carrying a slide that should have a Zain headline → correct it.
- Zain used for a paragraph → correct it.
- Zain on every line of every slide → also correct it. That is the autopilot failure.

## T12 — Never do this

Never set an entire deck in one face · use Zain for a paragraph · set a major Arabic hook in a
secondary face · use four or five families in one deck · change family to fake a hierarchy that size
and weight should carry · use a decorative Arabic face · pull in a random Google Font · introduce a
face outside the SADA library · set Arabic in the brand caps face, or a full sentence in it at all ·
let Latin typography overpower Arabic unnecessarily · use negative tracking on Arabic.

## T13 — Final typography check

Before delivery, every answer must be yes:

1. Was the slide category identified before the face was chosen?
2. Do the hook and the CTA carry Zain?
3. Does the body and educational copy carry Thmanyah, not Zain?
4. Are there at most two families on any one slide?
5. Does hierarchy come from scale and weight rather than family switching?
6. Is Arabic tracking 0 everywhere?
7. Is every Arabic headline line-height at or above 1.25?
8. Was every display line measured against 936px before its size was set?
9. Does the deck read as art-directed rather than as the same font repeated six times?
10. Does the whole set read as one typographic system?

Any "no" means the typography is redesigned, not nudged.

## T14 — Precedence

This section supersedes every earlier typography rule in this file, including the "Zain is 70–90% of
a deck" ratio and the "every major Arabic headline is Zain" rule — both of which produced decks set
almost entirely in one face. The corrected position: **Zain is the primary voice and the face of the
hook and the CTA; Thmanyah is the reading default; the category decides.**
