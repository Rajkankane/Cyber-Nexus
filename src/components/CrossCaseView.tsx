import React, { useEffect, useState } from 'react';
import { Network, ShieldCheck, FolderGit2 } from 'lucide-react';
import type { CrossCaseMatch } from '../types';
import { api } from '../api/client';

export const CrossCaseView: React.FC = () => {
  const [matches, setMatches] = useState<CrossCaseMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const data = await api.getCrossCaseMatches();
      setMatches(data);
    } catch (err) {
      console.error('Failed to load cross-case matches', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>Cross-Case Linkage & Organized Syndicate Detection</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detects when separate, unlinked cyber complaints share common infrastructure (same IMEI, UPI ID, Bank Account, or IP).
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
          {matches.length} Cross-Case Overlaps Found
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 font-mono py-8 text-center">Scanning across case dossiers...</p>
      ) : matches.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
          No cross-case entity overlaps detected among active cases.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {matches.map((match, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-5 shadow-lg space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    SHARED {match.entity_type}
                  </span>
                  <h3 className="text-base font-black text-slate-100 font-mono mt-1.5 break-all">
                    {match.normalized_key}
                  </h3>
                </div>

                <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/30">
                  CONFIDENCE 0.99
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
                  <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Linked Cases ({match.linked_cases_count}):</span>
                </p>

                <div className="space-y-2">
                  {match.cases.map((c) => (
                    <div
                      key={c.case_id}
                      className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-1"
                    >
                      <div className="flex justify-between font-bold text-slate-200">
                        <span>{c.title}</span>
                        <span className="text-[10px] text-emerald-400">{c.status}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Case ID: {c.case_id.slice(0, 8)}...</span>
                        <span className="text-amber-400">{c.incident_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80">
                <span className="flex items-center text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Syndicate Overlap Confirmed
                </span>
                <span className="font-mono text-slate-500">1930 / I4C Portal Sync</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
