# Sirius brand guidelines

Short on purpose. The full visual version is [sirius-visual-identity.pdf](sirius-visual-identity.pdf).

## Name

**Sirius**, the brightest star in the night sky and a guide for crews far from help.
Working line: *health on board*.

## Logo

The mark is a four point star inside a dial of 24 ticks. The star's points stretch out to mark 12, 3, 6 and 9. One tick, at 45 degrees, is ember. It is always the same tick.

| File | Use |
| --- | --- |
| `logo/sirius-mark-24-ink.svg` | Main mark on light backgrounds |
| `logo/sirius-mark-24-bone.svg` | Main mark on dark backgrounds |
| `logo/sirius-mark-24-on-ember.svg` | Mark on an ember background |
| `logo/sirius-mark-12-ink.svg`, `logo/sirius-mark-12-bone.svg` | Small sizes, 24 px and below |
| `logo/sirius-wordmark-ink.svg`, `logo/sirius-wordmark-bone.svg` | The word on its own (outlined, no font needed) |
| `logo/sirius-lockup-ink.svg`, `logo/sirius-lockup-bone.svg` | Mark and wordmark together |
| `logo/sirius-app-icon.svg` | App icon and avatar |

Keep a quarter of the mark's width clear on every side. Use the 24 tick mark at 32 px and above.

## Colour

| Name | Hex | Role |
| --- | --- | --- |
| Ink | `#0D0D10` | Backgrounds, text on bone |
| Bone | `#F2EEE6` | Text on ink, light surfaces |
| Ember | `#FF5A36` | Alerts, the single accent tick, key actions |
| Slate | `#5B6472` | Secondary text on bone, units, gridlines, inactive states |

Roughly 55% ink, 30% bone, 10% slate, 5% ember. Ember on bone is too low in contrast for text, so use it for graphics there. Slate on ink only works for graphics and large text.

## Typography

**IBM Plex Sans** (Medium 500 and Regular 400) for headings and body. **IBM Plex Mono** (Regular 400) for labels and data. Both are free on Google Fonts.

| Style | Spec |
| --- | --- |
| Wordmark | Sans 500, uppercase, tracking 0.2em |
| Heading | Sans 500, 40 / 48 |
| Body | Sans 400, 18 / 28 |
| Label | Mono 400, 13, uppercase, tracking 0.12em |
| Data | Mono 400, large |

## Health dial

The same 24 ticks work as a health ring. Bone ticks are the score so far, slate ticks are what is left, ember means attention. The 12, 3, 6 and 9 ticks stay long. Thresholds shown in the PDF are illustrative.

## Motion logo

File: `motion/sirius-motion-logo.mp4` (1080 x 1080, 5.4 s, loops cleanly).

| Step | Time | What happens |
| --- | --- | --- |
| Rest | 0.0 to 0.7 s | The normal logo |
| Fill | 2.0 s | Ticks turn ember one by one, clockwise from the ember tick, until the circle closes |
| Hold | 0.5 s | All ticks ember, star still |
| Drain | 1.2 s | Ticks fade back to bone in the same order |
| Rest | 1.0 s | The normal logo again |

Each tick fades colour over 0.12 s, ease in and out. No pops, scaling, bounce, spin or glow. Use it for video intros and outros, loading and completion states, and anywhere "health full" is the message. Use the 24 tick mark only.
