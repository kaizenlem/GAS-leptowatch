import React, { useState, useEffect } from "react";
import {
  X,
  FileCode,
  Download,
  Copy,
  Check,
  Server,
  Cloud,
  Layers,
} from "lucide-react";

interface DeliverablesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DELIVERABLES = [
  {
    name: "app.py",
    title: "1. Streamlit UI (app.py)",
    description: "Mobile-responsive single-screen triage form & results interface",
    language: "python",
  },
  {
    name: "triage.py",
    title: "2. Triage Logic (triage.py)",
    description: "DOH Philippines 2026 rule engine + Gemini guardrail integration",
    language: "python",
  },
  {
    name: "gemini_client.py",
    title: "3. Gemini API Wrapper (gemini_client.py)",
    description: "Gemini 2.0 Flash prompt structure, parsing & error handling",
    language: "python",
  },
  {
    name: "firestore_client.py",
    title: "4. Firestore Audit Logger (firestore_client.py)",
    description: "Cloud Firestore audit trail logger & protocol cache fallback",
    language: "python",
  },
  {
    name: "Dockerfile",
    title: "5. Cloud Run Container (Dockerfile)",
    description: "Production Python 3.11-slim container with healthcheck on 8080",
    language: "dockerfile",
  },
  {
    name: "requirements.txt",
    title: "6. Dependencies (requirements.txt)",
    description: "Streamlit, google-genai, firebase-admin, pydantic",
    language: "text",
  },
  {
    name: "README.md",
    title: "7. Documentation & Cloud Run Guide (README.md)",
    description: "Setup, gcloud commands, Meet the Builders story & architecture",
    language: "markdown",
  },
  {
    name: "firebase_config.py",
    title: "8. Firebase Config (firebase_config.py)",
    description: "Firebase Admin SDK initialization & credentials handler",
    language: "python",
  },
];

export const DeliverablesModal: React.FC<DeliverablesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<string>("app.py");
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/deliverables/${selectedFile}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load file");
        return res.text();
      })
      .then((text) => {
        setFileContent(text);
        setLoading(false);
      })
      .catch(() => {
        setFileContent("# File is available in project root repository.");
        setLoading(false);
      });
  }, [isOpen, selectedFile]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = selectedFile;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Google Cloud Run &amp; Python Deliverables
              </h3>
              <p className="text-xs text-slate-500">
                8 Production Code Files for Google Cloud &quot;Meet the
                Builders&quot;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* File Selector Sidebar */}
          <div className="w-full md:w-72 border-r border-slate-200 bg-slate-50/70 p-3 overflow-y-auto space-y-1.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
              Codebase Deliverables
            </span>
            {DELIVERABLES.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedFile(item.name)}
                className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 ${
                  selectedFile === item.name
                    ? "bg-blue-600 text-white font-semibold shadow-xs"
                    : "text-slate-700 hover:bg-slate-200/70 font-medium"
                }`}
              >
                <FileCode
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    selectedFile === item.name ? "text-white" : "text-blue-600"
                  }`}
                />
                <div>
                  <div className="leading-tight">{item.name}</div>
                  <div
                    className={`text-[10px] mt-0.5 line-clamp-1 ${
                      selectedFile === item.name
                        ? "text-blue-100"
                        : "text-slate-400"
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Code Viewer Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-900 text-slate-100 overflow-hidden">
            {/* Toolbar */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-blue-400">
                  {selectedFile}
                </span>
                <span className="text-slate-500 text-[11px]">
                  ({fileContent.split("\n").length} lines)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed selection:bg-blue-500/40">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  <span>Loading {selectedFile}...</span>
                </div>
              ) : (
                <pre className="whitespace-pre">{fileContent}</pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>All 8 deliverables ready for Google Cloud Run container build</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
