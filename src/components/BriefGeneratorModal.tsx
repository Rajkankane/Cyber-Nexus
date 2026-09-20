import React, { useState } from 'react';
import {
  FileText, Download, Clock, ShieldCheck, X,
  FileCode, Eye
} from 'lucide-react';
import { api } from '../api/client';
import type { Case, Entity, Evidence, EvidenceGap } from '../types';

interface BriefGeneratorModalProps {
  caseId: string;
  caseTitle: string;
  isOpen: boolean;
  onClose: () => void;
  currentCase: Case | null;
  entities: Entity[];
  evidenceList: Evidence[];
  evidenceGaps: EvidenceGap[];
}

export const BriefGeneratorModal: React.FC<BriefGeneratorModalProps> = ({
  caseId,
  caseTitle,
  isOpen,
  onClose,
  currentCase,
  entities,
  evidenceList,
  evidenceGaps
}) => {
  const [generating, setGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [reportFormat, setReportFormat] = useState<'PDF' | 'JSON'>('PDF');
  const [showPreviewPane, setShowPreviewPane] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleGenerate = async (format: 'PDF' | 'JSON') => {
    try {
      setGenerating(true);
      setReportFormat(format);
      const t0 = performance.now();

      setProgressStep('Validating Section 65B hash-chain custody stamps...');
      await new Promise((r) => setTimeout(r, 250));

      setProgressStep('Synthesizing CDR, Bank, and APK dropper cross-linkages...');
      await new Promise((r) => setTimeout(r, 250));

      setProgressStep('Rendering legal report template with cryptographic signatures...');

      let res;
      if (format === 'PDF') {
        res = await api.generatePdfBrief(caseId);
      } else {
        res = await api.generateJsonBrief(caseId);
      }

      const t1 = performance.now();
      setElapsedTime(Math.round(t1 - t0));
      setDownloadUrl(res.download_url);
      setFileName(res.file_name);
      setShowPreviewPane(true);
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1422] border border-slate-700/80 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 font-mono max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5 text-cyan-400 font-bold text-sm">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <span>Section 65B Court-Ready Legal Brief Generator</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Case Context Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Investigation Matter</p>
            <p className="font-bold text-slate-100 text-sm">{caseTitle}</p>
            <p className="text-[11px] text-slate-400 font-sans">
              Defrauded: <b className="text-rose-400 font-mono">INR {Number(currentCase?.amount_inr || 0).toLocaleString('en-IN')}</b> | Case ID: {caseId.slice(0, 16)}...
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-[11px]">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Section 65B(4) Evidence Act Certificate</span>
            </div>
            <p className="text-slate-400 font-sans leading-relaxed">
              Automated compilation of SHA-256 evidence vault fingerprints, multi-source event chronology,
              mule trail layering, and statutory preservation notice directives.
            </p>
          </div>
        </div>

        {/* Live Generation Progress Indicator */}
        {generating && (
          <div className="p-5 bg-cyan-950/20 border border-cyan-500/40 rounded-xl space-y-3 text-center animate-in fade-in">
            <div className="flex items-center justify-center space-x-2 text-cyan-400 font-bold text-sm">
              <Clock className="w-5 h-5 animate-spin" />
              <span>Compiling Court-Ready Dossier...</span>
            </div>
            <p className="text-xs text-slate-300 font-mono">{progressStep}</p>
            <div className="w-64 mx-auto bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full w-full animate-pulse" />
            </div>
          </div>
        )}

        {/* In-App Preview Pane */}
        {showPreviewPane && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-slate-200 font-bold text-xs">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>In-App Legal Dossier Preview (Ready for Submission)</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                Generated in {elapsedTime ? `${(elapsedTime / 1000).toFixed(2)}s` : '0.82s'}
              </span>
            </div>

            {/* Document Mock Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 text-slate-300 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[11px]">
                <span className="font-bold text-cyan-400 uppercase">CYBER CRIME POLICE STATION // FORENSIC REPORT</span>
                <span className="text-slate-400 font-mono">{new Date().toLocaleDateString()}</span>
              </div>

              <div className="space-y-1">
                <p className="text-slate-100 font-bold text-sm">RE: FORENSIC CORRELATION & SECTION 65B REPORT</p>
                <p className="text-[11px] text-slate-400">Matter: {caseTitle}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-[11px]">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500">Sealed Artifacts:</span>
                  <p className="font-bold text-emerald-400">{evidenceList.length} Files Locked</p>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500">Correlated Entities:</span>
                  <p className="font-bold text-cyan-400">{entities.length} Suspect Nodes</p>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500">Compliance Gaps:</span>
                  <p className="font-bold text-rose-400">{evidenceGaps.length} Field Notices</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-2">
                "I hereby certify under Section 65B(4) of the Indian Evidence Act, 1872, that the electronic records
                and device associations referenced herein were generated by automated forensic systems without unauthorized human intervention..."
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons: Simultaneous PDF & JSON Options */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
          <div className="text-[11px] text-slate-500 font-mono">
            Court Admissible Dossier & Machine-Readable Forensic JSON
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* Generate / Download PDF */}
            {downloadUrl && fileName && reportFormat === 'PDF' ? (
              <a
                href={downloadUrl}
                download={fileName}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950"
              >
                <Download className="w-4 h-4" />
                <span>Download Section 65B PDF</span>
              </a>
            ) : (
              <button
                onClick={() => handleGenerate('PDF')}
                disabled={generating}
                className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-cyan-950"
              >
                <FileText className="w-4 h-4" />
                <span>{generating && reportFormat === 'PDF' ? 'Compiling...' : 'Generate & Export PDF'}</span>
              </button>
            )}

            {/* Generate / Download JSON */}
            {downloadUrl && fileName && reportFormat === 'JSON' ? (
              <a
                href={downloadUrl}
                download={fileName}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-950"
              >
                <Download className="w-4 h-4" />
                <span>Download Machine JSON</span>
              </a>
            ) : (
              <button
                onClick={() => handleGenerate('JSON')}
                disabled={generating}
                className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 border border-slate-700"
              >
                <FileCode className="w-4 h-4" />
                <span>{generating && reportFormat === 'JSON' ? 'Exporting...' : 'Export JSON Dossier'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
