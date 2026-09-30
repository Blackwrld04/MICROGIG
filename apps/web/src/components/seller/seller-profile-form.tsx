"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { SellerProfileResponse } from "@/lib/api/types";
import { fieldErrors } from "@/lib/form-errors";
import { queryKeys } from "@/lib/query/keys";
import { queries } from "@/lib/query/queries";
import { USE_MOCKS } from "@/mocks/config";
import { toast } from "@/stores/toast-store";
import {
  ID_DOCUMENT_LABELS,
  ID_DOCUMENT_TYPES,
  PROFICIENCIES,
  PROFICIENCY_LABELS,
  SKILL_LEVELS,
  SKILL_LEVEL_LABELS,
  idVerificationSchema,
  sellerProfileSchema,
  type SellerProfileInput,
  type VerificationStatus,
} from "@/modules/seller/contracts";

const VERIFICATION_TEXT: Record<VerificationStatus, { variant: "info" | "success" | "warning" | "danger"; text: string }> = {
  NOT_SUBMITTED: { variant: "info", text: "Submit an ID document so an admin can verify you. Your gigs stay hidden until then." },
  PENDING_VERIFICATION: { variant: "warning", text: "Submitted. An admin will review your ID shortly." },
  APPROVED: { variant: "success", text: "Approved. The “Verified” badge shows on your gigs." },
  REJECTED: { variant: "danger", text: "Rejected. Please check your details and submit again." },
};

/**
 * Seller profile — SEL-01, and ID verification stub — SEL-02.
 * TODO: PUT /api/v1/me/seller-profile and POST /api/v1/me/seller-profile/submit.
 */
export function SellerProfileForm() {
  const { data } = useQuery(queries.sellerProfile());
  if (!data) return null;
  return <ProfileEditor initial={data.profile} verification={data.verification} />;
}

function ProfileEditor({ initial, verification }: { initial: SellerProfileInput; verification: VerificationStatus }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const [status, setStatus] = useState(verification);
  const [doc, setDoc] = useState({ idDocumentType: "PASSPORT", documentReference: "" });
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof SellerProfileInput>(key: K, value: SellerProfileInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const setCached = (change: Partial<SellerProfileResponse>) =>
    queryClient.setQueryData<SellerProfileResponse>(queryKeys.sellerProfile, (prev) => (prev ? { ...prev, ...change } : prev));

  const saveProfile = useMutation({
    mutationFn: async (profile: SellerProfileInput) => {
      if (!USE_MOCKS) await api("/me/seller-profile", { method: "PUT", body: profile });
      return profile;
    },
    onSuccess: (profile) => {
      setCached({ profile });
      setSaved(true);
      toast("Profile saved.");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Your profile was not saved.", "danger"),
  });

  const submitVerification = useMutation({
    mutationFn: async (body: { idDocumentType: string; documentReference: string }) => {
      if (!USE_MOCKS) await api("/me/seller-profile/submit", { method: "POST", body });
    },
    onSuccess: () => {
      setStatus("PENDING_VERIFICATION");
      setCached({ verification: "PENDING_VERIFICATION" });
      toast("ID submitted. An admin will review it shortly.");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Your ID was not submitted.", "danger"),
  });

  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = sellerProfileSchema.safeParse(form);
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (parsed.success) saveProfile.mutate(parsed.data);
  }

  function submitId(e: React.FormEvent) {
    e.preventDefault();
    const parsed = idVerificationSchema.safeParse(doc);
    setDocErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (parsed.success) submitVerification.mutate(parsed.data);
  }

  const aboutLen = form.about.trim().length;

  return (
    <div className="space-y-8">
      <form onSubmit={save} noValidate className="space-y-6">
        <Card className="space-y-5 p-5">
          <h2 className="text-base font-semibold">Public profile</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="displayName" label="Display name" error={errors.displayName}>
              {(p) => <Input {...p} value={form.displayName} maxLength={80} onChange={(e) => set("displayName", e.target.value)} />}
            </Field>
            <Field id="country" label="Country" error={errors.country}>
              {(p) => <Input {...p} value={form.country} maxLength={60} onChange={(e) => set("country", e.target.value)} />}
            </Field>
          </div>
          <Field id="headline" label="Headline" counter={`${form.headline.length}/80`} error={errors.headline}>
            {(p) => <Input {...p} value={form.headline} maxLength={80} onChange={(e) => set("headline", e.target.value)} />}
          </Field>
          <Field
            id="about"
            label="About"
            hint="Between 150 and 600 characters."
            counter={`${aboutLen}/600`}
            error={errors.about}
          >
            {(p) => <Textarea {...p} className="min-h-36" value={form.about} maxLength={600} onChange={(e) => set("about", e.target.value)} />}
          </Field>
        </Card>

        <Card className="space-y-4 p-5">
          <fieldset className="space-y-3">
            <legend className="text-base font-semibold text-heading">Languages</legend>
            {form.languages.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Field id={`lang-${i}`} label="Language" error={errors[`languages.${i}.language`]}>
                  {(p) => (
                    <Input
                      {...p}
                      value={l.language}
                      onChange={(e) => set("languages", form.languages.map((x, j) => (j === i ? { ...x, language: e.target.value } : x)))}
                    />
                  )}
                </Field>
                <Field id={`prof-${i}`} label="Proficiency">
                  {(p) => (
                    <Select
                      {...p}
                      value={l.proficiency}
                      onChange={(e) =>
                        set(
                          "languages",
                          form.languages.map((x, j) => (j === i ? { ...x, proficiency: e.target.value as (typeof PROFICIENCIES)[number] } : x)),
                        )
                      }
                    >
                      {PROFICIENCIES.map((v) => (
                        <option key={v} value={v}>
                          {PROFICIENCY_LABELS[v]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${l.language || "language"}`}
                  onClick={() => set("languages", form.languages.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {errors.languages ? <p className="text-xs font-semibold text-red-700">{errors.languages}</p> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("languages", [...form.languages, { language: "", proficiency: "CONVERSATIONAL" }])}
            >
              <Plus aria-hidden /> Add language
            </Button>
          </fieldset>
        </Card>

        <Card className="space-y-4 p-5">
          <fieldset className="space-y-3">
            <legend className="text-base font-semibold text-heading">Skills</legend>
            {form.skills.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Field id={`skill-${i}`} label="Skill" error={errors[`skills.${i}.skillName`]}>
                  {(p) => (
                    <Input
                      {...p}
                      value={s.skillName}
                      onChange={(e) => set("skills", form.skills.map((x, j) => (j === i ? { ...x, skillName: e.target.value } : x)))}
                    />
                  )}
                </Field>
                <Field id={`level-${i}`} label="Experience">
                  {(p) => (
                    <Select
                      {...p}
                      value={s.level}
                      onChange={(e) =>
                        set("skills", form.skills.map((x, j) => (j === i ? { ...x, level: e.target.value as (typeof SKILL_LEVELS)[number] } : x)))
                      }
                    >
                      {SKILL_LEVELS.map((v) => (
                        <option key={v} value={v}>
                          {SKILL_LEVEL_LABELS[v]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${s.skillName || "skill"}`}
                  onClick={() => set("skills", form.skills.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {errors.skills ? <p className="text-xs font-semibold text-red-700">{errors.skills}</p> : null}
            <Button type="button" variant="outline" size="sm" onClick={() => set("skills", [...form.skills, { skillName: "", level: "INTERMEDIATE" }])}>
              <Plus aria-hidden /> Add skill
            </Button>
          </fieldset>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit">Save profile</Button>
          <p aria-live="polite" className="text-sm font-semibold text-emerald-800">
            {saved ? "Profile saved." : ""}
          </p>
        </div>
        {Object.keys(errors).length > 0 ? <Alert variant="danger">Please fix the highlighted fields.</Alert> : null}
      </form>

      <Card id="verification" className="scroll-mt-40 space-y-4 p-5">
        <h2 className="text-base font-semibold">ID verification</h2>
        <Alert variant={VERIFICATION_TEXT[status].variant}>{VERIFICATION_TEXT[status].text}</Alert>
        {status === "NOT_SUBMITTED" || status === "REJECTED" ? (
          <form onSubmit={submitId} noValidate className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field id="idDocumentType" label="Document type">
              {(p) => (
                <Select {...p} value={doc.idDocumentType} onChange={(e) => setDoc((d) => ({ ...d, idDocumentType: e.target.value }))}>
                  {ID_DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ID_DOCUMENT_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="documentReference" label="Document number" error={docErrors.documentReference}>
              {(p) => <Input {...p} value={doc.documentReference} onChange={(e) => setDoc((d) => ({ ...d, documentReference: e.target.value }))} />}
            </Field>
            <Button type="submit">Submit for review</Button>
          </form>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setStatus("NOT_SUBMITTED")}>
            Demo: reset verification
          </Button>
        )}
      </Card>
    </div>
  );
}
