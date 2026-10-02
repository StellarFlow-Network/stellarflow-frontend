# Glassmorphism theme

Dark-mode glass surfaces (translucent background + backdrop blur + hairline
border) for StellarFlow, with an opaque fallback for engines that cannot blur
the backdrop.

## Where things live

| Piece | Path |
| --- | --- |
| Design tokens (runtime + fallback) | `src/app/globals.css` (`:root`, `.dark`, `.high-contrast`) |
| Tailwind theme tokens | `src/app/globals.css` (`@theme inline`) |
| Surface recipe + `@supports` fallback | `src/app/globals.css` (`@layer components`) |
| React primitives | `src/components/glass/` |
| Pure composition helpers | `src/components/glass/glassTheme.ts` |
| Unit tests | `tests/unit/glassTheme.test.ts` |

## Tokens

Tailwind utilities (available because they are declared in `@theme inline`):

| Token | Utility | Value |
| --- | --- | --- |
| `--blur-glass-sm` | `backdrop-blur-glass-sm` | `8px` |
| `--blur-glass` | `backdrop-blur-glass` | `16px` |
| `--blur-glass-xl` | `backdrop-blur-glass-xl` | `24px` |
| `--radius-glass` | `rounded-glass` | `1rem` |
| `--radius-glass-lg` | `rounded-glass-lg` | `1.5rem` |
| `--color-glass-surface` | `bg-glass-surface` | theme-aware translucent fill |
| `--color-glass-surface-strong` | `bg-glass-surface-strong` | denser translucent fill |
| `--color-glass-border` | `border-glass-border` | hairline highlight border |

Runtime variables consumed by the `.glass-*` classes (override per instance with
an inline `style`):

| Variable | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `--glass-blur` | Effective backdrop blur radius (mutable) | `16px` | `16px` |
| `--glass-blur-panel` | Blur used by `.glass-panel` | `16px` | `16px` |
| `--glass-blur-modal` | Blur used by `.glass-modal` | `24px` | `24px` |
| `--glass-blur-nav` | Blur used by `.glass-nav` | `12px` | `12px` |
| `--glass-saturate` | Backdrop saturation | `160%` | `160%` |
| `--glass-surface` | Translucent fill | `rgb(255 255 255 / .55)` | `rgb(22 27 34 / .55)` |
| `--glass-surface-strong` | Denser fill for shells | `rgb(255 255 255 / .72)` | `rgb(13 17 23 / .72)` |
| `--glass-border` | Hairline border | `rgb(255 255 255 / .6)` | `rgb(255 255 255 / .12)` |
| `--glass-sheen` | Top sheen gradient stop | `rgb(255 255 255 / .65)` | `rgb(255 255 255 / .07)` |
| `--glass-shadow` | Ambient drop shadow | `0 8px 32px …` | `0 16px 48px …` |
| `--glass-fallback-surface` | Opaque fallback fill | `#f3f4f6` | `#161b22` |
| `--glass-fallback-surface-strong` | Opaque fallback fill (shells) | `#ffffff` | `#1c2128` |
| `--glass-fallback-border` | Opaque fallback border | `#d1d5db` | `#30363d` |

`--glass-blur*` is mirrored by `--blur-glass*` so the Tailwind utilities and the
component classes stay in step.

## Classes

`.glass-surface` is the shared recipe. Add exactly one density class:

| Class | Blur | Fill | Used by |
| --- | --- | --- | --- |
| `.glass-panel` | `--glass-blur-panel` (`16px`) | `--glass-surface` | content panels, trading panels, cards |
| `.glass-modal` | `--glass-blur-modal` (`24px`) | `--glass-surface-strong` | dialogs, sheets |
| `.glass-nav` | `--glass-blur-nav` (`12px`) | `--glass-surface-strong` | header nav, drawers |

The classes are declared in the `components` cascade layer, so Tailwind
utilities still win: `hover:border-white/25`, `rounded-2xl`, `p-6`, … all keep
working on a glass surface.

They only set `background-color`, `background-image`, `border-color` and
`box-shadow` — never `position`, `padding`, `border-radius` or `overflow` — so a
surface can be `sticky`, `fixed` or a flex child without surprises.

## Fallback behaviour

```
1. No @supports match   → opaque --glass-fallback-* fill + solid border, no blur.
2. @supports passes     → translucent fill + sheen + backdrop-filter: blur() saturate().
3. prefers-reduced-transparency: reduce → back to the opaque fallback, blur removed.
```

High-contrast mode (`.high-contrast`) forces `--glass-blur*: 0px`, a pure black
fill and a white border, so the theme never trades contrast for decoration.

## Usage

```tsx
import { GlassCard, GlassModal, GlassPanel } from "@/components/glass";

<GlassCard interactive>
  <SwapSummary />
</GlassCard>

<GlassPanel variant="modal" blur={20}>
  <OrderBook />
</GlassPanel>

<GlassModal isOpen={open} onClose={close} title="Slippage">
  <SlippageForm />
</GlassModal>
```

Applying it to an existing element without a primitive:

```tsx
<section className="glass-surface glass-panel rounded-2xl border p-6">…</section>
```

`blur` and `saturate` on the primitives are clamped (`0–40px`, `100–200%`) and
converted to inline `--glass-blur` / `--glass-saturate` values, so a bad prop can
never emit `blur(NaNpx)` and invalidate the declaration.

Current adopters: `src/app/components/nav.jsx`,
`src/components/navigation/MobileDrawerNav.tsx`,
`src/app/components/OptimizedDialog.tsx`,
`src/app/components/OptimizedSheet.tsx`,
`src/components/swap/SwapCard.tsx`.

## Performance notes

`backdrop-filter` is a compositor blur: the GPU re-samples everything behind the
element. Keep it cheap:

* Prefer one blur layer per region. A `backdrop-blur-*` scrim **plus** a blurred
  panel stacks two blurs; drop one if the frame budget is tight.
* Never animate `backdrop-filter` itself — animate `opacity` / `transform`, which
  the repo already does through Framer Motion.
* Treat ~24px as the practical ceiling; `--glass-blur` is clamped to `40px` in
  code for the same reason.
* Full-width `sticky` chrome (the header nav) is the most expensive placement —
  it re-blurs on every scroll frame, which is why `.glass-nav` stays at `12px`
  with a denser fill.
* Prefer `GlassCard interactive` over a translate/scale lift: moving a blurred
  element forces the backdrop to be re-sampled each frame.

There is no automated FPS harness in this repo (Playwright is only set up for
e2e/visual snapshots). To check a change manually:

1. `npm run dev`, open a trading/portfolio page in Chrome DevTools.
2. Rendering ▸ Frame Rendering Stats, scroll the sticky header and open a
   dialog/sheet for ~10s.
3. Confirm the frame rate holds at the display refresh rate and that no
   "backdrop-filter" repaints appear in the Rendering ▸ Paint flashing overlay
   outside the glass bounds.

## Tests

```bash
node --test tests/unit/glassTheme.test.ts
```

Uses Node's built-in test runner only (Node >= 24); no vitest/Jest dependency is
installed in this repo. The suite covers class composition, clamping and
prop/DOM splitting in `glassTheme.ts`.
