"""
Leptospirosis Triage Logic Engine (Rule-Based + Gemini Hybrid).
Rule set derived from verified Philippine DOH and WHO leptospirosis guidance.
The deterministic rule engine is AUTHORITATIVE for risk classification and escalation;
Gemini acts as an explanation/context layer only and can never change the risk level.
"""

from typing import Dict, Any, Tuple

from sources import RULESET_VERSION, DOH_FAST_LANE, WHO_GUIDANCE, CDC_OVERVIEW
from gemini_client import GeminiTriageClient, TriageResult


def rule_based_triage(patient_data: Dict[str, Any]) -> TriageResult:
    """
    Deterministic Leptospirosis Triage Rule Engine.

    Risk Stratification Rules:
    1. CRITICAL: Flood exposure + fever + (jaundice OR oliguria)
       -> Suspected Weil's disease. Refer immediately to DOH leptospirosis fast lane.
    2. HIGH: Flood exposure + fever + myalgia
       -> Suspected leptospirosis. Refer for physician evaluation and labs.
    3. MODERATE: Flood exposure + fever only (no myalgia/jaundice/oliguria)
       -> 48h observation + physician evaluation for prophylaxis considerations.
    4. LOW: No flood exposure (regardless of other symptoms) OR no fever/exposure.
       -> Likely viral illness, symptomatic care, return precautions.
    5. INSUFFICIENT_INFORMATION: Key risk factors not recorded.
       -> Cannot safely classify; recommend clinical review.

    NOTE: The rule engine NEVER prescribes medication or dosing. Treatment decisions
    are always referred to the attending physician / DOH clinical management.
    """
    flood = patient_data.get("flood_exposure")
    fever = patient_data.get("fever")
    myalgia = patient_data.get("myalgia")
    jaundice = patient_data.get("jaundice")
    oliguria = patient_data.get("oliguria")
    red_eyes = patient_data.get("red_eyes")
    headache = patient_data.get("headache")
    symptom_days = patient_data.get("symptom_days", 2)

    # INSUFFICIENT_INFORMATION: flood exposure is the single most decisive risk factor.
    # If it was not recorded, safe classification is not possible.
    if flood is None or fever is None:
        return TriageResult(
            risk_level="INSUFFICIENT_INFORMATION",
            recommendation="Insufficient information to safely classify this patient. Confirm flood exposure history and fever status before triage; consult with the physician on duty.",
            citations=[WHO_GUIDANCE],
            reasoning="Flood exposure and fever status are decisive for leptospirosis risk stratification and were not fully recorded.",
            is_ai_generated=False,
            model_used=f"Deterministic Rule Engine v{RULESET_VERSION}",
        )

    flood = bool(flood)
    fever = bool(fever)

    # 1. CRITICAL RISK: Flood exposure + fever + (jaundice OR oliguria)
    if flood and fever and (jaundice or oliguria):
        details = []
        if jaundice:
            details.append("jaundice (hepatic involvement)")
        if oliguria:
            details.append("oliguria (acute kidney injury sign)")
        symptoms_str = " and ".join(details)

        return TriageResult(
            risk_level="CRITICAL",
            recommendation="URGENT: Suspected severe leptospirosis (Weil's disease). Refer immediately for physician / DOH hospital clinical management via the leptospirosis fast lane. Do not delay transfer.",
            citations=[DOH_FAST_LANE, WHO_GUIDANCE],
            reasoning=f"Patient presents with flood exposure, active fever, and severe organ involvement ({symptoms_str}) indicating high risk for Weil's disease.",
            is_ai_generated=False,
            model_used=f"Deterministic Rule Engine v{RULESET_VERSION}",
        )

    # 2. HIGH RISK: Flood exposure + fever + myalgia
    if flood and fever and myalgia:
        extra_signs = []
        if red_eyes:
            extra_signs.append("conjunctival suffusion")
        if headache:
            extra_signs.append("severe headache")
        extra_txt = f" with {', '.join(extra_signs)}" if extra_signs else ""

        return TriageResult(
            risk_level="HIGH",
            recommendation="Suspected leptospirosis. Refer for physician evaluation and laboratory testing (CBC, creatinine, liver function). Monitor for jaundice, oliguria, and bleeding; follow DOH fast lane referral process.",
            citations=[DOH_FAST_LANE, WHO_GUIDANCE],
            reasoning=f"Classic clinical triad of floodwater exposure, fever, and severe myalgia (especially calf/back){extra_txt} within the {symptom_days}-day window meets criteria for suspected active leptospirosis.",
            is_ai_generated=False,
            model_used=f"Deterministic Rule Engine v{RULESET_VERSION}",
        )

    # 3. MODERATE RISK: Flood exposure + fever only
    if flood and fever:
        return TriageResult(
            risk_level="MODERATE",
            recommendation="Flood exposure with fever. Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately for physician evaluation, including prophylaxis considerations per DOH guidance.",
            citations=[DOH_FAST_LANE, WHO_GUIDANCE],
            reasoning="Patient has documented flood exposure and fever without overt calf pain or jaundice. Requires close 48-hour ambulatory watch and physician evaluation.",
            is_ai_generated=False,
            model_used=f"Deterministic Rule Engine v{RULESET_VERSION}",
        )

    # 4. LOW RISK: No flood exposure or isolated symptoms
    if not flood:
        return TriageResult(
            risk_level="LOW",
            recommendation="Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
            citations=[WHO_GUIDANCE, CDC_OVERVIEW],
            reasoning="Absence of contaminated floodwater or animal urine contact in the 2-4 week incubation window makes leptospirosis unlikely.",
            is_ai_generated=False,
            model_used=f"Deterministic Rule Engine v{RULESET_VERSION}",
        )

    # Fallback for flood exposure without fever
    return TriageResult(
        risk_level="LOW",
        recommendation="Flood exposure without active fever or systemic symptoms. Provide health education on early symptoms (fever, calf pain, red eyes). Advise physician consultation regarding prophylactic management if exposure occurred recently.",
        citations=[DOH_FAST_LANE, CDC_OVERVIEW],
        reasoning="Patient has flood exposure but no active fever or systemic symptoms. Observe for up to 30 days.",
        is_ai_generated=False,
        model_used=f"Deterministic Rule Engine v{RULESET_VERSION}",
    )


def assess_patient(patient_data: Dict[str, Any], use_ai: bool = True) -> Tuple[TriageResult, bool]:
    """
    Evaluates a patient with the deterministic rule engine as the authoritative source.
    Gemini contributes context, explanation, and missing-information flags only.

    Returns: (TriageResult, was_fallback_used)
    """
    rule_result = rule_based_triage(patient_data)

    if not use_ai:
        return rule_result, True

    gemini_client = GeminiTriageClient()
    ai_result = gemini_client.explain_result(patient_data, rule_result)

    if ai_result is None:
        # Fallback to pure rule-based logic
        return rule_result, True

    return ai_result, False