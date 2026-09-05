import React, { useState } from "react";
import { AuditLogEntry } from "../types";
import {
  X,
  FileText,
  Download,
  Search,
  CheckCircle,
  Cloud,
  HardDrive,
  Shield,
} from "lucide-react";

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

function triCell(value: string | boolean | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return value.toUpperCase();
}

function triDisplay(value: string | boolean | null | undefined): string {
  if (value === null || value === undefined) return "Unknown";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === "yes" ? "Yes" : value === "no" ? "No" : "Unknown";
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filter !== "ALL" && log.result.risk_level !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const nurseMatch = log.nurse_id.toLowerCase().includes(q);
      const recMatch = log.result.recommendation.toLowerCase().includes(q);
      const comorbMatch = (log.patient_data.comorbidities || "")
        .toLowerCase()
        .includes(q);
      return nurseMatch || recMatch || comorbMatch;
    }
    return true;
  });

  const downloadCSV = () => {
    const headers = [
      "Timestamp",
      "Nurse ID",
      "Risk Level",
      "Age",
      "Flood Exposure",
      "Flood Days Ago",
      "Fever",
      "Myalgia",
      "Jaundice",
      "Oliguria",
      "Recommendation",
      "Synced To Cloud",
    ];
    const rows = logs.map((l) => [
      l.timestamp,
      `"${l.nurse_id}"`,
      l.result.risk_level,
      l.patient_data.age,
      triCell(l.patient_data.flood_exposure),
      l.patient_data.flood_days_ago,
      triCell(l.patient_data.fever),
      triCell(l.patient_data.myalgia),
      triCell(l.patient_data.jaundice),
      triCell(l.patient_data.oliguria),
      `"${l.result.recommendation.replace(/"/g, '""')}"`,
      l.synced_to_cloud ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `leptowatch_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "HIGH":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "MODERATE":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "INSUFFICIENT_INFORMATION":
        return "bg-slate-200 text-slate-800 border-slate-300";
      case "LOW":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Firestore Triage Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Epidemiological record collection:{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">
                  triage_logs
                </code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search nurse ID, symptoms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MODERATE">Moderate Only</option>
              <option value="LOW">Low Only</option>
              <option value="INSUFFICIENT_INFORMATION">Insufficient Info Only</option>
            </select>

            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No audit records found.</p>
              <p className="text-xs">
                Assess a patient in the main form to generate an immutable audit
                log.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] border ${getRiskColor(
                        log.result.risk_level
                      )}`}
                    >
                      {log.result.risk_level}
                    </span>
                    <span className="font-semibold text-slate-700">
                      Nurse: {log.nurse_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    {log.synced_to_cloud ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <Cloud className="w-3 h-3" /> Firestore
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <HardDrive className="w-3 h-3" /> Local Buffer
                      </span>
                    )}
                    <span>•</span>
                    <span>
                      {new Date(log.timestamp).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-slate-800 font-medium mb-2 leading-relaxed">
                  {log.result.recommendation}
                </p>

                <div className="bg-slate-50 p-2 rounded text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    <strong>Age:</strong> {log.patient_data.age}y
                  </span>
                  <span>
                    <strong>Flood Exposure:</strong>{" "}
                    {triDisplay(log.patient_data.flood_exposure)}
                    {triDisplay(log.patient_data.flood_exposure) === "Yes"
                      ? ` (${log.patient_data.flood_days_ago}d ago)`
                      : ""}
                  </span>
                  <span>
                    <strong>Fever:</strong>{" "}
                    {triDisplay(log.patient_data.fever)}
                  </span>
                  <span>
                    <strong>Calf Myalgia:</strong>{" "}
                    {triDisplay(log.patient_data.myalgia)}
                  </span>
                  <span>
                    <strong>Jaundice:</strong>{" "}
                    {triDisplay(log.patient_data.jaundice)}
                  </span>
                  <span>
                    <strong>Oliguria:</strong>{" "}
                    {triDisplay(log.patient_data.oliguria)}
                  </span>
                  {log.patient_data.comorbidities && (
                    <span>
                      <strong>Comorbidities:</strong>{" "}
                      {log.patient_data.comorbidities}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Zero-PII Audit Trail: compliant with Philippine Data Privacy Act &amp;
          DOH epidemiological surveillance guidance. Records carry ruleset version
          and model pedigree.
        </div>
      </div>
    </div>
  );
};
