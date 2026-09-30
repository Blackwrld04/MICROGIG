"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Requirements submission gate — ORD-02: every prompt must be answered. */
export function RequirementsForm({ prompts, onSubmit }: { prompts: string[]; onSubmit: (answers: string[]) => void }) {
  const [answers, setAnswers] = useState(() => prompts.map(() => ""));
  const [errors, setErrors] = useState<(string | undefined)[]>([]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = answers.map((a) => (a.trim() ? undefined : "This answer is required"));
    setErrors(next);
    if (next.every((x) => !x)) onSubmit(answers.map((a) => a.trim()));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {prompts.map((prompt, i) => (
        <Field key={prompt} id={`req-${i}`} label={`${i + 1}. ${prompt}`} error={errors[i]}>
          {(props) => (
            <Textarea
              {...props}
              required
              value={answers[i]}
              onChange={(e) => setAnswers((all) => all.map((a, j) => (j === i ? e.target.value : a)))}
            />
          )}
        </Field>
      ))}
      <Button type="submit">Submit requirements &amp; start order</Button>
    </form>
  );
}
