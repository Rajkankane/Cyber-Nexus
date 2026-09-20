import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2,
  Lock, Link2, Database
} from 'lucide-react';
import type { AuditLogEntry } from '../types';
import { api } from '../api/client';

export const AuditChainInspector: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [chainStatus, setChainStatus] = useState<any>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [tamperSimulated, setTamperSimulated] = useState<boolean>(false);
  const [liveCheckPassed, setLiveCheckPassed] = useState<boolean>(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setVerifying(true);
      const data = await api.getAuditLogs();
      const status = await api.verifyAuditChain();
      setLogs(data);
      setChainStatus(status);
      setLiveCheckPassed(status.chain_valid);
    } catch (err) {
      console.error('Failed to fetch audit records', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    if (logs.length === 0) return;
    try {
      const targetId = logs[Math.min(2, logs.length - 1)].log_id;
      await api.simulateTamper(targetId);
      setTamperSimulated(true);
      await fetchLogs();
    } catch (err) {
      console.error('Failed to simulate tamper', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2 font-sans">
            <Lock className="w-5 h-5 text-cyan-400" />
            <span>Cryptographic Hash-Chained Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Section 65B(4) Indian Evidence Act & ISO/IEC 27037 Digital Chain of Custody compliance.
            Every write operation seals a SHA-256 hash incorporating the previous row's digest. Demonstrable integrity.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLogs}
            disabled={verifying}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition shadow-md shadow-cyan-950 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Verifying Hashes...' : 'Verify Chain Integrity'}</span>
          </button>

          <button
            onClick={handleSimulateTamper}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-semibold transition border border-rose-500/40"
            title="Adversarially modify a database entry to demonstrate how the cryptographic chain immediately rejects corruption"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Simulate Adversarial Tamper</span>
          </button>
        </div>
      </div>

      {/* Demonstrable Integrity Banner */}
      {chainStatus && (
        <div
          className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl transition-all ${
            liveCheckPassed
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/60 text-rose-200'
          }`}
        >
          <div className="flex items-start md:items-center space-x-3.5">
            {liveCheckPassed ? (
              <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 shrink-0">
                <ShieldCheck className="w-8 h-8" />
              </div>
            ) : (
              <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 shrink-0 animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold tracking-wide uppercase font-mono">
                  {liveCheckPassed
                    ? 'VERIFICATION PASSED: SECTION 65B CHAIN IS 100% UNMANIPULATED'
                    : 'INTEGRITY BREACH DETECTED: ADVERSARIAL ROW TAMPER IDENTIFIED'}
                </h3>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    liveCheckPassed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {liveCheckPassed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans leading-relaxed">
                {chainStatus.status_description}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Database className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 font-bold">{chainStatus.total_records} Audited Transactions</span>
          </div>
        </div>
      )}

      {tamperSimulated && !liveCheckPassed && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-500/60 rounded-xl text-rose-200 text-xs flex items-center space-x-2 font-sans">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <b>Adversarial modification demonstrated!</b> Row actor was modified in the database. Notice how the recalculated SHA-256
            differs from the stored hash, causing all subsequent block hashes to fail validation instantly.
          </span>
        </div>
      )}

      {/* Append-Only Ledger Table with Chain Link Icons */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Append-Only Cryptographic Ledger (Genesis &rarr; Head)
          </h3>
          <span className="text-[10px] text-slate-400">
            SHA-256(prev_hash || actor || action || target || timestamp)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Link</th>
                <th className="py-2.5 px-3">Log ID</th>
                <th className="py-2.5 px-3">Integrity</th>
                <th className="py-2.5 px-3">Officer / Actor</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">Target Reference</th>
                <th className="py-2.5 px-3">Previous Block Hash</th>
                <th className="py-2.5 px-3">Computed Row Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {logs.map((log) => (
                <tr
                  key={log.log_id}
                  className={`hover:bg-slate-800/40 transition ${
                    !log.is_valid ? 'bg-rose-950/40 text-rose-200' : ''
                  }`}
                >
                  {/* Small Chain-Link Icon */}
                  <td className="py-3 px-3">
                    <span
                      className={`p-1 rounded inline-block border ${
                        log.is_valid
                          ? 'bg-slate-800 text-emerald-400 border-slate-700'
                          : 'bg-rose-950 text-rose-400 border-rose-600'
                      }`}
                      title={log.is_valid ? 'Cryptographic link verified' : 'Broken link! Hash mismatch'}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </span>
                  </td>

                  <td className="py-3 px-3 font-bold text-slate-400">#{log.log_id}</td>

                  <td className="py-3 px-3">
                    {log.is_valid ? (
                      <span className="flex items-center text-emerald-400 text-[10px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> VALID
                      </span>
                    ) : (
                      <span className="flex items-center text-rose-400 text-[10px] font-bold animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> BROKEN
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-slate-200 font-semibold">{log.actor}</td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                      {log.action}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{log.target_ref}</td>

                  <td className="py-3 px-3 text-slate-500 text-[10px]">
                    {log.prev_hash ? `${log.prev_hash.slice(0, 10)}...` : '0000000000... (GENESIS)'}
                  </td>

                  <td className="py-3 px-3 text-cyan-400 font-bold">
                    {log.row_hash.slice(0, 12)}...{log.row_hash.slice(-6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
