"use client";

import { motion } from "framer-motion";
import { EASE_OUT } from "@/components/motion";
import { GuideTour, type TourStep } from "@/components/guide-tour";
import { CountUp, MockQuestion, type CompleteAction } from "./parts";

function Marks() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-base font-medium text-foreground">Exam questions show their marks, like [3 marks].</p>
      <p className="mt-2 text-sm text-muted">One mark is one point you earn: for a correct step, a unit, or a clear reason. Show your working.</p>
      <div className="mt-3 flex gap-2" aria-label="3 of 3 marks">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.2 + i * 0.15 }}
            className="size-3 rounded-full bg-success"
          />
        ))}
      </div>
    </div>
  );
}

function Try() {
  return (
    <MockQuestion
      prompt="[1 mark] What is 3/4 of 8?"
      options={["4", "6", "2"]}
      correct={1}
      hint="Find 1/4 of 8 first, then multiply by 3."
      checkLabel="Mark it"
    />
  );
}

function Result() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="font-[family-name:var(--font-mono)] text-3xl font-semibold text-foreground">
        <CountUp to={2} /> / 3 marks
      </p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.6 }} className="mt-2 text-sm text-muted">
        You get feedback on the marks you missed, so the next attempt is better.
      </motion.p>
    </div>
  );
}

const STEPS: TourStep[] = [
  { id: "marks", heading: "Marks tell you what counts", body: "Real exam questions are worth a set number of marks.", cta: "Try one", content: <Marks /> },
  { id: "try", heading: "Answer and get marked", body: "Choose an answer, then see how it scores.", cta: "See my result", content: <Try /> },
  { id: "result", heading: "Learn from every mark", body: "Missed marks show you what to fix.", cta: "Finish", content: <Result /> },
];

export function PracticeTour({ completeAction }: { completeAction: CompleteAction }) {
  return <GuideTour pieceKey="how-practice-works" steps={STEPS} completeAction={completeAction} />;
}
