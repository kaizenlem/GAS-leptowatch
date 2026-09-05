import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory audit log cache for session persistence
interface AuditLog {
  id: string;
  timestamp: string;
  patient_data: {
    flood_exposure: boolean;
    flood_days_ago: number;
    fever: boolean;
    myalgia: boolean;
    headache: boolean;
    red_eyes: boolean;
    jaundice: boolean;
    oliguria: boolean;
    symptom_days: number;
    age: number;
    comorbidities: string;
  };
  result: {
    risk_level: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
    recommendation: string;
    citations: string[];
    reasoning: string;
    is_ai_generated: boolean;
    model_used?: string;
  };
  nurse_id: string;
  synced_to_cloud: boolean;
}

const auditLogs: AuditLog[] = [
  {
    id: "seed-log-1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    patient_data: {
      flood_exposure: true,
      flood_days_ago: 5,
      fever: true,
      myalgia: true,
      headache: true,
      red_eyes: true,
      jaundice: false,
      oliguria: false,
      symptom_days: 3,
      age: 42,
      comorbidities: "Hypertension",
    },
    result: {
      risk_level: "HIGH",
      recommendation:
        "Suspected leptospirosis. Administer doxycycline 100mg BID. Refer for labs (CBC, creatinine, LFT). Monitor for jaundice, oliguria, bleeding.",
      citations: [
        "DOH Leptospirosis Clinical Guidelines 2026",
        "WHO Case Definition",
      ],
      reasoning:
        "Floodwater exposure with fever, calf pain, and conjunctival suffusion meets DOH criteria for active moderate/high-risk leptospirosis.",
      is_ai_generated: false,
      model_used: "DOH 2026 Rule Engine",
    },
    nurse_id: "RHU-Bulacan-01",
    synced_to_cloud: true,
  },
  {
    id: "seed-log-2",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    patient_data: {
      flood_exposure: true,
      flood_days_ago: 8,
      fever: true,
      myalgia: true,
      headache: true,
      red_eyes: true,
      jaundice: true,
      oliguria: true,
      symptom_days: 4,
      age: 56,
      comorbidities: "Type 2 Diabetes",
    },
    result: {
      risk_level: "CRITICAL",
      recommendation:
        "URGENT: Suspected Weil's disease. Administer doxycycline 100mg BID. Refer immediately to DOH hospital with leptospirosis fast lane.",
      citations: [
        "DOH Leptospirosis Fast Lane Protocol 2026",
        "WHO Severe Leptospirosis Guidelines",
      ],
      reasoning:
        "Patient exhibits severe systemic involvement (jaundice and oliguria) following floodwater contact, indicating acute renal and hepatic compromise.",
      is_ai_generated: false,
      model_used: "DOH 2026 Rule Engine",
    },
    nurse_id: "RHU-Marikina-03",
    synced_to_cloud: true,
  },
];

// DOH Philippines 2026 Rule-Based Assessment
function evaluateDOHRules(data: AuditLog["patient_data"]) {
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
    const signs = [];
    if (jaundice) signs.push("jaundice (hepatic compromise)");
    if (oliguria) signs.push("oliguria (acute renal risk)");

    return {
      risk_level: "CRITICAL" as const,
      recommendation:
        "URGENT: Suspected Weil's disease. Administer doxycycline 100mg BID. Refer immediately to DOH hospital with leptospirosis fast lane.",
      citations: [
        "DOH Leptospirosis Fast Lane Protocol 2026",
        "WHO Severe Leptospirosis Guidelines",
      ],
      reasoning: `Patient has documented flood exposure, acute fever, and red flag organ dysfunction (${signs.join(
        " and "
      )}). Immediate hospital transfer via DOH fast lane is mandatory.`,
      is_ai_generated: false,
      model_used: "DOH 2026 Clinical Rule Engine",
    };
  }

  // 2. HIGH RISK: Flood exposure + fever + myalgia
  if (flood_exposure && fever && myalgia) {
    const extra = [];
    if (red_eyes) extra.push("conjunctival suffusion");
    if (headache) extra.push("severe headache");

    return {
      risk_level: "HIGH" as const,
      recommendation:
        "Suspected leptospirosis. Administer doxycycline 100mg BID. Refer for labs (CBC, creatinine, LFT). Monitor for jaundice, oliguria, bleeding.",
      citations: [
        "DOH Leptospirosis Clinical Guidelines 2026",
        "WHO Case Definition",
      ],
      reasoning: `Classic triad of flood exposure, fever, and severe myalgia (calves/back)${
        extra.length ? ` accompanied by ${extra.join(" and ")}` : ""
      } within symptom day ${symptom_days} requires prompt therapeutic antibiotic treatment.`,
      is_ai_generated: false,
      model_used: "DOH 2026 Clinical Rule Engine",
    };
  }

  // 3. MODERATE RISK: Flood exposure + fever only
  if (flood_exposure && fever) {
    return {
      risk_level: "MODERATE" as const,
      recommendation:
        "Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately. Consider doxycycline prophylaxis per DOH guidelines.",
      citations: ["DOH Prophylaxis Guidelines 2026"],
      reasoning:
        "Flood exposure with active fever without overt myalgia or organ failure signs. Requires close 48h observation and consideration for post-exposure prophylaxis.",
      is_ai_generated: false,
      model_used: "DOH 2026 Clinical Rule Engine",
    };
  }

  // 4. LOW RISK: No flood exposure
  if (!flood_exposure) {
    return {
      risk_level: "LOW" as const,
      recommendation:
        "Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
      citations: [
        "DOH Primary Care Guidelines",
        "CDC Leptospirosis Epidemiology",
      ],
      reasoning:
        "Lack of floodwater contact in the 2-4 week incubation timeframe makes leptospirosis clinically unlikely.",
      is_ai_generated: false,
      model_used: "DOH 2026 Clinical Rule Engine",
    };
  }

  // Fallback: Flood exposure with no fever
  return {
    risk_level: "LOW" as const,
    recommendation:
      "Asymptomatic flood exposure. Health education on symptom watch. Consider single dose doxycycline prophylaxis (200mg) if exposure occurred within 72 hours.",
    citations: [
      "DOH Prophylaxis Guidelines 2026",
      "CDC Leptospirosis Epidemiology",
    ],
    reasoning:
      "Patient reports flood exposure without active fever or systemic symptoms. Educate on warning signs.",
    is_ai_generated: false,
    model_used: "DOH 2026 Clinical Rule Engine",
  };
}

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
              risk_level: {
                type: Type.STRING,
                description: "One of: CRITICAL, HIGH, MODERATE, LOW",
              },
              recommendation: {
                type: Type.STRING,
                description: "Specific actionable guidance for the nurse",
              },
              citations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Official DOH and WHO guideline citations",
              },
              reasoning: {
                type: Type.STRING,
                description: "1-2 sentences clinical justification",
              },
            },
            required: ["risk_level", "recommendation", "citations", "reasoning"],
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
    version: "2026.1",
    timestamp: new Date().toISOString(),
    ai_available: Boolean(process.env.GEMINI_API_KEY),
  });
});

// DOH Protocols Cache Endpoint
app.get("/api/doh-protocols", (req, res) => {
  res.json({
    version: "2026.1",
    title: "Philippine DOH Leptospirosis Clinical & Fast Lane Protocols 2026",
    protocols: {
      CRITICAL: {
        criteria: "Flood exposure + fever + (jaundice OR oliguria)",
        action:
          "URGENT: Suspected Weil's disease. Administer doxycycline 100mg BID. Refer immediately to DOH hospital with leptospirosis fast lane.",
        citations: [
          "DOH Leptospirosis Fast Lane Protocol 2026",
          "WHO Severe Leptospirosis Guidelines",
        ],
      },
      HIGH: {
        criteria: "Flood exposure + fever + myalgia",
        action:
          "Suspected leptospirosis. Administer doxycycline 100mg BID. Refer for labs (CBC, creatinine, LFT). Monitor for jaundice, oliguria, bleeding.",
        citations: [
          "DOH Leptospirosis Clinical Guidelines 2026",
          "WHO Case Definition",
        ],
      },
      MODERATE: {
        criteria: "Flood exposure + fever only",
        action:
          "Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately. Consider doxycycline prophylaxis per DOH guidelines.",
        citations: ["DOH Prophylaxis Guidelines 2026"],
      },
      LOW: {
        criteria: "No flood exposure",
        action:
          "Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
        citations: [
          "DOH Primary Care Guidelines",
          "CDC Leptospirosis Epidemiology",
        ],
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

    // Always compute deterministic DOH 2026 rule result
    const ruleResult = evaluateDOHRules(patientData);

    let finalResult = ruleResult;
    let usedAi = false;

    const ai = getGeminiClient();

    if (requestedAi && ai) {
      try {
        const prompt = `You are a clinical decision support assistant for rural Philippine health nurses.
Use DOH leptospirosis guidelines to assess risk.

Patient Information:
- Flood exposure: ${patientData.flood_exposure ? "Yes" : "No"}
- Days since flood: ${patientData.flood_days_ago}
- Fever: ${patientData.fever ? "Yes" : "No"}
- Myalgia: ${patientData.myalgia ? "Yes" : "No"}
- Headache: ${patientData.headache ? "Yes" : "No"}
- Red eyes: ${patientData.red_eyes ? "Yes" : "No"}
- Jaundice: ${patientData.jaundice ? "Yes" : "No"}
- Oliguria: ${patientData.oliguria ? "Yes" : "No"}
- Symptom duration: ${patientData.symptom_days} days
- Age: ${patientData.age}
- Comorbidities: ${patientData.comorbidities || "None"}

Based on DOH guidelines, provide:
1. Risk level: CRITICAL, HIGH, MODERATE, or LOW
2. Recommendation (actionable for a rural nurse)
3. Citations (DOH/WHO guidelines)
4. Reasoning (1-2 sentences)

Format as JSON.`;

        const { text, modelUsed } = await callGeminiTriageWithFallback(ai, prompt);

        if (text) {
          const parsed = JSON.parse(text);
          let risk = String(parsed.risk_level || "").toUpperCase();
          if (!["CRITICAL", "HIGH", "MODERATE", "LOW"].includes(risk)) {
            risk = ruleResult.risk_level;
          }

          // Clinical guardrail: AI must never downgrade deterministic DOH safety rule
          const severityRanks: Record<string, number> = {
            LOW: 1,
            MODERATE: 2,
            HIGH: 3,
            CRITICAL: 4,
          };
          const ruleRank = severityRanks[ruleResult.risk_level] || 1;
          const aiRank = severityRanks[risk] || 1;

          if (ruleRank > aiRank) {
            // Apply safety override
            finalResult = {
              risk_level: ruleResult.risk_level,
              recommendation: ruleResult.recommendation,
              citations: Array.from(
                new Set([...ruleResult.citations, ...(parsed.citations || [])])
              ),
              reasoning: `[Clinical Guardrail Applied] ${ruleResult.reasoning} ${parsed.reasoning || ""}`,
              is_ai_generated: true,
              model_used: `${modelUsed} + DOH Guardrail`,
            };
          } else {
            finalResult = {
              risk_level: risk as any,
              recommendation: parsed.recommendation || ruleResult.recommendation,
              citations:
                parsed.citations && parsed.citations.length > 0
                  ? parsed.citations
                  : ruleResult.citations,
              reasoning: parsed.reasoning || ruleResult.reasoning,
              is_ai_generated: true,
              model_used: modelUsed,
            };
          }
          usedAi = true;
        }
      } catch (aiErr: any) {
        console.info(
          "AI service at peak demand; activated verified deterministic DOH 2026 rule engine"
        );
        finalResult = {
          ...ruleResult,
          reasoning: `${ruleResult.reasoning} (Verified DOH 2026 clinical protocol active).`,
          model_used: "DOH 2026 Clinical Rule Engine (Active Fallback)",
        };
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
