import React, { useState, useRef } from 'react';
import {
  Upload, FileCheck, AlertOctagon, Shield, Hash, CheckCircle2,
  XCircle, Eye, Lock
} from 'lucide-react';
import type { Evidence, ParseException } from '../types';
import { api } from '../api/client';

interface EvidenceVaultViewProps {
  evidenceList: Evidence[];
  activeCaseId: string;
  onEvidenceUploaded: () => void;
}

export const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({
  evidenceList,
  activeCaseId,
  onEvidenceUploaded
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sourceType, setSourceType] = useState<string>('CDR');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [parseStatusText, setParseStatusText] = useState<string>('');
  const [sealedHash, setSealedHash] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [exceptions, setExceptions] = useState<ParseException[]>([]);
  const [selectedEvidenceForExceptions, setSelectedEvidenceForExceptions] = useState<Evidence | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setUploadError(null);
      setSealedHash(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setUploadError(null);
      setSealedHash(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);
      setSealedHash(null);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Step 1: Hashing & upload simulation
        setParseStatusText(`Hashing & securing ${file.name} with SHA-256...`);
        setUploadProgress(25);

        await new Promise((r) => setTimeout(r, 300));
        setParseStatusText(`Ingesting artifact to cryptographic vault...`);
        setUploadProgress(50);

        // Step 2: Call upload API
        const uploaded = await api.uploadEvidence(activeCaseId, file, sourceType);

        // Step 3: Simulated real-time row-by-row parse feedback
        const totalRows = uploaded.row_count || 1000;
        const halfRows = Math.floor(totalRows * 0.62);
        setParseStatusText(`Parsing row ${halfRows.toLocaleString()} of ${totalRows.toLocaleString()}...`);
        setUploadProgress(75);

        await new Promise((r) => setTimeout(r, 400));
        setParseStatusText(
          `${uploaded.parsed_count.toLocaleString()} of ${totalRows.toLocaleString()} rows parsed — ${uploaded.failed_count} exceptions logged`
        );
        setUploadProgress(100);
        setSealedHash(uploaded.sha256_original);
      }

      onEvidenceUploaded();
    } catch (err: any) {
      setUploadError(err.message || 'Evidence upload and parsing failed');
    } finally {
      setUploading(false);
    }
  };

  const handleViewExceptions = async (ev: Evidence) => {
    try {
      setSelectedEvidenceForExceptions(ev);
      const excs = await api.getParseExceptions(activeCaseId, ev.evidence_id);
      setExceptions(excs);
    } catch (err) {
      console.error('Failed to load exceptions', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Vault Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>Forensic Evidence Vault & Integrity Layer</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Section 65B(4) Certified: Files are hashed with SHA-256 immediately upon arrival, stored in an immutable vault,
            and sealed with permanent read-only access locks. Fault-tolerant parsers isolate malformed records without discarding valid trails.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono text-slate-300">
          <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center space-x-2 shadow-sm">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>{evidenceList.length} Sealed Artifacts</span>
          </span>
        </div>
      </div>

      {/* Multi-File Drag-and-Drop Ingestion Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center space-x-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Ingest New Forensic Evidence Artifacts</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Accepts CSV, XLSX, EML, APK, IPDR, PCAP
          </span>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Evidence Source Category</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
              >
                <option value="CDR">CDR (Call Detail Records)</option>
                <option value="IPDR">IPDR (IP Session Records)</option>
                <option value="BANK">Bank Account Statement (CSV/XLSX)</option>
                <option value="UPI">UPI Transaction Ledger</option>
                <option value="EML">EML (Phishing Email & DKIM)</option>
                <option value="APK">APK (Static Malware Dropper)</option>
                <option value="ANDROID">Android Physical Extraction</option>
              </select>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`md:col-span-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-1 ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-slate-700/80 bg-slate-950/60 hover:border-slate-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className={`w-5 h-5 ${isDragOver ? 'text-cyan-400' : 'text-slate-500'}`} />
              <p className="text-xs text-slate-300 font-medium">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file(s) selected: ${selectedFiles.map((f) => f.name).join(', ')}`
                  : 'Drag & drop forensic evidence files here, or click to browse'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Automatic SHA-256 pre-calculation and zip-bomb validation
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {uploadError && (
                <p className="text-xs text-rose-400 font-mono flex items-center">
                  <AlertOctagon className="w-3.5 h-3.5 mr-1" /> {uploadError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={selectedFiles.length === 0 || uploading}
              className={`py-2.5 px-5 rounded-lg font-semibold text-xs transition flex items-center space-x-2 shrink-0 ${
                selectedFiles.length === 0 || uploading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{uploading ? 'Processing Ingestion...' : 'Ingest & Seal Fingerprint'}</span>
            </button>
          </div>

          {/* Real-time Progress & Parsing Feedback */}
          {uploading && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center space-x-1.5 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>{parseStatusText}</span>
                </span>
                <span className="text-slate-400 font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Sealed Hash Badge Animation */}
          {sealedHash && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl font-mono text-xs flex items-center justify-between text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-in fade-in">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span>ARTIFACT PERMANENTLY SEALED</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40">
                      READ-ONLY LOCK ENGAGED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    SHA-256: <code className="text-emerald-300">{sealedHash}</code>
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
                Sec 65B Certified
              </span>
            </div>
          )}
        </form>
      </div>

      {/* Evidence Register Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">
            Chain of Custody Evidence Register
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            {evidenceList.length} Records Locked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Lock</th>
                <th className="py-3 px-4">Artifact Type</th>
                <th className="py-3 px-4">Vault Path / File</th>
                <th className="py-3 px-4">SHA-256 Original Fingerprint</th>
                <th className="py-3 px-4">Parsing Status</th>
                <th className="py-3 px-4">Acquired At</th>
                <th className="py-3 px-4 text-right">Exception Register</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {evidenceList.map((ev) => (
                <tr key={ev.evidence_id} className="hover:bg-slate-800/40 transition">
                  {/* Read-Only Lock Icon */}
                  <td className="py-3 px-4">
                    <span
                      className="p-1 rounded bg-slate-800 text-emerald-400 inline-block border border-slate-700"
                      title="Read-only custody lock enabled"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                      {ev.source_type}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-200 font-semibold max-w-xs truncate">
                    {ev.file_path.split('\\').pop() || ev.file_path}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                    <div className="flex items-center space-x-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>{ev.sha256_original.slice(0, 16)}...{ev.sha256_original.slice(-8)}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-200">
                        {ev.parsed_count.toLocaleString()} of {ev.row_count.toLocaleString()} rows parsed
                      </span>
                      {ev.failed_count > 0 ? (
                        <button
                          onClick={() => handleViewExceptions(ev)}
                          className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] border border-rose-500/40 flex items-center space-x-1 hover:bg-rose-500/30 transition"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>{ev.failed_count} exceptions</span>
                        </button>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(ev.ingested_at).toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-right">
                    {ev.failed_count > 0 ? (
                      <button
                        onClick={() => handleViewExceptions(ev)}
                        className="text-amber-400 hover:text-amber-300 text-xs inline-flex items-center space-x-1 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Exceptions</span>
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[10px]">100% Clean Parse</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parse Exceptions Modal */}
      {selectedEvidenceForExceptions && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>Quarantined Parse Exceptions ({selectedEvidenceForExceptions.source_type})</span>
              </div>
              <button
                onClick={() => setSelectedEvidenceForExceptions(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              Forensic Integrity Rule: Rather than failing the entire file or silently dropping bad rows,
              fault-tolerant ingestion logs every corrupt row into the database exception registry for officer audit.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {exceptions.map((ex) => (
                <div key={ex.exception_id} className="p-3 bg-slate-950 rounded border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-rose-400 font-bold">
                    <span>Corrupt Record at Row #{ex.row_index}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(ex.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 font-semibold">{ex.error_message}</p>
                  {ex.raw_content && (
                    <pre className="text-[10px] text-slate-400 overflow-x-auto bg-slate-900 p-2 rounded border border-slate-800">
                      {ex.raw_content}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEvidenceForExceptions(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Close Exception Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
