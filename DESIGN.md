# IELTS Cozy Design System

**Canonical design rules:** this document.  
**Canonical values:** [`design-tokens.json`](design-tokens.json).  
**Current visual and interaction source of truth:** [`index.html`](index.html).

## 1. Design intent

IELTS Cozy is a calm, optimistic learning workspace. It uses a bright canvas, strong black typography, one focused blue action color, warm feature surfaces, rounded cards, and editorial whitespace.

Principles:

- One primary action per view.
- Learning content stays readable before decorative.
- Color identifies context; text and icons carry state too.
- Friendly, never childish. Motion supports feedback, never distracts from a listening task or answer.
- Default density is spacious; compact layouts are for answer lists and mobile only.

## 2. Token policy

- Never hard-code color, spacing, type, radius, shadow, or motion values in a feature.
- Use semantic tokens first: `color.background.*`, `color.text.*`, `color.action.*`, `color.feedback.*`.
- Use core colors only when creating or maintaining a semantic/component token.
- Add a token only when at least two interfaces need it. Otherwise use an existing token.
- Every new token needs a name, purpose, value, and accessibility review.
- `design-tokens.json` follows DTCG-style `$value` / `$type`. Generated CSS or TypeScript values must derive from it, never become a second source of truth.

## 3. Color

| Purpose | Token | Value |
|---|---|---|
| Main action / link | `color.action.primary` | `#3860be` |
| Primary action hover | `color.action.primaryHover` | `#2c4d9c` |
| Canvas / surface | `color.background.canvas` | `#ffffff` |
| Primary content | `color.text.primary` | `#000000` |
| Supporting content | `color.text.secondary` | `#475562` |
| Default border / quiet surface | `color.border.subtle` | `#f0eee9` |
| Listening surface | `color.background.listening` | `#bcd4e6` |
| Vocabulary surface | `color.background.vocabulary` | `#f5e9be` |
| Grammar surface | `color.background.grammar` | `#efd3c7` |
| Review / caution surface | `color.background.review` | `#ebd3d6` |

Use ink text on pastel feature surfaces. Do not use white text on pastel surfaces. Use `color.feedback.*Surface` with an icon and plain-language message; color alone cannot indicate right/wrong state.

## 4. Typography

Use `font.family.sans` for product UI. Use `font.family.mono` only for eyebrow labels, timers, question ranges, dates, and compact metadata.

| Role | Tokens | Use |
|---|---|---|
| Display | `font.size.display`, `font.weight.medium`, `font.lineHeight.display` | Page hero and major screen title |
| Title | `font.size.title`, `font.weight.medium` | Section title, modal title |
| Subtitle | `font.size.subtitle`, `font.weight.semibold` | Card emphasis |
| Body | `font.size.body`, `font.weight.regular`, `font.lineHeight.body` | Primary reading UI |
| Small body | `font.size.bodySmall`, `font.lineHeight.bodySmall` | Supporting copy |
| Eyebrow | `font.size.eyebrow`, `font.family.mono`, `font.letterSpacing.eyebrow` | Uppercase category / status |

Body copy must not be smaller than 14px. Long-form Reading passages use 18px with 27px line height. Headings use 500 weight and `font.letterSpacing.heading`.

## 5. Space, layout, radius, elevation

- Base grid: 4px. Use `space` scale only.
- Normal card gaps: 12px, 16px, 24px, 32px.
- Desktop content: max `layout.contentMax`, 32px inline padding.
- Mobile content: 16px inline padding; do not force desktop two-column layouts below 768px.
- Card: 16px radius. Compact choice/input: 8px radius. Buttons: 4px radius. Filter/status chips: round radius.
- Standard cards use 1px subtle border. Apply `shadow.card` only to primary or floating cards; most cards stay flat.
- Sticky pill navigation remains offset 24px on desktop and follows safe-area spacing on mobile.

## 6. Component patterns

### Buttons

- Primary: blue fill, white label, 44px minimum height, 12px uppercase/mono label, 1.5px tracking.
- Secondary / outline: white or transparent fill, ink label, strong 1px border.
- Text link: blue by default, ink on hover.
- Icon-only: round container, 40px minimum touch target, accessible label required.
- Disabled states reduce interaction, not text readability; never rely on opacity alone for meaning.

### Cards, chips, and progress

- Cards use 16px radius, subtle border, 24px default padding.
- Feature cards may use one pastel background and an image/illustration, then a translucent white content panel.
- Chips/pills have 32px height, round radius. Selected navigation/filter uses ink fill and white text.
- Progress bars use 6px height, round radius, quiet track, blue progress. Show a text value when the value matters.

### Learning interactions

- Reading answers: compact 8px cards; selected answer gets clear border and key marker; submitted answers show icon + textual feedback.
- Listening answers: visible word-limit rule, 44px touchable input, blue focus border; never auto-submit after audio ends.
- Vocabulary: one large card, tap-to-flip, two distinct review actions. Feature color is context only.
- Grammar: show one concept/task at a time, immediate explanation after submit, then next recommended practice.

## 7. Motion and accessibility

- Default hover/focus transition: `motion.default`; enter transition: `motion.enter`.
- Use motion only for navigation emphasis, progress feedback, flashcard flip, or recording/playback status.
- Implement `prefers-reduced-motion`; disable loops, spin, pulse, and non-essential transforms.
- Keyboard focus uses `color.border.focus` with 2px width and visible offset.
- Minimum 44px target for touch controls. Audio, flashcard, and timer controls need names readable by assistive technology.
- Meet WCAG 2.2 AA contrast. Validate every new foreground/background pair.

## 8. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| `< 768px` | Single column; navigation scrolls or collapses; sticky side panels become inline; 16px page padding |
| `768–1023px` | Two-column learning view allowed when passage and questions remain readable |
| `≥ 1024px` | Use 1200px content max; dashboard/card grids may use 3–4 columns |

No critical action may exist only on hover. Mobile must support full Vocabulary, Grammar, Listening, progress, and guest-onboarding flows.

## 9. Agent checklist for UI work

Before implementation or review:

1. Read this file and `design-tokens.json`.
2. Identify existing component/token before adding a value.
3. Use semantic token names in code.
4. Check desktop, mobile, keyboard focus, empty/loading/error states.
5. Add a design-token change note to handoff if a token changed.
6. Record a material system change in `docs/adr/`.
