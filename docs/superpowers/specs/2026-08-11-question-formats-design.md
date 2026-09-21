# GCSE Question Formats

**Date:** 2026-08-11 · **Status:** approved in discussion (user added `matching` after a lesson tweak produced a broken matching MCQ)

## Goal

Support the real spread of GCSE question styles in practice questions and
lesson quick-checks, each with a proper answering UI and the right marking
path (instant auto-marking where the answer is objective, AI markscheme
marking where it's prose).

## Formats

| type | data | answering UI | marking |
|---|---|---|---|
| `multiple-choice` | `options[]`, `correctIndexes[]` | single- or multi-select buttons | auto |
| `short-answer` | `accepted[]` (canonical + alternatives) | one-line input | auto (normalized match), AI fallback when unmatched |
| `calculation` | `answer` (numeric string), `unit?` | numeric input + working textarea | final answer auto; wrong answer → AI marks working for partial credit |
| `matching` | `pairs[{left,right}]` | dropdown per left item (rights shuffled) | auto, proportional marks |
| `structured` | `parts[{label,prompt,marks,markscheme}]` | textarea per part | AI, per-part markscheme |
| `data-analysis` | `table{headers,rows[][]}` | rendered table + textarea | AI |
| `practical` | — | textarea | AI (validity/variables/risk live in the markscheme) |
| `extended` | — | textarea (current behavior) | AI |

## Model & storage

- `GeneratedQuestion` gains `format` (discriminated union, default
  `extended`). Generation prompt describes every format and picks one that
  suits the topic; admin custom instructions can force one.
- `questions` table gains nullable `format jsonb`. Legacy rows (null) are
  treated as `extended` — no backfill needed.

## Lesson quick-checks

`LessonCheck` becomes a union, keeping the existing MCQ shape untouched for
stored lessons:
- `{ question, options, correctIndex }` (legacy/simple MCQ — unchanged)
- `{ kind: "multi", question, options, correctIndexes }`
- `{ kind: "short", question, accepted[] }`
- `{ kind: "matching", question, pairs[{left,right}] }`

All lesson checks are auto-marked (no AI at answer time). Heavier formats
stay practice-only. The player renders each kind with the existing spring
VFX (shake wrong, burst correct); matching reveals per-pair right/wrong.

## Marking

New `lib/question-marking.ts` (pure, unit-tested): auto-markers returning
the existing `MarkingResult` shape (`marksAwarded`, `feedback[]` with
synthesized per-item points) so the feedback panel needs no changes.
`submitAnswerAction` switches on format: auto paths never call the AI;
structured combines part markschemes into one AI marking call with labeled
answers.

## Answers over the wire

The practice form posts `answerPayload` (JSON string) alongside the legacy
`answer` text: `{ selected?: number[], text?: string, working?: string,
matches?: number[], parts?: string[] }`. `recordAnswer` stores a readable
text rendering of whatever was submitted.
