export type RiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT_INFORMATION";

export type TriageFactor = "yes" | "no" | "unknown";

export interface PatientFormData {
  flood_exposure: TriageFactor;
  flood_days_ago: number;
  fever: TriageFactor;
  myalgia: TriageFactor;
  headache: TriageFactor;
  red_eyes: TriageFactor;
  jaundice: TriageFactor;
  oliguria: TriageFactor;
  symptom_days: number;
  age: number;
  comorbidities: string;
}

export interface TriageResult {
  risk_level: RiskLevel;
  recommendation: string;
  citations: string[];
  reasoning: string;
  is_ai_generated: boolean;
  model_used?: string;
  missing_information?: string[];
  safety_flags?: string[];
  ai_commentary?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  patient_data: PatientFormData;
  result: TriageResult;
  nurse_id: string;
  synced_to_cloud: boolean;
  ruleset_version?: string;
}

export interface DOHProtocolItem {
  criteria: string;
  action: string;
  citations: string[];
}