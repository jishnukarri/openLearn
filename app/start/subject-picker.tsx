"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { Compass, PencilLine, UserPlus } from "lucide-react";
import { startGuestDiagnosticAction } from "@/app/actions/guest";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

type Subject = { id: string; name: string };

const EASE_OUT = [0.16, 1, 0.3, 1] as const;


const stack: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.35 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

function StartButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="relative w-full overflow-hidden sm:w-auto">
      {pending ? "Building your quiz…" : "Yes, start the diagnostic"}
      {pending && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 origin-left bg-white/50"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 0.9 }}
          transition={{ duration: 4, ease: EASE_OUT }}
        />
      )}
    </Button>
  );
}

export function SubjectPicker({ subjects }: { subjects: Subject[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<"pick" | "ask">("pick");
  const [nudge, setNudge] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step === "ask") headingRef.current?.focus();
  }, [step]);

  const chosen = subjects.filter((s) => selected.includes(s.id));
  const steps = [
    { Icon: PencilLine, title: "Take the quiz", body: `Short questions on ${chosen.map((s) => s.name).join(", ")}. No account needed.` },
    { Icon: Compass, title: "See what you know", body: "No pass or fail. Your results map what you already know and where the gaps are." },
    { Icon: UserPlus, title: "Then decide", body: "Sign up to keep your results and get lessons built around them." },
  ];

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
    setNudge(0);
  }

  function ask() {
    if (selected.length === 0) {
      setNudge((n) => n + 1);
      return;
    }
    setStep("ask");
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {step === "pick" ? (
          <motion.div
            key="pick"
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
            className="mx-auto flex w-full max-w-xl flex-col gap-8"
          >
            <div className="animate-fade-slide-up">
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">
                Pick your subjects
              </h1>
              <p className="mt-1 text-sm text-muted">
                No account needed yet — take a short diagnostic first, see how you
                do, then decide.
              </p>
            </div>

            <section className="animate-fade-slide-up flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
              {subjects.length === 0 ? (
                <p className="text-sm text-muted">No subjects have been published yet, check back soon.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <FieldGroup className="gap-2">
                    {subjects.map((subject) => {
                      const id = `subject-${subject.id}`;
                      return (
                        <Field
                          key={subject.id}
                          orientation="horizontal"
                          className="rounded-lg border border-border bg-background px-3 py-2 has-[[data-checked]]:border-primary"
                        >
                          <Checkbox
                            id={id}
                            checked={selected.includes(subject.id)}
                            onCheckedChange={(on) => toggle(subject.id, on)}
                          />
                          <FieldLabel htmlFor={id} className="cursor-pointer text-sm text-foreground">
                            {subject.name}
                          </FieldLabel>
                        </Field>
                      );
                    })}
                  </FieldGroup>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={ask} className="self-start">
                      Start the diagnostic
                    </Button>
                    <AnimatePresence>
                      {nudge > 0 && (
                        <motion.p
                          key={nudge}
                          role="alert"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: [0, -5, 5, -3, 0] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35, ease: EASE_OUT }}
                          className="text-sm text-error"
                        >
                          Pick at least one subject to continue.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </section>
          </motion.div>
        ) : (
          <motion.form
            key="ask"
            action={startGuestDiagnosticAction}
            initial="hidden"
            animate="show"
            variants={stack}
            className="grid gap-x-20 gap-y-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
          >
            {selected.map((id) => (
              <input key={id} type="hidden" name="subjectIds" value={id} />
            ))}

            <div className="flex items-end gap-4 lg:col-start-1 lg:row-start-1 lg:self-end">
              <motion.span
                aria-hidden
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                className="flex size-11 shrink-0 items-center justify-center rounded-[22%] bg-primary font-[family-name:var(--font-display)] text-2xl font-semibold italic leading-none text-white"
              >
                O
              </motion.span>
              <motion.div
                initial={{ clipPath: "inset(0 100% 0 0 round 20px)" }}
                animate={{ clipPath: "inset(0 0% 0 0 round 20px)" }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT }}
                className="rounded-3xl rounded-bl-md bg-surface px-6 py-5 lg:px-8 lg:py-7"
              >
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug text-foreground outline-none sm:text-3xl lg:text-5xl lg:leading-[1.1]"
                >
                  Want to see where you stand before you sign up?
                </h1>
              </motion.div>
            </div>

            <motion.div variants={rise} className="flex flex-col gap-4 pl-14 lg:col-start-1 lg:row-start-2 lg:pl-[3.5rem]">
              <p className="max-w-[56ch] text-base text-muted">
                A diagnostic is a short quiz that shows us what you already
                know, so your lessons can skip it and start where you need
                them. Yours covers:
              </p>
              <ul className="flex flex-wrap gap-2">
                {chosen.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-foreground"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            </motion.div>

            <ol className="relative flex flex-col gap-10 py-2 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center">
              <span aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-border">
                <motion.span
                  className="absolute inset-0 origin-top bg-primary"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 1.3, delay: 0.55, ease: EASE_OUT }}
                />
              </span>
              {steps.map(({ Icon, title, body }, i) => (
                <motion.li
                  key={title}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.55, delay: 0.5 + i * 0.4, ease: EASE_OUT }}
                  className="relative flex gap-5"
                >
                  <span
                    aria-hidden
                    className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border ${
                      i === 0
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background text-muted"
                    }`}
                  >
                    <Icon className="size-[18px]" strokeWidth={2} />
                  </span>
                  <div className="pt-1.5">
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                      {title}
                    </p>
                    <p className="mt-1 max-w-[40ch] text-sm text-muted">{body}</p>
                  </div>
                </motion.li>
              ))}
            </ol>

            <motion.div
              variants={rise}
              className="flex flex-col gap-3 pl-14 sm:flex-row sm:items-center lg:col-start-1 lg:row-start-3 lg:pl-[3.5rem]"
            >
              <StartButton />
              <Button
                type="button"
                variant="secondary"
                className="w-full !shadow-none sm:w-auto"
                onClick={() => setStep("pick")}
              >
                Change subjects
              </Button>
            </motion.div>
          </motion.form>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
