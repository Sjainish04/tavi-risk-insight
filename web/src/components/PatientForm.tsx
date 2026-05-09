import { ChevronDown, Database, Image, Loader2 } from "lucide-react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { type PatientFormValues, demoPresets, patientSchema } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

const fieldLabel = "block text-xs font-medium text-gray-700 mb-1";
const fieldInput =
  "w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-sm bg-white focus:border-ibm-500 focus:ring-1 focus:ring-ibm-500 outline-none";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className={fieldLabel}>
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1">· {hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const COMORBIDITIES = [
  ["diabetes", "Diabetes"],
  ["chronic_lung_disease", "COPD / lung disease"],
  ["prior_mi", "Prior MI"],
  ["prior_pci", "Prior PCI"],
  ["prior_cabg", "Prior CABG"],
  ["prior_stroke", "Prior stroke / TIA"],
  ["peripheral_vascular_disease", "PVD"],
  ["atrial_fibrillation", "Atrial fibrillation"],
  ["prior_pacemaker", "Prior pacemaker"],
  ["on_dialysis", "On dialysis"],
] as const;

interface SectionProps {
  title: string;
  source?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, source, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {source && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-sm">
              {source}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}

export function PatientForm() {
  const submit = usePrediction((s) => s.predict);
  const loading = usePrediction((s) => s.loading);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: demoPresets.intermediateRisk.values,
  });

  const onSubmit: SubmitHandler<PatientFormValues> = async (values) => {
    await submit(values as never);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="ibm-card sticky top-4"
    >
      {/* EHR loader */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-md">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-2">
          <Database className="w-3.5 h-3.5 text-ibm-500" />
          Load case from EHR (FHIR / Epic Cupid)
        </div>
        <div className="space-y-1">
          {Object.entries(demoPresets).map(([k, p]) => (
            <button
              type="button"
              key={k}
              onClick={() => reset(p.values)}
              className="w-full text-left px-2 py-1.5 hover:bg-white border border-transparent hover:border-gray-200 rounded-sm transition-colors group"
            >
              <div className="text-xs font-medium text-gray-900 group-hover:text-ibm-700">
                {p.label}
              </div>
              <div className="text-[11px] text-gray-500 leading-snug">
                {p.sublabel}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-3">
        <Section title="Demographics" source="EHR">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age (yrs)" error={errors.age_years?.message}>
              <input
                type="number"
                step="1"
                {...register("age_years")}
                className={fieldInput}
              />
            </Field>
            <Field label="Sex" error={errors.sex?.message}>
              <select {...register("sex")} className={fieldInput}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="BMI" hint="kg/m²" error={errors.bmi?.message}>
              <input
                type="number"
                step="0.1"
                {...register("bmi")}
                className={fieldInput}
              />
            </Field>
            <Field label="NYHA class" error={errors.nyha_class?.message}>
              <select {...register("nyha_class")} className={fieldInput}>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Aortic stenosis severity" source="Echo">
          <p className="text-[11px] text-gray-500 -mt-1 leading-snug">
            Required to confirm severe AS (ACC/AHA 2020 criteria).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="AVA"
              hint="cm²"
              error={errors.aortic_valve_area_cm2?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("aortic_valve_area_cm2")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Mean gradient"
              hint="mmHg"
              error={errors.mean_aortic_gradient_mmhg?.message}
            >
              <input
                type="number"
                step="1"
                {...register("mean_aortic_gradient_mmhg")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Peak velocity"
              hint="m/s"
              error={errors.peak_aortic_velocity_m_per_s?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("peak_aortic_velocity_m_per_s")}
                className={fieldInput}
              />
            </Field>
            <Field label="Aortic regurgitation" error={errors.aortic_regurgitation_grade?.message}>
              <select
                {...register("aortic_regurgitation_grade", { valueAsNumber: true })}
                className={fieldInput}
              >
                <option value={0}>0 — none</option>
                <option value={1}>1 — mild</option>
                <option value={2}>2 — moderate</option>
                <option value={3}>3 — severe</option>
              </select>
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 px-1.5 py-1 rounded-sm">
              <input
                type="checkbox"
                {...register("bicuspid_valve")}
                className="w-3.5 h-3.5 text-ibm-500 border-gray-300 rounded-sm focus:ring-ibm-500"
              />
              Bicuspid aortic valve
            </label>
          </div>
        </Section>

        <Section title="Cardiac &amp; renal" source="EHR labs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="LVEF" hint="% (echo)" error={errors.lvef_pct?.message}>
              <input
                type="number"
                step="1"
                {...register("lvef_pct")}
                className={fieldInput}
              />
            </Field>
            <Field label="eGFR" hint="mL/min/1.73m²" error={errors.egfr?.message}>
              <input
                type="number"
                step="1"
                {...register("egfr")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Creatinine"
              hint="mg/dL"
              error={errors.creatinine_mg_dl?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("creatinine_mg_dl")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Hemoglobin"
              hint="g/dL"
              error={errors.hemoglobin_g_dl?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("hemoglobin_g_dl")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Albumin"
              hint="g/dL"
              error={errors.albumin_g_dl?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("albumin_g_dl")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="NT-proBNP"
              hint="pg/mL"
              error={errors.nt_probnp_pg_ml?.message}
            >
              <input
                type="number"
                step="50"
                {...register("nt_probnp_pg_ml")}
                className={fieldInput}
              />
            </Field>
          </div>
        </Section>

        <Section title="Comorbidities" source="ICD problem list">
          <div className="grid grid-cols-2 gap-1.5">
            {COMORBIDITIES.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 px-1.5 py-1 rounded-sm"
              >
                <input
                  type="checkbox"
                  {...register(key as keyof PatientFormValues)}
                  className="w-3.5 h-3.5 text-ibm-500 border-gray-300 rounded-sm focus:ring-ibm-500"
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Procedural &amp; frailty" source="Heart Team">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Urgency" error={errors.urgency?.message}>
              <select {...register("urgency")} className={fieldInput}>
                <option value="elective">Elective</option>
                <option value="urgent">Urgent</option>
                <option value="emergent">Emergent</option>
              </select>
            </Field>
            <Field
              label="Gait speed"
              hint="m/s (5-meter walk)"
              error={errors.gait_speed_m_per_s?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("gait_speed_m_per_s")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Clinical Frailty Scale"
              hint="Rockwood 1–9"
              error={errors.clinical_frailty_scale?.message}
              className="col-span-2"
            >
              <input
                type="number"
                step="1"
                min={1}
                max={9}
                {...register("clinical_frailty_scale", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
                className={fieldInput}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Pre-procedural CT"
          source="PACS · 3mensio"
          defaultOpen={false}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
            <Image className="w-3 h-3" />
            Optional. When provided, modulates the per-device sizing, coronary risk, and considerations.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Annular area"
              hint="mm²"
              error={errors.annular_area_mm2?.message}
            >
              <input
                type="number"
                step="1"
                {...register("annular_area_mm2")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Annular perimeter"
              hint="mm"
              error={errors.annular_perimeter_mm?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("annular_perimeter_mm")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Calcium volume"
              hint="Agatston-AU"
              error={errors.calcium_volume_au?.message}
            >
              <input
                type="number"
                step="50"
                {...register("calcium_volume_au")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Membranous septum"
              hint="mm length"
              error={errors.membranous_septum_length_mm?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("membranous_septum_length_mm")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Left-main height"
              hint="mm above annulus"
              error={errors.distance_to_left_main_mm?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("distance_to_left_main_mm")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Right-coronary height"
              hint="mm above annulus"
              error={errors.distance_to_right_coronary_mm?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register("distance_to_right_coronary_mm")}
                className={fieldInput}
              />
            </Field>
            <Field
              label="Sinus of Valsalva"
              hint="diameter mm"
              error={errors.sinus_of_valsalva_diameter_mm?.message}
              className="col-span-2"
            >
              <input
                type="number"
                step="0.1"
                {...register("sinus_of_valsalva_diameter_mm")}
                className={fieldInput}
              />
            </Field>
          </div>
        </Section>
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-md">
        <button
          type="submit"
          disabled={loading}
          className="ibm-btn-primary w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Computing risk &amp; assessments…
            </>
          ) : (
            "Run Heart Team analysis"
          )}
        </button>
      </div>
    </form>
  );
}
