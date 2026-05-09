// Mirrors api/src/tavi_api/schemas.py — keep in sync.

export type Sex = "male" | "female";
export type NyhaClass = "I" | "II" | "III" | "IV";
export type Urgency = "elective" | "urgent" | "emergent";
export type SeverityClass =
  | "severe"
  | "very_severe"
  | "low_flow_low_gradient"
  | "moderate"
  | "not_severe";
export type CoronaryRiskGrade = "low" | "intermediate" | "high";

export interface PatientInput {
  age_years: number;
  sex: Sex;
  bmi: number;
  lvef_pct: number;
  egfr: number;
  creatinine_mg_dl: number;
  hemoglobin_g_dl: number;
  albumin_g_dl: number;
  nt_probnp_pg_ml?: number | null;
  // Aortic-valve hemodynamics (echo) — required for severity assessment
  aortic_valve_area_cm2: number;
  mean_aortic_gradient_mmhg: number;
  peak_aortic_velocity_m_per_s: number;
  // Concomitant valve / morphology
  aortic_regurgitation_grade: 0 | 1 | 2 | 3;
  bicuspid_valve: boolean;
  // Comorbidities
  diabetes: boolean;
  chronic_lung_disease: boolean;
  prior_mi: boolean;
  prior_pci: boolean;
  prior_cabg: boolean;
  prior_stroke: boolean;
  peripheral_vascular_disease: boolean;
  atrial_fibrillation: boolean;
  prior_pacemaker: boolean;
  on_dialysis: boolean;
  // Clinical state
  nyha_class: NyhaClass;
  urgency: Urgency;
  // Frailty
  gait_speed_m_per_s?: number | null;
  five_chair_rises_s?: number | null;
  clinical_frailty_scale?: number | null;
  // CT-derived
  annular_area_mm2?: number | null;
  annular_perimeter_mm?: number | null;
  calcium_volume_au?: number | null;
  membranous_septum_length_mm?: number | null;
  distance_to_left_main_mm?: number | null;
  distance_to_right_coronary_mm?: number | null;
  sinus_of_valsalva_diameter_mm?: number | null;
}

export type ValveClass =
  | "balloon-expandable"
  | "self-expanding-supra-annular"
  | "self-expanding-intra-annular";

export interface AnnularSizing {
  recommended_size_mm: number | null;
  recommended_size_label: string;
  oversizing_pct: number | null;
  in_range: boolean;
  note: string;
}

export interface CoronaryObstructionRisk {
  grade: CoronaryRiskGrade;
  reasons: string[];
}

export interface DeviceAssessment {
  valve: string;
  valve_class: ValveClass;
  predicted_mortality_30d: number;
  predicted_ppm_30d: number;
  predicted_pvl_moderate: number;
  sizing: AnnularSizing;
  coronary_risk: CoronaryObstructionRisk;
  considerations: string[];
  notes: string[];
}

// Backward compatibility for any consumer still on DeviceSimulation
export type DeviceSimulation = Pick<
  DeviceAssessment,
  "valve" | "valve_class" | "predicted_mortality_30d" | "predicted_ppm_30d" | "predicted_pvl_moderate" | "notes"
>;

export interface ScoreEstimate {
  name: string;
  raw_probability: number;
  recalibrated_probability: number | null;
  decile: number | null;
  miscalibration_note: string | null;
}

export interface ProbabilityWithCI {
  p: number;
  lo: number;
  hi: number;
  base_rate: number;
  multiplier_vs_base: number;
}

export interface ComplicationRisks {
  stroke_30d: ProbabilityWithCI;
  aki_2_3_30d: ProbabilityWithCI;
  major_vascular_30d: ProbabilityWithCI;
  life_threatening_bleed_30d: ProbabilityWithCI;
}

export interface SeverityAssessment {
  is_severe: boolean;
  severity_class: SeverityClass;
  criteria_met: string[];
  notes: string | null;
}

export interface FutilityAssessment {
  is_futile: boolean;
  composite_score: number;
  drivers: string[];
  alternative: string;
  evidence: string;
}

export interface RiskScoreDriver {
  feature_label: string;
  raw_feature_name: string;
  current_value: string;
  effect: "increases" | "decreases";
  magnitude_pp: number;
  is_modifiable: boolean;
  modify_to: string | null;
}

export interface ShapContribution {
  feature: string;
  value: number | string | boolean | null;
  shap_value: number;
  direction: "increases" | "decreases";
}

export interface DecisionCurvePoint {
  threshold: number;
  net_benefit_model: number;
  net_benefit_treat_all: number;
  net_benefit_treat_none: number;
}

export interface RiskOutput {
  severity: SeverityAssessment;
  futility: FutilityAssessment;
  sts_prom: ScoreEstimate;
  euroscore_ii: ScoreEstimate;
  tvt: ScoreEstimate;
  lgbm: ScoreEstimate;
  brdav: ScoreEstimate | null;
  primary_model_name: string;
  lgbm_ci: [number, number];
  lgbm_decile: number;
  lgbm_base_rate_comparison: number;
  risk_score_drivers: RiskScoreDriver[];
  shap_top5: ShapContribution[];
  decision_curve: DecisionCurvePoint[];
  complication_risks: ComplicationRisks;
  device_assessments: DeviceAssessment[];
  miscalibration_zone: boolean;
  miscalibration_message: string | null;
  feature_summary: Record<string, number | string | boolean | null>;
  has_ct_inputs: boolean;
}

export interface ExplainRequest {
  features: Record<string, number | string | boolean | null>;
  sts_prom_raw: number;
  sts_prom_recalibrated: number;
  euroscore_ii: number;
  tvt: number;
  lgbm_probability: number;
  shap_top5: ShapContribution[];
  miscalibration_zone: boolean;
  severity_class?: string | null;
  futility_flag?: boolean;
  complication_top?: string[];
  device_pick_reason?: string | null;
  top_modifiable_driver?: string | null;
}
