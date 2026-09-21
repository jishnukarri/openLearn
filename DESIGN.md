# OpenLearn — Design Format

Reference points: Brilliant's onboarding (conversational AI-tutor chat bubbles, pastel topic-picker cards, bottom-anchored pill CTA) and its editorial hero type. Not referencing Duolingo's cartoon path/mascot — OpenLearn is exam-serious, not childish.

## Why not just "dark Duolingo"

Near-black background + one bright accent is one of the most common AI-default looks. We avoid that trap by giving each brand color a **strict job**, never decorative:

- **Indigo** — brand chrome, primary actions, the "path" (nav, buttons, progress rings)
- **Coral** — celebration only (streak saved, unlock, correct-answer burst) — never used for general UI
- **Amber** — XP/progress only — never used interchangeably with coral
- **Success green / Error red** — conventional, marking-specific, not part of the brand palette experiments

That discipline is what keeps three accent colors from reading as noise.

## Signature element: "The Markup"

OpenLearn's whole pitch is *strict-to-markscheme* marking. So the one moment we spend real design boldness on is the feedback screen: AI feedback renders as literal red/green pen annotation directly over the student's own submitted answer — strike-throughs, circled key terms, margin ticks — like a teacher's marked script, not a generic score card. This is specific to what the product actually does; nothing decorative.

## Color

| Token | Dark (default) | Light | Role |
|---|---|---|---|
| `background` | `#0B0B14` | `#F7F7FB` | page ground |
| `surface` | `#16161F` | `#FFFFFF` | cards, chat bubbles, sheets |
| `border` | `#26262F` | `#E4E4EC` | dividers |
| `foreground` | `#F2F1F7` | `#14141C` | text (warm, never pure black/white) |
| `muted` | `#9CA3AF` | `#6B7280` | secondary text |
| `primary` (indigo) | `#6D6AFF` | same | brand/chrome |
| `secondary` (coral) | `#FF8A78` | same | celebration only |
| `highlight` (amber) | `#FFC24D` | same | XP/progress only |
| `success` | `#3DDC84` | same | correct/pass |
| `error` | `#FF5C5C` | same | incorrect/fail |

Already implemented in `app/globals.css`.

## Type

Three roles, not two — this product mixes editorial moments (lesson intros, streak celebrations) with dense data (marks, timers, XP), so a single face can't carry both.

- **Display — Fraunces** (variable serif, warm high-contrast). Used sparingly: lesson/topic titles, onboarding headlines, celebration copy ("Streak saved"). Never for UI chrome or buttons. Gives the academic-but-not-boring feel that pure grotesque sans can't.
- **Body/UI — Geist Sans** (already in the project via `next/font`). Everything else: nav, buttons, questions, explanations.
- **Data/utility — Geist Mono** (already in the project). XP counters, timers, question numbers, scores, mark totals — anywhere digits need to line up.

Add Fraunces via `next/font/google` alongside the existing Geist setup in `app/layout.tsx`.

## Layout concept

Two recurring patterns, both adapted from the references but re-skinned to ink/indigo and to actual OpenLearn content (subjects/exam boards/topics, not generic goals):

**1. Tutor-chat onboarding** — AI avatar chip + speech-bubble question, answers as tappable pill/card options underneath, single bottom pill CTA. Drives subject/exam-board selection and the diagnostic quiz intro — matches the spec's conversational onboarding flow directly instead of a static form.

```
┌───────────────────────────────┐
│ ● AI   "Which exam board is   │
│        this for?"             │
│                                │
│  ┌──────────┐ ┌──────────┐   │
│  │  AQA     │ │  Edexcel │   │
│  └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐   │
│  │  OCR     │ │  WJEC    │   │
│  └──────────┘ └──────────┘   │
│                                │
│      (  Continue  )           │
└───────────────────────────────┘
```

**2. Topic grid** — surface-colored cards (not pastel-tinted like Brilliant's light theme — ours use `surface` + a thin `border`, with the subject's own icon/diagram as the only color), for browsing generated topics/subtopics.

## Next steps

If this direction reads right, next I'll: (1) add Fraunces to `layout.tsx`, (2) build the onboarding chat-bubble component, (3) build the topic-card component, (4) prototype "The Markup" feedback view once a real question/markscheme exists to test it against.
