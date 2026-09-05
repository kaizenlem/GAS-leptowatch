"""
Gemini Client for LeptoWatch.
Gemini acts as the EXPLANATION and CLINICAL-CONTEXT layer ONLY.

The deterministic clinical rules engine is authoritative for risk classification
and escalation. Gemini must NOT:
- change the deterministic risk level
- downgrade an escalation
- invent a diagnosis
- prescribe medication or dosage
- invent clinical guidelines
- invent citations

Gemini explains the deterministic result, flags missing information, surfaces
safety concerns, and references ONLY the verified sources supplied in the prompt.
"""

import os
import json
import logging
from dataclasses import dataclass, asdict, field
from typing import Optional, List, Dict, Any

logger = logging.getLogger("leptowatch.gemini")

from sources import VERIFIED_SOURCES, RULESET_VERSION, SOURCE_REGISTRY

# Try importing the official google-genai SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-genai SDK not installed. Falling back to rule-based triage.")


@dataclass
class TriageResult:
    risk_level: str  # CRITICAL, HIGH, MODERATE, LOW, INSUFFICIENT_INFORMATION
    recommendation: str
    citations: List[str]
    reasoning: str
    is_ai_generated: bool = True
    model_used: str = "gemini-2.0-flash"
    missing_information: List[str] = field(default_factory=list)
    safety_flags: List[str] = field(default_factory=list)
    ai_commentary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


EXPLANATION_PROMPT_TEMPLATE = """You are the explanation and clinical-context layer of LeptoWatch, a triage co-pilot for Philippine rural health unit (RHU) nurses.

IMPORTANT:
The deterministic clinical rules engine is authoritative for risk classification
and escalation. You must NOT change the risk level, downgrade an escalation,
invent a diagnosis, prescribe medication or dosage, or invent clinical guidelines
or citations.

Your role is to:
1. Explain the deterministic result in concise, plain language for a rural nurse.
2. Identify relevant symptoms and risk factors present in the patient inputs.
3. Identify important missing information.
4. Flag safety concerns or contradictions (e.g. red flag signs, extreme age, high-risk comorbidities).
5. Reference ONLY the verified protocol sources supplied below, by their source_id.

PATIENT INPUT:
- Flood exposure: {flood_exposure}
- Days since flood: {flood_days_ago}
- Fever: {fever}
- Myalgia: {myalgia}
- Headache: {headache}
- Red eyes: {red_eyes}
- Jaundice: {jaundice}
- Oliguria: {oliguria}
- Symptom duration: {symptom_days} days
- Age: {age}
- Comorbidities: {comorbidities}

DETERMINISTIC RESULT (authoritative - supplied by the rule engine):
- Risk level: {risk_level}
- Recommendation: {recommendation}

VERIFIED SOURCES (ONLY these may be referenced, by source_id):
{sources_json}

Return ONLY JSON with these exact keys:
{{
  "reasoning": "string - explain the deterministic result in 1-3 sentences",
  "missing_information": [],
  "safety_flags": [],
  "protocol_references": [] 
}}
"""


class GeminiTriageClient:
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", model)
        self.client = None

        if GENAI_AVAILABLE and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error("Failed to initialize genai.Client: %s", e)
                self.client = None

    def explain_result(self, patient_info: Dict[str, Any], rule_result: TriageResult) -> Optional[TriageResult]:
        """
        Sends the deterministic result to Gemini for explanation and context.
        Returns a TriageResult that preserves the rule engine's risk level,
        recommendation, and citations, enriched with AI commentary.
        Returns None if Gemini is unavailable or errors out.
        """
        if not self.client:
            logger.info("Gemini client not initialized or missing API key.")
            return None

        sources_json = json.dumps(VERIFIED_SOURCES.get("sources", []), indent=2)

        prompt = EXPLANATION_PROMPT_TEMPLATE.format(
            flood_exposure="Yes" if patient_info.get("flood_exposure") else "No",
            flood_days_ago=patient_info.get("flood_days_ago", 7),
            fever="Yes" if patient_info.get("fever") else "No",
            myalgia="Yes" if patient_info.get("myalgia") else "No",
            headache="Yes" if patient_info.get("headache") else "No",
            red_eyes="Yes" if patient_info.get("red_eyes") else "No",
            jaundice="Yes" if patient_info.get("jaundice") else "No",
            oliguria="Yes" if patient_info.get("oliguria") else "No",
            symptom_days=patient_info.get("symptom_days", 2),
            age=patient_info.get("age", 35),
            comorbidities=patient_info.get("comorbidities", "None") or "None",
            risk_level=rule_result.risk_level,
            recommendation=rule_result.recommendation,
            sources_json=sources_json,
        )

        models_to_try = [self.model_name, "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"]
        unique_models = list(dict.fromkeys([m for m in models_to_try if m]))

        for model in unique_models:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )

                response_text = response.text or ""
                parsed = self._extract_json(response_text)
                if not parsed:
                    continue

                validated_refs = self._validate_source_refs(parsed.get("protocol_references", []))

                rule_result.missing_information = self._as_string_list(parsed.get("missing_information", []))
                rule_result.safety_flags = self._as_string_list(parsed.get("safety_flags", []))
                rule_result.ai_commentary = str(parsed.get("reasoning", "")).strip()
                rule_result.is_ai_generated = True
                rule_result.model_used = f"Deterministic Rule Engine v{RULESET_VERSION} + {model}"
                if validated_refs:
                    rule_result.citations = list(dict.fromkeys(rule_result.citations + validated_refs))

                return rule_result
            except Exception as e:
                logger.info("Model %s transiently unavailable (%s). Trying fallback candidate...", model, e)
                continue

        logger.info("All Gemini candidates busy; cleanly applying rule engine fallback.")
        return None

    def _validate_source_refs(self, refs: Any) -> List[str]:
        """Accepts only source IDs present in the verified source registry."""
        if not isinstance(refs, list):
            return []
        return [str(r).strip() for r in refs if str(r).strip() in SOURCE_REGISTRY]

    @staticmethod
    def _as_string_list(value: Any) -> List[str]:
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Safely parses JSON from Gemini response, stripping potential markdown blocks."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except Exception:
                    return None
            return None