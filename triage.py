"""
Leptospirosis Triage Logic Engine (Rule-Based + Gemini Hybrid).
Implements exact Department of Health (DOH) Philippines 2026 Clinical & Fast Lane Guidelines.
Ensures 100% adherence to deterministic clinical safety rules with Gemini AI co-pilot insights.
"""

from typing import Dict, Any, Tuple
from gemini_client import GeminiTriageClient, TriageResult
from firestore_client import get_cached_doh_protocols


def rule_based_triage(patient_data: Dict[str, Any]) -> TriageResult:
    """
    Deterministic DOH Philippines 2026 Leptospirosis Triage Rule Engine.

    Risk Stratification Rules:
    1. CRITICAL: Flood exposure + fever + (jaundice OR oliguria)
       -> Suspected Weil's disease. Fast Lane referral immediately + Doxycycline 100mg BID.
    2. HIGH: Flood exposure + fever + myalgia
       -> Suspected leptospirosis. Doxycycline 100mg BID + labs (CBC, creatinine, LFT).
    3. MODERATE: Flood exposure + fever only (no myalgia/jaundice/oliguria)
       -> 48h observation + DOH prophylaxis considerations.
    4. LOW: No flood exposure (regardless of other symptoms) OR no fever/exposure.
       -> Likely viral illness, symptomatic care, return precautions.
    """
    flood = bool(patient_data.get("flood_exposure"))
    fever = bool(patient_data.get("fever"))
    myalgia = bool(patient_data.get("myalgia"))
    jaundice = bool(patient_data.get("jaundice"))
    oliguria = bool(patient_data.get("oliguria"))
    red_eyes = bool(patient_data.get("red_eyes"))
    headache = bool(patient_data.get("headache"))
    symptom_days = patient_data.get("symptom_days", 2)

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
            recommendation="URGENT: Suspected Weil's disease. Administer doxycycline 100mg BID. Refer immediately to DOH hospital with leptospirosis fast lane.",
            citations=[
                "DOH Leptospirosis Fast Lane Protocol 2026",
                "WHO Severe Leptospirosis Guidelines"
            ],
            reasoning=f"Patient presents with flood exposure, active fever, and severe organ involvement ({symptoms_str}) indicating high risk for Weil's disease.",
            is_ai_generated=False,
            model_used="DOH 2026 Rule Engine"
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
            recommendation="Suspected leptospirosis. Administer doxycycline 100mg BID. Refer for labs (CBC, creatinine, LFT). Monitor for jaundice, oliguria, bleeding.",
            citations=[
                "DOH Leptospirosis Clinical Guidelines 2026",
                "WHO Case Definition"
            ],
            reasoning=f"Classic clinical triad of floodwater exposure, fever, and severe myalgia (especially calf/back){extra_txt} within the {symptom_days}-day window meets criteria for active leptospirosis.",
            is_ai_generated=False,
            model_used="DOH 2026 Rule Engine"
        )

    # 3. MODERATE RISK: Flood exposure + fever only
    if flood and fever:
        return TriageResult(
            risk_level="MODERATE",
            recommendation="Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately. Consider doxycycline prophylaxis per DOH guidelines.",
            citations=[
                "DOH Prophylaxis Guidelines 2026"
            ],
            reasoning="Patient has documented flood exposure and fever without overt calf pain or jaundice. Requires close 48-hour ambulatory watch and prophylaxis evaluation.",
            is_ai_generated=False,
            model_used="DOH 2026 Rule Engine"
        )

    # 4. LOW RISK: No flood exposure or isolated symptoms
    if not flood:
        return TriageResult(
            risk_level="LOW",
            recommendation="Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
            citations=[
                "DOH Primary Care Guidelines",
                "CDC Leptospirosis Epidemiology"
            ],
            reasoning="Absence of contaminated floodwater or animal urine contact in the 2-4 week incubation window makes leptospirosis unlikely.",
            is_ai_generated=False,
            model_used="DOH 2026 Rule Engine"
        )

    # Fallback for flood exposure without fever
    return TriageResult(
        risk_level="LOW",
        recommendation="Asymptomatic flood exposure. Provide health education on early symptoms (fever, calf pain, red eyes). Advise single-dose DOH prophylaxis if exposure occurred <72 hours ago.",
        citations=[
            "DOH Prophylaxis Guidelines 2026",
            "CDC Leptospirosis Epidemiology"
        ],
        reasoning="Patient has flood exposure but no active fever or systemic symptoms. Observe for up to 30 days.",
        is_ai_generated=False,
        model_used="DOH 2026 Rule Engine"
    )


def assess_patient(patient_data: Dict[str, Any], use_ai: bool = True) -> Tuple[TriageResult, bool]:
    """
    Evaluates a patient by calling Gemini 2.0 Flash with automated clinical guardrails.
    Returns: (TriageResult, was_fallback_used)
    """
    rule_result = rule_based_triage(patient_data)

    if not use_ai:
        return rule_result, True

    gemini_client = GeminiTriageClient()
    ai_result = gemini_client.assess_risk(patient_data)

    if ai_result is None:
        # Fallback to pure rule-based logic
        return rule_result, True

    # Clinical Safety Guardrail:
    # Under DOH protocols, if rule engine flags CRITICAL or HIGH, AI cannot downgrade it.
    severity_rank = {"LOW": 1, "MODERATE": 2, "HIGH": 3, "CRITICAL": 4}
    rule_rank = severity_rank.get(rule_result.risk_level, 1)
    ai_rank = severity_rank.get(ai_result.risk_level, 1)

    if rule_rank > ai_rank:
        # Override risk level to protect patient safety while preserving Gemini's reasoning
        ai_result.risk_level = rule_result.risk_level
        ai_result.recommendation = rule_result.recommendation
        ai_result.citations = list(dict.fromkeys(rule_result.citations + ai_result.citations))
        ai_result.reasoning = f"[Clinical Guardrail Applied] {rule_result.reasoning} {ai_result.reasoning}"

    return ai_result, False
