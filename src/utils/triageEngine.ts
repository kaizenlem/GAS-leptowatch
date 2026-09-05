import { PatientFormData, TriageResult } from "../types";

/**
 * Deterministic DOH Philippines 2026 Leptospirosis Triage Rule Engine.
 * Ensures strict compliance with Department of Health clinical protocols
 * even during intermittent 3G or total offline connectivity.
 */
export function evaluateClientDOHRules(data: PatientFormData): TriageResult {
  const {
    flood_exposure,
    fever,
    myalgia,
    jaundice,
    oliguria,
    red_eyes,
    headache,
    symptom_days,
  } = data;

  // 1. CRITICAL RISK: Flood exposure + fever + (jaundice OR oliguria)
  if (flood_exposure && fever && (jaundice || oliguria)) {
    const signs: string[] = [];
    if (jaundice) signs.push("jaundice (hepatic compromise)");
    if (oliguria) signs.push("oliguria (acute renal risk)");

    return {
      risk_level: "CRITICAL",
      recommendation:
        "URGENT: Suspected Weil's disease. Administer doxycycline 100mg BID. Refer immediately to DOH hospital with leptospirosis fast lane.",
      citations: [
        "DOH Leptospirosis Fast Lane Protocol 2026",
        "WHO Severe Leptospirosis Guidelines",
      ],
      reasoning: `Patient has documented flood exposure, acute fever, and severe organ dysfunction (${signs.join(
        " and "
      )}). Immediate transfer via DOH fast lane is mandatory.`,
      is_ai_generated: false,
      model_used: "DOH 2026 Protocol Cache (Offline)",
    };
  }

  // 2. HIGH RISK: Flood exposure + fever + myalgia
  if (flood_exposure && fever && myalgia) {
    const extra: string[] = [];
    if (red_eyes) extra.push("conjunctival suffusion");
    if (headache) extra.push("severe headache");

    return {
      risk_level: "HIGH",
      recommendation:
        "Suspected leptospirosis. Administer doxycycline 100mg BID. Refer for labs (CBC, creatinine, LFT). Monitor for jaundice, oliguria, bleeding.",
      citations: [
        "DOH Leptospirosis Clinical Guidelines 2026",
        "WHO Case Definition",
      ],
      reasoning: `Classic triad of flood exposure, fever, and severe myalgia (calves/back)${
        extra.length ? ` with ${extra.join(" and ")}` : ""
      } within symptom day ${symptom_days} requires prompt therapeutic antibiotic treatment.`,
      is_ai_generated: false,
      model_used: "DOH 2026 Protocol Cache (Offline)",
    };
  }

  // 3. MODERATE RISK: Flood exposure + fever only
  if (flood_exposure && fever) {
    return {
      risk_level: "MODERATE",
      recommendation:
        "Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately. Consider doxycycline prophylaxis per DOH guidelines.",
      citations: ["DOH Prophylaxis Guidelines 2026"],
      reasoning:
        "Flood exposure with active fever without overt calf pain or organ signs. Requires close 48-hour ambulatory watch and prophylaxis evaluation.",
      is_ai_generated: false,
      model_used: "DOH 2026 Protocol Cache (Offline)",
    };
  }

  // 4. LOW RISK: No flood exposure
  if (!flood_exposure) {
    return {
      risk_level: "LOW",
      recommendation:
        "Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
      citations: [
        "DOH Primary Care Guidelines",
        "CDC Leptospirosis Epidemiology",
      ],
      reasoning:
        "Absence of contaminated floodwater or animal urine contact in the 2-4 week incubation timeframe makes leptospirosis clinically unlikely.",
      is_ai_generated: false,
      model_used: "DOH 2026 Protocol Cache (Offline)",
    };
  }

  // Fallback: Flood exposure with no fever
  return {
    risk_level: "LOW",
    recommendation:
      "Asymptomatic flood exposure. Health education on symptom watch. Consider single dose doxycycline prophylaxis (200mg) if exposure occurred within 72 hours.",
    citations: [
      "DOH Prophylaxis Guidelines 2026",
      "CDC Leptospirosis Epidemiology",
    ],
    reasoning:
      "Patient reports flood exposure without active fever or systemic symptoms. Educate on warning signs.",
    is_ai_generated: false,
    model_used: "DOH 2026 Protocol Cache (Offline)",
  };
}
