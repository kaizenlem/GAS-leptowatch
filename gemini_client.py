"""
Gemini 2.0 Flash Client for LeptoWatch.
Provides AI-powered clinical decision support based on DOH Philippines 2026 guidelines.
Includes robust JSON parsing, prompt formatting, and graceful error handling.
"""

import os
import json
import logging
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any

logger = logging.getLogger("leptowatch.gemini")

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
    risk_level: str  # CRITICAL, HIGH, MODERATE, LOW
    recommendation: str
    citations: List[str]
    reasoning: str
    is_ai_generated: bool = True
    model_used: str = "gemini-2.0-flash"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


TRIAGE_PROMPT_TEMPLATE = """You are a clinical decision support assistant for rural Philippine health nurses.
Use DOH leptospirosis guidelines to assess risk.

Patient Information:
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

Based on DOH guidelines, provide:
1. Risk level: CRITICAL, HIGH, MODERATE, or LOW
2. Recommendation (actionable for a rural nurse)
3. Citations (DOH/WHO guidelines)
4. Reasoning (1-2 sentences)

Format as JSON with exact keys:
{{
  "risk_level": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
  "recommendation": "string",
  "citations": ["citation 1", "citation 2"],
  "reasoning": "string"
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

    def assess_risk(self, patient_info: Dict[str, Any]) -> Optional[TriageResult]:
        """
        Sends patient symptoms to Gemini 2.0 Flash and returns structured TriageResult.
        Returns None if Gemini is unavailable or errors out, allowing instant fallback to rule-based logic.
        """
        if not self.client:
            logger.info("Gemini client not initialized or missing API key.")
            return None

        prompt = TRIAGE_PROMPT_TEMPLATE.format(
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
            comorbidities=patient_info.get("comorbidities", "None") or "None"
        )

        models_to_try = [self.model_name, "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"]
        # Deduplicate while preserving order
        unique_models = list(dict.fromkeys([m for m in models_to_try if m]))

        for model in unique_models:
            try:
                # Use generate_content with JSON response config if available
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

                risk_level = str(parsed.get("risk_level", "")).upper()
                if risk_level not in ["CRITICAL", "HIGH", "MODERATE", "LOW"]:
                    risk_level = "MODERATE"

                citations = parsed.get("citations", [])
                if isinstance(citations, str):
                    citations = [citations]

                return TriageResult(
                    risk_level=risk_level,
                    recommendation=parsed.get("recommendation", ""),
                    citations=citations,
                    reasoning=parsed.get("reasoning", ""),
                    is_ai_generated=True,
                    model_used=model
                )
            except Exception as e:
                logger.info("Model %s transiently unavailable (%s). Trying fallback candidate...", model, e)
                continue

        logger.info("All Gemini candidates busy; cleanly applying DOH 2026 rule engine fallback.")
        return None

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
            # Attempt to find json slice
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except Exception:
                    return None
            return None
