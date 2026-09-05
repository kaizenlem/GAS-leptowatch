import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  RULESET_VERSION,
  DOH_FAST_LANE,
  WHO_GUIDANCE,
  CDC_OVERVIEW,
  VERIFIED_SOURCES,
  SOURCE_REGISTRY,
} from "./src/sources";
import type { TriageResult, TriageFactor } from "./src/types";
import { evaluateClientDOHRules as evaluateDOHRules } from "./src/utils/triageEngine";

function triLabel(value: TriageFactor | boolean | null | undefined): string {
  if (value === null || value === undefined) return "Unknown";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const v = value.toLowerCase();
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  return "Unknown";
}

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory audit log cache for session persistence
interface AuditLog {
  id: string;
  timestamp: string;
  patient_data: {
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
  };
  result: {
    risk_level: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_INFORMATION";
    recommendation: string;
    citations: string[];
    reasoning: string;
    is_ai_generated: boolean;
    model_used?: string;
    missing_information?: string[];
    safety_flags?: string[];
    ai_commentary?: string;
  };
  nurse_id: string;
  synced_to_cloud: boolean;
  ruleset_version?: string;
}

const auditLogs: AuditLog[] = [
  {
    id: "seed-log-1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    patient_data: {
      flood_exposure: "yes",
      flood_days_ago: 5,
      fever: "yes",
      myalgia: "yes",
      headache: "yes",
      red_eyes: "yes",
      jaundice: "no",
      oliguria: "no",
      symptom_days: 3,
      age: 42,
      comorbidities: "Hypertension",
    },
    result: {
      risk_level: "HIGH",
      recommendation:
        "Suspected leptospirosis. Refer for physician evaluation and laboratory testing (CBC, creatinine, liver function). Monitor for jaundice, oliguria, and bleeding; follow DOH fast lane referral process.",
      citations: [DOH_FAST_LANE, WHO_GUIDANCE],
      reasoning:
        "Floodwater exposure with fever, calf pain, and conjunctival suffusion meets criteria for suspected active leptospirosis.",
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    },
    nurse_id: "RHU-Bulacan-01",
    synced_to_cloud: true,
    ruleset_version: RULESET_VERSION,
  },
  {
    id: "seed-log-2",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    patient_data: {
      flood_exposure: "yes",
      flood_days_ago: 8,
      fever: "yes",
      myalgia: "yes",
      headache: "yes",
      red_eyes: "yes",
      jaundice: "yes",
      oliguria: "yes",
      symptom_days: 4,
      age: 56,
      comorbidities: "Type 2 Diabetes",
    },
    result: {
      risk_level: "CRITICAL",
      recommendation:
        "URGENT: Suspected severe leptospirosis (Weil's disease). Refer immediately for physician / DOH hospital clinical management via the leptospirosis fast lane. Do not delay transfer.",
      citations: [DOH_FAST_LANE, WHO_GUIDANCE],
      reasoning:
        "Patient exhibits severe systemic involvement (jaundice and oliguria) following floodwater contact, indicating acute renal and hepatic compromise.",
      is_ai_generated: false,
      model_used: `Deterministic Rule Engine v${RULESET_VERSION}`,
    },
    nurse_id: "RHU-Marikina-03",
    synced_to_cloud: true,
    ruleset_version: RULESET_VERSION,
  },
];

// Helper to call Gemini with multi-model fallback and graceful handling of 503/429 high demand spikes
interface GeminiTriageResponse {
  text: string;
  modelUsed: string;
}

async function callGeminiTriageWithFallback(
  ai: GoogleGenAI,
  prompt: string
): Promise<GeminiTriageResponse> {
  // Ordered list of candidate models: prioritize fast 2.5-flash, flash-latest, 3.1-flash-lite, and 3.8-flash
  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reasoning: {
                type: Type.STRING,
                description: "Explain the supplied deterministic risk level in 1-3 sentences",
              },
              missing_information: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Important missing clinical information that would improve the assessment",
              },
              safety_flags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Safety concerns or contradictions in the inputs",
              },
              protocol_references: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "source_ids from the verified sources list ONLY",
              },
            },
            required: ["reasoning", "missing_information", "safety_flags", "protocol_references"],
          },
        },
      });

      if (response && response.text) {
        return {
          text: response.text.trim(),
          modelUsed: model,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.info(
        `Gemini model ${model} experienced high demand or temporary latency. Trying alternative model...`
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw lastError || new Error("All Gemini model endpoints currently unavailable");
}

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// --- API Routes ---

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "LeptoWatch Triage Co-Pilot",
    ruleset_version: RULESET_VERSION,
    timestamp: new Date().toISOString(),
    ai_available: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Verified Protocols Cache Endpoint
app.get("/api/doh-protocols", (req, res) => {
  res.json({
    ruleset_version: RULESET_VERSION,
    title: "LeptoWatch risk stratification reference (derived from verified Philippine DOH and WHO leptospirosis guidance)",
    sources: VERIFIED_SOURCES.sources,
    protocols: {
      CRITICAL: {
        criteria: "Flood exposure + fever + (jaundice OR oliguria)",
        action: "URGENT: Suspected severe leptospirosis (Weil's disease). Refer immediately for physician / DOH hospital clinical management via the leptospirosis fast lane. Do not delay transfer.",
        citations: [
          DOH_FAST_LANE,
          WHO_GUIDANCE,
        ],
      },
      HIGH: {
        criteria: "Flood exposure + fever + myalgia",
        action: "Suspected leptospirosis. Refer for physician evaluation and laboratory testing (CBC, creatinine, liver function). Monitor for jaundice, oliguria, and bleeding; follow DOH fast lane referral process.",
        citations: [
          DOH_FAST_LANE,
          WHO_GUIDANCE,
        ],
      },
      MODERATE: {
        criteria: "Flood exposure + fever only",
        action: "Flood exposure with fever. Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately for physician evaluation, including prophylaxis considerations per DOH guidance.",
        citations: [DOH_FAST_LANE, WHO_GUIDANCE],
      },
      LOW: {
        criteria: "No flood exposure",
        action: "Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
        citations: [
          WHO_GUIDANCE,
          CDC_OVERVIEW,
        ],
      },
      INSUFFICIENT_INFORMATION: {
        criteria: "Flood exposure or fever status not recorded",
        action: "Insufficient information to safely classify this patient. Confirm flood exposure history and fever status before triage; consult with the physician on duty.",
        citations: [WHO_GUIDANCE],
      },
    },
  });
});

// Triage Assessment Endpoint (Gemini 2.0 Flash + DOH Rule Guardrail)
app.post("/api/triage", async (req, res) => {
  try {
    const patientData = req.body.patient_data;
    const nurseId = req.body.nurse_id || "anonymous";
    const requestedAi = req.body.use_ai !== false;

    if (!patientData) {
      return res.status(400).json({ error: "Missing patient_data object" });
    }

    // Always compute deterministic rule result (authoritative)
    const ruleResult = evaluateDOHRules(patientData);

    let finalResult: TriageResult = ruleResult;
    let usedAi = false;

    const ai = getGeminiClient();

    if (requestedAi && ai) {
      try {
        const sourcesJson = JSON.stringify(VERIFIED_SOURCES.sources, null, 2);
        const prompt = `You are the explanation and clinical-context layer of LeptoWatch, a triage co-pilot for Philippine rural health unit (RHU) nurses.

IMPORTANT:
The deterministic clinical rules engine is authoritative for risk classification and escalation. You must NOT change the risk level, downgrade an escalation, invent a diagnosis, prescribe medication or dosage, or invent clinical guidelines or citations.

Your role is to:
1. Explain the deterministic result in concise, plain language for a rural nurse.
2. Identify relevant symptoms and risk factors present in the inputs.
3. Identify important missing information.
4. Flag safety concerns.
5. Reference ONLY the verified protocol sources below, by their source_id.

PATIENT INPUT:
- Flood exposure: ${triLabel(patientData.flood_exposure)}
- Days since flood: ${patientData.flood_days_ago}
- Fever: ${triLabel(patientData.fever)}
- Myalgia: ${triLabel(patientData.myalgia)}
- Headache: ${triLabel(patientData.headache)}
- Red eyes: ${triLabel(patientData.red_eyes)}
- Jaundice: ${triLabel(patientData.jaundice)}
- Oliguria: ${triLabel(patientData.oliguria)}
- Symptom duration: ${patientData.symptom_days} days
- Age: ${patientData.age}
- Comorbidities: ${patientData.comorbidities || "None"}

DETERMINISTIC RESULT (authoritative):
- Risk level: ${ruleResult.risk_level}
- Recommendation: ${ruleResult.recommendation}

VERIFIED SOURCES (ONLY these may be referenced, by source_id):
${sourcesJson}

Return ONLY JSON with exact keys: reasoning, missing_information, safety_flags, protocol_references.`;

        const { text, modelUsed } = await callGeminiTriageWithFallback(ai, prompt);

        if (text) {
          const parsed = JSON.parse(text);
          const validatedRefs = (Array.isArray(parsed.protocol_references) ? parsed.protocol_references : [])
            .filter((r: string) => r && Object.prototype.hasOwnProperty.call(SOURCE_REGISTRY, r));

          finalResult = {
            ...ruleResult,
            reasoning: `${parsed.reasoning || ruleResult.reasoning} ${ruleResult.reasoning}`.trim(),
            missing_information: Array.isArray(parsed.missing_information)
              ? parsed.missing_information.map(String)
              : [],
            safety_flags: Array.isArray(parsed.safety_flags)
              ? parsed.safety_flags.map(String)
              : [],
            ai_commentary: String(parsed.reasoning || ""),
            is_ai_generated: true,
            model_used: `${ruleResult.model_used} + ${modelUsed}`,
          };
          if (validatedRefs.length > 0) {
            finalResult.citations = Array.from(
              new Set([...ruleResult.citations, ...validatedRefs])
            );
          }
          usedAi = true;
        }
      } catch (aiErr: any) {
        console.info(
          "AI layer at peak demand; showing deterministic rule engine result"
        );
      }
    }

    // Create Audit Log
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      patient_data: patientData,
      result: finalResult,
      nurse_id: nurseId,
      synced_to_cloud: true,
      ruleset_version: RULESET_VERSION,
    };

    auditLogs.unshift(newLog);
    if (auditLogs.length > 100) auditLogs.pop();

    return res.json({
      result: finalResult,
      used_ai: usedAi,
      log_id: newLog.id,
      timestamp: newLog.timestamp,
    });
  } catch (err: any) {
    console.error("Triage endpoint error:", err);
    res.status(500).json({ error: err.message || "Triage failed" });
  }
});

// Audit Logs Retrieval
app.get("/api/audit-logs", (req, res) => {
  res.json({ logs: auditLogs.slice(0, 50) });
});

// Log an assessment from client (e.g. offline sync)
app.post("/api/audit-logs", (req, res) => {
  const { patient_data, result, nurse_id } = req.body;
  const newLog: AuditLog = {
    id: `client-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    patient_data,
    result,
    nurse_id: nurse_id || "anonymous",
    synced_to_cloud: true,
  };
  auditLogs.unshift(newLog);
  res.json({ status: "success", log: newLog });
});

// Deliverables File Inspector endpoint (allows UI to serve the exact Python deliverables)
app.get("/api/deliverables/:filename", (req, res) => {
  const allowed = [
    "app.py",
    "triage.py",
    "gemini_client.py",
    "firestore_client.py",
    "Dockerfile",
    "requirements.txt",
    "README.md",
    "firebase_config.py",
  ];
  const filename = req.params.filename;
  if (!allowed.includes(filename)) {
    return res.status(404).send("File not found");
  }

  const filePath = path.join(process.cwd(), filename);
  res.sendFile(filePath);
});

// Vite middleware or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LeptoWatch server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
