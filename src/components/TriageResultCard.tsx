import React from "react";
import { TriageResult, PatientFormData } from "../types";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Send,
  Pill,
  Hospital,
  Sparkles,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface TriageResultCardProps {
  result: TriageResult;
  patientData: PatientFormData;
  logId?: string;
  loggedAt?: string;
  syncedToCloud: boolean;
}

export const TriageResultCard: React.FC<TriageResultCardProps> = ({
  result,
  patientData,
  logId,
  loggedAt,
  syncedToCloud,
}) => {
  const risk = result.risk_level.toUpperCase();

  const getBadgeStyle = () => {
    switch (risk) {
      case "CRITICAL":
        return {
          containerBg: "bg-rose-50 border-rose-300",
          badgeBg: "bg-rose-600 text-white shadow-rose-200",
          iconColor: "text-rose-600",
          title: "CRITICAL RISK",
          subtitle: "Suspected Weil's Disease / Severe Leptospirosis",
          alertBox: "bg-rose-100/80 border-rose-300 text-rose-950",
        };
      case "HIGH":
        return {
          containerBg: "bg-orange-50 border-orange-300",
          badgeBg: "bg-orange-600 text-white shadow-orange-200",
          iconColor: "text-orange-600",
          title: "HIGH RISK",
          subtitle: "Suspected Active Leptospirosis",
          alertBox: "bg-orange-100/80 border-orange-300 text-orange-950",
        };
      case "MODERATE":
        return {
          containerBg: "bg-amber-50 border-amber-300",
          badgeBg: "bg-amber-500 text-white shadow-amber-200",
          iconColor: "text-amber-600",
          title: "MODERATE RISK",
          subtitle: "Flood Exposure with Fever (48-Hour Watch)",
          alertBox: "bg-amber-100/80 border-amber-300 text-amber-950",
        };
      case "LOW":
      default:
        return {
          containerBg: "bg-emerald-50 border-emerald-300",
          badgeBg: "bg-emerald-600 text-white shadow-emerald-200",
          iconColor: "text-emerald-600",
          title: "LOW RISK",
          subtitle: "Unlikely Leptospirosis / Symptomatic Care",
          alertBox: "bg-emerald-100/80 border-emerald-300 text-emerald-950",
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <div
      id="triage-result-card"
      className={`rounded-xl border ${style.containerBg} p-5 sm:p-6 shadow-sm mb-6 transition-all animate-in fade-in-50 duration-300`}
    >
      {/* Risk Badge Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span
            id="badge-risk-level"
            className={`px-4 py-1.5 rounded-full font-black text-sm tracking-wider uppercase shadow-md flex items-center gap-1.5 ${style.badgeBg}`}
          >
            {risk === "CRITICAL" && <AlertOctagon className="w-4 h-4" />}
            {risk === "HIGH" && <AlertTriangle className="w-4 h-4" />}
            {risk === "MODERATE" && <Clock className="w-4 h-4" />}
            {risk === "LOW" && <ShieldCheck className="w-4 h-4" />}
            {style.title}
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {style.subtitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-white rounded-md border border-slate-200 text-slate-600">
          {result.is_ai_generated ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Gemini 2.0 Flash Co-Pilot</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>DOH 2026 Protocol Engine</span>
            </>
          )}
        </div>
      </div>

      {/* Recommendation Text */}
      <div className={`p-4 rounded-xl border ${style.alertBox} mb-4`}>
        <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-800 flex items-center gap-1.5">
          <Send className="w-4 h-4" />
          Mandatory Clinical Action
        </h4>
        <p className="text-sm sm:text-base font-semibold leading-relaxed">
          {result.recommendation}
        </p>
      </div>

      {/* Clinical Reasoning */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 mb-4">
        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Clinical Reasoning
        </h5>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          {result.reasoning}
        </p>
      </div>

      {/* Actionable Clinical Directives for Rural Nurses */}
      {(risk === "CRITICAL" || risk === "HIGH") && (
        <div className="bg-white rounded-lg p-3.5 border border-slate-200 mb-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5 text-blue-600" />
            DOH 2026 Antibiotic &amp; Hospital Referral Protocol
          </h5>
          <ul className="text-xs text-slate-700 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-700">• Doxycycline:</span>
              <span>
                Administer 100mg orally twice daily (BID) for 7 days. Take with
                plenty of water to avoid esophageal irritation. (Contraindicated
                in pregnant women).
              </span>
            </li>
            {risk === "CRITICAL" && (
              <li className="flex items-start gap-2 text-rose-700 font-semibold">
                <Hospital className="w-4 h-4 shrink-0 text-rose-600" />
                <span>
                  Immediate Fast Lane Transfer: Contact receiving DOH apex or
                  provincial hospital leptospirosis fast lane immediately. Ensure
                  IV hydration if systolic BP &lt;90.
                </span>
              </li>
            )}
            {risk === "HIGH" && (
              <li className="flex items-start gap-2 text-orange-800 font-medium">
                <Hospital className="w-4 h-4 shrink-0 text-orange-600" />
                <span>
                  Urgent Lab Orders: Request Serum Creatinine, CBC with platelet
                  count, and AST/ALT. Repeat assessment in 24 hours.
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Guidelines & Citations */}
      {result.citations && result.citations.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            Official DOH &amp; WHO Guidelines
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {result.citations.map((citation, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-1 bg-white rounded border border-slate-200 text-slate-700 font-medium"
              >
                📖 {citation}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Decision Logged Confirmation */}
      <div
        id="audit-logged-banner"
        className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-800"
      >
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Decision logged to audit trail
        </span>
        <span className="text-[11px] font-normal text-slate-500">
          {syncedToCloud
            ? `Synced to Cloud Firestore | ${loggedAt || "Just now"}`
            : `Saved to local offline cache | ${loggedAt || "Just now"}`}
        </span>
      </div>
    </div>
  );
};
