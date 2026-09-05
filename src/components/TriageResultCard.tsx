import React from "react";
import { TriageResult, PatientFormData } from "../types";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Send,
  Sparkles,
  Clock,
  ShieldCheck,
  HelpCircle,
  UserPlus,
} from "lucide-react";
import { SOURCE_REGISTRY } from "../sources";

interface TriageResultCardProps {
  result: TriageResult;
  patientData: PatientFormData;
  logId?: string;
  loggedAt?: string;
  syncedToCloud: boolean;
  onAssessNextPatient?: () => void;
}

export const TriageResultCard: React.FC<TriageResultCardProps> = ({
  result,
  patientData,
  logId,
  loggedAt,
  syncedToCloud,
  onAssessNextPatient,
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
      case "INSUFFICIENT_INFORMATION":
        return {
          containerBg: "bg-slate-50 border-slate-300",
          badgeBg: "bg-slate-600 text-white shadow-slate-200",
          iconColor: "text-slate-600",
          title: "INSUFFICIENT INFORMATION",
          subtitle: "Cannot Safely Classify - Consult Physician",
          alertBox: "bg-slate-100 border-slate-300 text-slate-950",
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
            {risk === "INSUFFICIENT_INFORMATION" && <HelpCircle className="w-4 h-4" />}
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
              <span>Deterministic Engine + Gemini Explanation</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Deterministic Rule Engine</span>
            </>
          )}
        </div>
      </div>

{/* Recommendation Text */}
      <div className={`p-4 rounded-xl border ${style.alertBox} mb-4`}>
        <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-800 flex items-center gap-1.5">
          <Send className="w-4 h-4" />
          Recommended Action (Referral Guidance)
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

      {/* Gemini Missing Information & Safety Flags (context layer only) */}
      {result.missing_information && result.missing_information.length > 0 && (
        <div className="bg-white rounded-lg p-3.5 border border-slate-200 mb-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Missing Information
          </h5>
          <ul className="text-xs text-slate-700 space-y-1.5">
            {result.missing_information.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">⚠</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.safety_flags && result.safety_flags.length > 0 && (
        <div className="bg-white rounded-lg p-3.5 border border-amber-200 mb-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">
            Safety Flags
          </h5>
          <ul className="text-xs text-slate-700 space-y-1.5">
            {result.safety_flags.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">🚩</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Guidelines & Citations */}
      {result.citations && result.citations.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            Verified Sources
          </h5>
          <div className="flex flex-col gap-1.5">
            {result.citations.map((citation, idx) => {
              const src = SOURCE_REGISTRY[citation];
              const label = src
                ? `${src.source_id} - ${src.organization}: ${src.title}`
                : citation;
              return (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 bg-white rounded border border-slate-200 text-slate-700 font-medium"
                >
                  📖 {label}
                </span>
              );
            })}
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

      {/* Assess Next Patient Action */}
      {onAssessNextPatient && (
        <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 p-3 rounded-lg">
          <span className="text-xs text-slate-600 font-medium text-center sm:text-left">
            Finished with this patient? Clear form to assess the next person in line.
          </span>
          <button
            type="button"
            id="btn-assess-next-patient"
            onClick={onAssessNextPatient}
            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Assess Next Patient (Clear Form)</span>
          </button>
        </div>
      )}
    </div>
  );
};
