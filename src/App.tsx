import React, { useState, useEffect } from "react";
import { PatientFormData, TriageResult, AuditLogEntry } from "./types";
import { TriageForm } from "./components/TriageForm";
import { TriageResultCard } from "./components/TriageResultCard";
import { AuditTrailModal } from "./components/AuditTrailModal";
import { NurseGuideModal } from "./components/NurseGuideModal";
import { DeliverablesModal } from "./components/DeliverablesModal";
import { evaluateClientDOHRules } from "./utils/triageEngine";
import {
  Hospital,
  AlertTriangle,
  FileSpreadsheet,
  Languages,
  Code2,
  Sparkles,
  Wifi,
  WifiOff,
  UserCheck,
  ShieldCheck,
  Info,
  Clock,
  HeartPulse,
} from "lucide-react";

export default function App() {
  const [nurseId, setNurseId] = useState<string>("RHU-Station-01");
  const [useAi, setUseAi] = useState<boolean>(true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isNetworkOffline, setIsNetworkOffline] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSubmission, setLastSubmission] = useState<{
    result: TriageResult;
    patientData: PatientFormData;
    logId: string;
    timestamp: string;
    synced: boolean;
  } | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isNurseGuideOpen, setIsNurseGuideOpen] = useState<boolean>(false);
  const [isDeliverablesOpen, setIsDeliverablesOpen] = useState<boolean>(false);

  // Monitor browser network connectivity
  useEffect(() => {
    const handleOnline = () => setIsNetworkOffline(false);
    const handleOffline = () => setIsNetworkOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial fetch of recent audit logs from backend if available
    fetch("/api/audit-logs")
      .then((res) => res.json())
      .then((data) => {
        if (data.logs && Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      })
      .catch(() => {
        // Use local storage buffer if server is unreachable
        const cached = localStorage.getItem("leptowatch_audit_cache");
        if (cached) {
          try {
            setAuditLogs(JSON.parse(cached));
          } catch (e) {
            console.error(e);
          }
        }
      });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isActuallyOffline = isNetworkOffline || isSimulatedOffline;

  const handleAssessRisk = async (formData: PatientFormData) => {
    setIsLoading(true);

    // If offline or simulated offline, perform deterministic client-side DOH triage immediately
    if (isActuallyOffline) {
      setTimeout(() => {
        const clientResult = evaluateClientDOHRules(formData);
        const logId = `local-log-${Date.now()}`;
        const timestamp = new Date().toISOString();

        const newLogEntry: AuditLogEntry = {
          id: logId,
          timestamp,
          patient_data: formData,
          result: clientResult,
          nurse_id: nurseId || "anonymous",
          synced_to_cloud: false,
        };

        const updated = [newLogEntry, ...auditLogs];
        setAuditLogs(updated);
        localStorage.setItem(
          "leptowatch_audit_cache",
          JSON.stringify(updated.slice(0, 50))
        );

        setLastSubmission({
          result: clientResult,
          patientData: formData,
          logId,
          timestamp,
          synced: false,
        });

        setIsLoading(false);

        // Smooth scroll to result
        setTimeout(() => {
          document
            .getElementById("triage-result-card")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }, 400);
      return;
    }

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_data: formData,
          nurse_id: nurseId,
          use_ai: useAi,
        }),
      });

      if (!response.ok) {
        throw new Error("Server triage failed");
      }

      const data = await response.json();
      const serverResult: TriageResult = data.result;

      const newLogEntry: AuditLogEntry = {
        id: data.log_id || `log-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        patient_data: formData,
        result: serverResult,
        nurse_id: nurseId,
        synced_to_cloud: true,
      };

      setAuditLogs((prev) => [newLogEntry, ...prev]);

      setLastSubmission({
        result: serverResult,
        patientData: formData,
        logId: newLogEntry.id,
        timestamp: newLogEntry.timestamp,
        synced: true,
      });

      setTimeout(() => {
        document
          .getElementById("triage-result-card")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      console.warn("Backend request failed, falling back to local DOH rule engine:", err);
      const fallbackResult = evaluateClientDOHRules(formData);
      const logId = `fallback-log-${Date.now()}`;
      const timestamp = new Date().toISOString();

      const newLogEntry: AuditLogEntry = {
        id: logId,
        timestamp,
        patient_data: formData,
        result: fallbackResult,
        nurse_id: nurseId || "anonymous",
        synced_to_cloud: false,
      };

      setAuditLogs((prev) => [newLogEntry, ...prev]);

      setLastSubmission({
        result: fallbackResult,
        patientData: formData,
        logId,
        timestamp,
        synced: false,
      });

      setTimeout(() => {
        document
          .getElementById("triage-result-card")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Emergency Epidemic Context Ribbon */}
      <header className="bg-slate-900 text-slate-100 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-slate-300">
              Philippine Leptospirosis Surveillance 2026:
            </span>
            <strong className="text-rose-400">6,253 Cases | 378 Deaths</strong>
            <span className="hidden sm:inline text-slate-400">
              (DOH Epidemiology Bureau)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDeliverablesOpen(true)}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-semibold"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Python / Cloud Run Files</span>
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => setIsNurseGuideOpen(true)}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors font-semibold"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>Tagalog Guide</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto px-4 py-6 sm:py-8 flex-1">
        {/* App Title Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl sm:text-4xl">🏥</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                LeptoWatch - Leptospirosis Triage
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  DOH 2026
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                AI-powered decision support for rural PH nurses
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Designed for rural health unit (RHU) nurses serving 5,000–10,000
            residents in flood-prone municipalities. Rapidly assesses early vague
            symptoms, prevents fatal Weil&apos;s disease, and enforces
            deterministic DOH fast lane protocols.
          </p>
        </div>

        {/* Status / Station Bar */}
        <div className="mb-6 p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Station:</span>
              <input
                type="text"
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                className="font-bold text-slate-900 bg-transparent border-b border-dotted border-slate-400 focus:outline-none w-28"
                placeholder="RHU-Station-01"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Gemini 2.0 Flash Co-Pilot
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Offline Simulation Toggle for low-end phone testing */}
            <button
              onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
              title="Simulate 3G disconnection or server outage"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                isActuallyOffline
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {isActuallyOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                  <span>Offline Mode</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Online (Connected)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAuditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-300" />
              <span>Audit Trail ({auditLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Offline Warning Banner */}
        {isActuallyOffline && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                ⚠️ Offline mode - using cached protocols
              </p>
              <p className="text-amber-800 mt-0.5">
                The app is operating in resilient standalone mode. All risk
                stratification is executed instantly using local DOH 2026 rules.
                Decisions are buffered locally and will sync once internet
                resumes.
              </p>
            </div>
          </div>
        )}

        {/* Main Triage Form */}
        <TriageForm
          onSubmit={handleAssessRisk}
          isLoading={isLoading}
          isOffline={isActuallyOffline}
        />

        {/* Result Card Output */}
        {lastSubmission && (
          <div className="mt-6">
            <TriageResultCard
              result={lastSubmission.result}
              patientData={lastSubmission.patientData}
              logId={lastSubmission.logId}
              loggedAt={new Date(lastSubmission.timestamp).toLocaleTimeString()}
              syncedToCloud={lastSubmission.synced}
            />
          </div>
        )}

        {/* Philippine Health Guidelines Protocol Footer Box */}
        <div className="mt-8 p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 shadow-xs">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Philippine DOH 2026 Triage Reference Summary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
              <strong className="text-rose-900 block mb-0.5">
                🔴 CRITICAL RISK
              </strong>
              <span>
                Flood exposure + fever + (jaundice OR oliguria). Suspected Weil&apos;s
                disease. Administer Doxycycline 100mg BID and transfer via DOH Fast
                Lane immediately.
              </span>
            </div>
            <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-100">
              <strong className="text-orange-900 block mb-0.5">
                🟠 HIGH RISK
              </strong>
              <span>
                Flood exposure + fever + severe calf/back pain. Administer Doxycycline
                100mg BID. Order CBC, Creatinine, LFTs. Monitor daily.
              </span>
            </div>
            <div className="p-2.5 bg-yellow-50 rounded-lg border border-yellow-100">
              <strong className="text-yellow-900 block mb-0.5">
                🟡 MODERATE RISK
              </strong>
              <span>
                Flood exposure + fever only. Monitor 48 hours. Consider post-exposure
                Doxycycline 200mg single-dose prophylaxis per guidelines.
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <strong className="text-emerald-900 block mb-0.5">
                🟢 LOW RISK
              </strong>
              <span>
                No flood exposure in last 2–4 weeks. Likely non-leptospirosis viral
                illness. Supportive home care (paracetamol, fluids).
              </span>
            </div>
          </div>
        </div>

        {/* Legal & Medical Compliance Disclaimer */}
        <div className="mt-8 text-center text-[11px] text-slate-400 border-t border-slate-200 pt-4 leading-relaxed">
          <p className="font-semibold text-slate-600 mb-1">
            Clinical Decision Support Disclaimer
          </p>
          <p>
            For clinical decision support only. Not a substitute for professional
            medical judgment. Formulated strictly according to Philippine
            Department of Health (DOH) leptospirosis management protocols and WHO
            Severe Leptospirosis Guidelines. No patient identifying information
            (name, address, telephone) is stored.
          </p>
        </div>
      </main>

      {/* Modals */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />

      <NurseGuideModal
        isOpen={isNurseGuideOpen}
        onClose={() => setIsNurseGuideOpen(false)}
      />

      <DeliverablesModal
        isOpen={isDeliverablesOpen}
        onClose={() => setIsDeliverablesOpen(false)}
      />
    </div>
  );
}
