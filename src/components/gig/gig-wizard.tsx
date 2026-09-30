"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/lib/constants/categories";
import { fieldErrors } from "@/lib/form-errors";
import { PLATFORM_FEE_BPS, formatCents, parseDollarsToCents, sellerNetCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createGigSchema } from "@/modules/catalog/contracts";

const PREFIX = "I will ";
const MAX_TITLE = 80;
const DRAFT_KEY = "microgig:gig-draft";
const STEPS = ["Overview", "Pricing", "Description & FAQ", "Requirements", "Gallery"] as const;

interface Draft {
  titleRest: string;
  category: string;
  subcategory: string;
  tags: string[];
  price: string;
  turnaroundHours: 24 | 48;
  revisionsIncluded: number;
  description: string;
  faqs: { question: string; answer: string }[];
  requirementsPrompt: string[];
}

const EMPTY: Draft = {
  titleRest: "",
  category: "",
  subcategory: "",
  tags: [],
  price: "",
  turnaroundHours: 24,
  revisionsIncluded: 2,
  description: "",
  faqs: [],
  requirementsPrompt: [""],
};

/** Fields validated on each step (keys of createGigSchema). */
const STEP_FIELDS: (keyof typeof createGigSchema.shape)[][] = [
  ["title", "category", "subcategory", "tags"],
  ["priceCents", "turnaroundHours", "revisionsIncluded"],
  ["description", "faqs"],
  ["requirementsPrompt"],
  [],
];

function toPayload(d: Draft) {
  return {
    title: PREFIX + d.titleRest.trim(),
    category: d.category,
    subcategory: d.subcategory,
    description: d.description,
    priceCents: parseDollarsToCents(d.price) ?? Number.NaN,
    turnaroundHours: d.turnaroundHours,
    revisionsIncluded: d.revisionsIncluded,
    tags: d.tags,
    faqs: d.faqs,
    requirementsPrompt: d.requirementsPrompt.map((q) => q.trim()).filter(Boolean),
  };
}

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable: autosave is a convenience only */
  }
}

/**
 * 5-step gig creation wizard — GIG-01..04, PRD §16.2. Client autosave to localStorage.
 * TODO: POST /api/v1/gigs (status DRAFT → PUBLISHED) and gallery uploads to the public bucket.
 */
export function GigWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [imageError, setImageError] = useState<string>();
  const [savedAt, setSavedAt] = useState<string>("");
  const [publishing, setPublishing] = useState(false);

  // Restore draft after mount (never during SSR).
  useEffect(() => {
    const draft = readDraft();
    if (draft) setD(draft);
  }, []);

  // Autosave on every change.
  useEffect(() => {
    if (d !== EMPTY) writeDraft(d);
  }, [d]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const category = CATEGORIES.find((c) => c.slug === d.category);
  const titleLength = PREFIX.length + d.titleRest.length;
  const priceCents = useMemo(() => parseDollarsToCents(d.price), [d.price]);

  function validate(stepIndex: number): boolean {
    const fields = STEP_FIELDS[stepIndex]!;
    if (fields.length === 0) return true;
    const pick = Object.fromEntries(fields.map((f) => [f, true])) as Partial<Record<keyof typeof createGigSchema.shape, true>>;
    const parsed = createGigSchema.pick(pick).safeParse(toPayload(d));
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (fields.includes("priceCents") && priceCents === null) errs.priceCents = "Enter a price like 25 or 25.00";
    else if (errs.priceCents) errs.priceCents = "Price must be between $5.00 and $50.00";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || d.tags.includes(t) || d.tags.length >= 5 || t.length > 30) return;
    update("tags", [...d.tags, t]);
    setTagInput("");
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    setImageError(undefined);
    const list = Array.from(files);
    if (list.some((f) => !["image/png", "image/jpeg", "image/webp"].includes(f.type))) {
      setImageError("Use PNG, JPG or WEBP images.");
      return;
    }
    const room = 4 - images.length;
    if (list.length > room) setImageError("A gig can have 1 thumbnail and up to 3 showcase images.");
    setImages((imgs) => [...imgs, ...list.slice(0, room).map((f) => ({ url: URL.createObjectURL(f), name: f.name }))]);
  }

  async function publish() {
    for (let i = 0; i < STEP_FIELDS.length; i++) {
      if (!validate(i)) return setStep(i);
    }
    if (images.length === 0) return setImageError("Add at least a thumbnail image before publishing.");
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 400));
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.push("/seller/dashboard");
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Gig creation steps">
        <ol className="flex gap-2 overflow-x-auto">
          {STEPS.map((label, i) => {
            const done = i < step || (i <= maxStep && i !== step);
            return (
              <li key={label} className="shrink-0">
                <button
                  type="button"
                  disabled={i > maxStep}
                  onClick={() => setStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed",
                    i === step ? "border-heading bg-heading text-white" : "border-border text-heading disabled:text-muted-foreground",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-xs text-heading">
                    {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="space-y-5 p-5 md:p-6">
        <h2 className="text-lg font-semibold">
          Step {step + 1}: {STEPS[step]}
        </h2>

        {step === 0 ? (
          <>
            <Field
              id="gig-title"
              label="Gig title"
              hint='Start with what you will do, e.g. "fix one responsive layout bug".'
              counter={`${titleLength}/${MAX_TITLE}`}
              error={errors.title}
            >
              {(p) => (
                <div className="flex rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex items-center rounded-l-md bg-surface px-3 text-sm font-semibold text-heading">I will</span>
                  <input
                    {...p}
                    value={d.titleRest}
                    maxLength={MAX_TITLE - PREFIX.length}
                    onChange={(e) => update("titleRest", e.target.value)}
                    className="h-10 w-full rounded-r-md bg-background px-3 text-sm text-heading outline-none"
                  />
                </div>
              )}
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field id="gig-category" label="Category" error={errors.category}>
                {(p) => (
                  <Select
                    {...p}
                    value={d.category}
                    onChange={(e) => setD((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))}
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="gig-subcategory" label="Subcategory" error={errors.subcategory}>
                {(p) => (
                  <Select {...p} value={d.subcategory} disabled={!category} onChange={(e) => update("subcategory", e.target.value)}>
                    <option value="">{category ? "Select a subcategory" : "Choose a category first"}</option>
                    {category?.subcategories.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field id="gig-tags" label="Search tags" hint="Press Enter to add. Up to 5 tags, 30 characters each." counter={`${d.tags.length}/5`} error={errors.tags}>
              {(p) => (
                <div className="space-y-2">
                  <Input
                    {...p}
                    value={tagInput}
                    maxLength={30}
                    disabled={d.tags.length >= 5}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  {d.tags.length > 0 ? (
                    <ul className="flex flex-wrap gap-2" aria-label="Added tags">
                      {d.tags.map((t) => (
                        <li key={t} className="inline-flex items-center gap-1 rounded-full bg-surface py-1 pl-3 pr-1 text-xs font-semibold text-heading">
                          {t}
                          <button
                            type="button"
                            aria-label={`Remove tag ${t}`}
                            onClick={() => update("tags", d.tags.filter((x) => x !== t))}
                            className="rounded-full p-0.5 hover:bg-border"
                          >
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field id="gig-price" label="Fixed price ($5 – $50)" error={errors.priceCents}>
              {(p) => (
                <div className="flex max-w-xs rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex items-center rounded-l-md bg-surface px-3 text-sm font-semibold text-heading">$</span>
                  <input
                    {...p}
                    inputMode="decimal"
                    value={d.price}
                    placeholder="25.00"
                    onChange={(e) => update("price", e.target.value)}
                    className="h-10 w-full rounded-r-md bg-background px-3 text-sm text-heading outline-none"
                  />
                </div>
              )}
            </Field>
            {priceCents !== null && priceCents >= 500 && priceCents <= 5000 ? (
              <p className="text-sm text-muted-foreground">
                You earn {formatCents(sellerNetCents(priceCents, PLATFORM_FEE_BPS))} per order after the 20% platform fee.
              </p>
            ) : null}
            <fieldset>
              <legend className="text-sm font-semibold text-heading">Turnaround time</legend>
              <div className="mt-2 flex gap-4">
                {([24, 48] as const).map((h) => (
                  <label key={h} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="turnaround"
                      checked={d.turnaroundHours === h}
                      onChange={() => update("turnaroundHours", h)}
                      className="h-4 w-4 accent-heading"
                    />
                    {h} hours
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="gig-revisions" label="Revisions included">
              {(p) => (
                <Select {...p} className="max-w-xs" value={d.revisionsIncluded} onChange={(e) => update("revisionsIncluded", Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "revision" : "revisions"} included
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field
              id="gig-description"
              label="Description"
              hint='Plain text. Separate paragraphs with a blank line; start a line with "- " for a bullet.'
              error={errors.description}
            >
              {(p) => <Textarea {...p} className="min-h-48" value={d.description} onChange={(e) => update("description", e.target.value)} />}
            </Field>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-heading">FAQ (up to 5)</legend>
              {d.faqs.map((f, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Field id={`faq-q-${i}`} label={`Question ${i + 1}`} counter={`${f.question.length}/150`} error={errors[`faqs.${i}.question`]}>
                        {(p) => (
                          <Input
                            {...p}
                            maxLength={150}
                            value={f.question}
                            onChange={(e) => update("faqs", d.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                          />
                        )}
                      </Field>
                      <Field id={`faq-a-${i}`} label="Answer" counter={`${f.answer.length}/600`} error={errors[`faqs.${i}.answer`]}>
                        {(p) => (
                          <Textarea
                            {...p}
                            maxLength={600}
                            value={f.answer}
                            onChange={(e) => update("faqs", d.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                          />
                        )}
                      </Field>
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove question ${i + 1}`} onClick={() => update("faqs", d.faqs.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={d.faqs.length >= 5}
                onClick={() => update("faqs", [...d.faqs, { question: "", answer: "" }])}
              >
                <Plus aria-hidden /> Add question
              </Button>
            </fieldset>
          </>
        ) : null}

        {step === 3 ? (
          <fieldset className="space-y-3">
            <legend className="text-sm text-muted-foreground">
              Ask the buyer 1 to 3 questions. They must answer before the order starts.
            </legend>
            {d.requirementsPrompt.map((q, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field id={`req-q-${i}`} label={`Question ${i + 1}`} error={errors[`requirementsPrompt.${i}`]}>
                    {(p) => (
                      <Input
                        {...p}
                        value={q}
                        onChange={(e) => update("requirementsPrompt", d.requirementsPrompt.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    )}
                  </Field>
                </div>
                {d.requirementsPrompt.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() => update("requirementsPrompt", d.requirementsPrompt.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
            {errors.requirementsPrompt ? <p className="text-xs font-semibold text-red-700">{errors.requirementsPrompt}</p> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={d.requirementsPrompt.length >= 3}
              onClick={() => update("requirementsPrompt", [...d.requirementsPrompt, ""])}
            >
              <Plus aria-hidden /> Add question
            </Button>
          </fieldset>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">1 thumbnail + up to 3 showcase images. The first image is the thumbnail.</p>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {images.map((img, i) => (
                <li key={img.url} className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  {i === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-heading px-2 py-0.5 text-[11px] font-semibold text-white">Thumbnail</span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${img.name}`}
                    onClick={() => {
                      URL.revokeObjectURL(img.url);
                      setImages((all) => all.filter((x) => x.url !== img.url));
                    }}
                    className="absolute right-1.5 top-1.5 rounded-full bg-background p-1 text-heading shadow"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              {images.length < 4 ? (
                <li>
                  <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-sm font-semibold text-heading hover:bg-surface focus-within:ring-2 focus-within:ring-ring">
                    <ImagePlus className="h-6 w-6" aria-hidden />
                    Add image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        addImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </li>
              ) : null}
            </ul>
            {imageError ? <p className="text-xs font-semibold text-red-700">{imageError}</p> : null}

            <div className="rounded-md bg-surface p-4 text-sm">
              <p className="font-semibold text-heading">{PREFIX + d.titleRest}</p>
              <p className="mt-1 text-muted-foreground">
                {priceCents !== null ? formatCents(priceCents) : "—"} · {d.turnaroundHours}h delivery · {d.revisionsIncluded} revisions ·{" "}
                {category?.name ?? "No category"}
              </p>
            </div>
          </div>
        ) : null}

        {Object.keys(errors).length > 0 ? <Alert variant="danger">Please fix the highlighted fields to continue.</Alert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? router.push("/seller/dashboard") : setStep(step - 1))}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                writeDraft(d);
                setSavedAt(new Date().toLocaleTimeString());
              }}
            >
              Save draft
            </Button>
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {savedAt ? `Draft saved at ${savedAt}` : ""}
            </span>
          </div>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Continue to next step
            </Button>
          ) : (
            <Button type="button" onClick={publish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish gig"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
