import { PatientFormData, TriageFactor, TriageResult } from "../types";
import { RULESET_VERSION, DOH_FAST_LANE, WHO_GUIDANCE, CDC_OVERVIEW } from "../sources";

const UNKNOWN_DECLARATIONS = new Set([
  "unknown", "unclear", "not sure", "na", "n/a", "n/k", "none recorded", "?",
]);

function triFactor(value: TriageFactor | boolean | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const v = value.trim().toLowerCase();
  if (UNKNOWN_DECLARATIONS.has(v)) return null;
  if (v === "yes" || v === "true" || v === "1") return true;
  if (v === "no" || v === "false" || v === "0") return false;
  return Boolean(value);
}

/**
 * Deterministic Leptospirosis Triage Rule Engine.
 * Rule set derived from verified Philippine DOH and WHO leptospirosis guidance.
 * Executes client-side even during intermittent 3G or total offline connectivity.
 * Never prescribes medication or dosing - treatment decisions are referred to the physician.
 */
export function evaluateClientDOHRules(data: PatientFormData): TriageResult {
  const flood = triFactor(data.flood_exposure);
  const fever = triFactor(data.fever);
  const myalgia = triFactor(data.myalgia);
  const jaundice = triFactor(data.jaundice);
  const oliguria = triFactor(data.oliguria);
  const red_eyes = triFactor(data.red_eyes);
  const headache = triFactor(data.headache);
  const symptom_days = data.symptom_days;

  // INSUFFICIENT_INFORMATION: flood exposure is the single most decisive factor.
  if (flood === null || fever === null) {
    return {
      risk_level: "INSUFFICIENT_INFORMATION",
      recommendation:
        "Insufficient information to safely classify this patient. Confirm flood exposure history and fever status before triage; consult with the physician on duty.",
      citations: [WHO_GUIDANCE],
      reasoning:
        "Flood exposure and fever status are decisive for leptospirosis risk stratification and were not fully recorded.",
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    };
  }

  // 1. CRITICAL RISK: Flood exposure + fever + (jaundice OR oliguria)
  if (flood && fever && (jaundice || oliguria)) {
    const signs: string[] = [];
    if (jaundice) signs.push("jaundice (hepatic compromise)");
    if (oliguria) signs.push("oliguria (acute renal risk)");

    return {
      risk_level: "CRITICAL",
      recommendation:
        "URGENT: Suspected severe leptospirosis (Weil's disease). Refer immediately for physician / DOH hospital clinical management via the leptospirosis fast lane. Do not delay transfer.",
      citations: [DOH_FAST_LANE, WHO_GUIDANCE],
      reasoning: `Patient has documented flood exposure, acute fever, and severe organ dysfunction (${signs.join(
        " and "
      )}). Immediate referral via the DOH fast lane is required.`,
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    };
  }

  // 2. HIGH RISK: Flood exposure + fever + myalgia
  if (flood && fever && myalgia) {
    const extra: string[] = [];
    if (red_eyes) extra.push("conjunctival suffusion");
    if (headache) extra.push("severe headache");

    return {
      risk_level: "HIGH",
      recommendation:
        "Suspected leptospirosis. Refer for physician evaluation and laboratory testing (CBC, creatinine, liver function). Monitor for jaundice, oliguria, and bleeding; follow DOH fast lane referral process.",
      citations: [DOH_FAST_LANE, WHO_GUIDANCE],
      reasoning: `Classic triad of flood exposure, fever, and severe myalgia (calves/back)${
        extra.length ? ` with ${extra.join(" and ")}` : ""
      } within symptom day ${symptom_days} requires prompt clinical evaluation.`,
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    };
  }

  // 3. MODERATE RISK: Flood exposure + fever only
  if (flood && fever) {
    return {
      risk_level: "MODERATE",
      recommendation:
        "Flood exposure with fever. Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately for physician evaluation, including prophylaxis considerations per DOH guidance.",
      citations: [DOH_FAST_LANE, WHO_GUIDANCE],
      reasoning:
        "Flood exposure with active fever without overt calf pain or organ signs. Requires close 48-hour ambulatory watch and physician evaluation.",
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    };
  }

  // 4. LOW RISK: No flood exposure
  if (!flood) {
    return {
      risk_level: "LOW",
      recommendation:
        "Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
      citations: [WHO_GUIDANCE, CDC_OVERVIEW],
      reasoning:
        "Absence of contaminated floodwater or animal urine contact in the 2-4 week incubation timeframe makes leptospirosis clinically unlikely.",
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    };
  }

  // Fallback: Flood exposure with no fever
  return {
    risk_level: "LOW",
    recommendation:
      "Flood exposure without active fever or systemic symptoms. Health education on symptom watch. Advise physician consultation regarding prophylactic management if exposure occurred recently.",
    citations: [DOH_FAST_LANE, CDC_OVERVIEW],
    reasoning:
      "Patient reports flood exposure without active fever or systemic symptoms. Educate on warning signs.",
    is_ai_generated: false,
    model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
  };
}