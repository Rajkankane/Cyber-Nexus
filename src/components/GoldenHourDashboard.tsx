import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Clock, FileText, ArrowRight, Zap, Target, Cpu,
  Play, Pause, RotateCcw, ShieldAlert
} from 'lucide-react';
import type { Case, Entity, EvidenceGap } from '../types';

interface DashboardProps {
  currentCase: Case | null;
  cases?: Case[];
  entities: Entity[];
  evidenceGaps: EvidenceGap[];
  evidenceCount: number;
  onOpenReportModal: () => void;
  onNavigateTab: (tab: string) => void;
  onSelectEntityForDrawer: (entity: Entity) => void;
  onUpdateStatus: (newStatus: string) => void;
}

export const GoldenHourDashboard: React.FC<DashboardProps> = ({
  currentCase,
  entities,
  evidenceGaps,
  evidenceCount,
  onOpenReportModal,
  onNavigateTab,
  onSelectEntityForDrawer,
  onUpdateStatus
}) => {
  // Golden Hour 3-minute SLA Stopwatch State (180 seconds SLA)
  const SLA_TOTAL_SECONDS = 180;
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(45);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  if (!currentCase) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono">
        <p>No active case selected.</p>
      </div>
    );
  }

  // Sort entities by latest score descending
  const prioritizedLeads = [...entities].sort(
    (a, b) => (b.latest_score || 0) - (a.latest_score || 0)
  );

  const highestRisk = prioritizedLeads.length > 0 ? (prioritizedLeads[0].latest_score || 20) : 0;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const slaRemaining = Math.max(0, SLA_TOTAL_SECONDS - elapsedSeconds);
  const slaPct = Math.min(100, Math.round((elapsedSeconds / SLA_TOTAL_SECONDS) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Golden Hour SLA Console */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0e1424] to-slate-900 border border-slate-700/80 rounded-xl p-5 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 mt-1 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
            <Clock className={`w-7 h-7 ${isTimerRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-100 font-sans tracking-wide">
                Golden Hour Action Console: {currentCase.title}
              </h2>
              {/* Status Chips */}
              <div className="flex items-center space-x-1.5 ml-1">
                {(['ACTIVE', 'UNDER_REVIEW', 'CLOSED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => onUpdateStatus(st)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold transition border ${
                      currentCase.status === st
                        ? st === 'ACTIVE'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                          : st === 'UNDER_REVIEW'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans">
              Statutory 3-minute SLA window for rapid fund freezing, telecom subscriber lock, and mule-account lien requests.
              Correlated across CDR, IPDR, Bank trails, UPI logs, and APK dropper artifacts.
            </p>
          </div>
        </div>

        {/* Stopwatch & SLA Countdown Widget */}
        <div className="flex items-center space-x-4 bg-slate-950/80 border border-slate-800 p-3 rounded-xl shadow-inner font-mono shrink-0 w-full lg:w-auto justify-between sm:justify-end">
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
              <span>SLA Stopwatch</span>
              <span className={slaRemaining > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {slaRemaining > 0 ? `${slaRemaining}s remaining` : 'SLA Target Exceeded'}
              </span>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-2xl font-black text-amber-400 tracking-tight">
                {timeFormatted}
              </span>
              <span className="text-xs text-slate-500">/ 03:00 SLA</span>
            </div>
            {/* Progress Bar */}
            <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full transition-all duration-500 ${
                  slaPct >= 100 ? 'bg-rose-500' : slaPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${slaPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={isTimerRunning ? 'Pause Stopwatch' : 'Resume Stopwatch'}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setElapsedSeconds(0)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Reset Stopwatch"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border-l border-slate-800 pl-3">
            <button
              onClick={onOpenReportModal}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-md shadow-cyan-950 shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Brief</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Defrauded Amount */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4.5 shadow-sm space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Defrauded Amount</p>
          <p className="text-2xl font-black text-rose-400 font-mono tracking-tight">
            INR {Number(currentCase.amount_inr || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">Reported to 1930 / CFCFRMS</p>
        </div>

        {/* Card 2: Priority Suspect Leads */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Priority Leads</p>
            <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/30">
              Max {highestRisk.toFixed(0)} pts
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              {prioritizedLeads.filter((e) => (e.latest_score || 0) >= 60).length}
            </p>
            <span className="text-xs text-slate-400 font-mono">of {entities.length} entities</span>
          </div>
          <p className="text-[11px] text-emerald-400 font-mono flex items-center">
            <Zap className="w-3 h-3 mr-1" /> Prioritized in {currentCase.correlation_latency_ms || 32}ms
          </p>
        </div>

        {/* Card 3: Forensic Evidence Gaps */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4.5 shadow-sm space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Evidence Gaps Identified</p>
          <p className="text-2xl font-black text-cyan-400 font-mono tracking-tight">
            {evidenceGaps.length}
          </p>
          <p className="text-[11px] text-rose-400 font-mono flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" /> Requires statutory field notices
          </p>
        </div>

        {/* Card 4: Execution Architecture */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4.5 shadow-sm space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Custody Architecture</p>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200">100% Offline & Single-Machine</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {evidenceCount} Evidence files ingested & sealed
          </p>
        </div>
      </div>

      {/* Main Grid: Prioritized Leads & Evidence-Gap Detector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prioritized Leads Table */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/90 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">
                Prioritized Suspect Leads (Explainable Evidence-First Score)
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('risk')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 transition font-mono"
            >
              <span>Explain All Scores</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Identifier / Key</th>
                  <th className="py-2.5 px-3">Score & Band</th>
                  <th className="py-2.5 px-3">Traceable Evidence Factors</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {prioritizedLeads.slice(0, 6).map((lead) => {
                  const score = lead.latest_score || 20;
                  const isHigh = score >= 70;
                  const isMed = score >= 40 && score < 70;
                  const isCanary = lead.normalized_key.includes('RAW:') || lead.normalized_key === '918273645101' || Boolean(lead.metadata_json?.is_canary);

                  return (
                    <tr
                      key={lead.entity_id}
                      className={`hover:bg-slate-800/40 transition cursor-pointer ${
                        isCanary ? 'bg-amber-950/20' : ''
                      }`}
                      onClick={() => onSelectEntityForDrawer(lead)}
                    >
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          lead.entity_type === 'PHONE' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                          lead.entity_type === 'ACCOUNT' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                          lead.entity_type === 'UPI' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                          lead.entity_type === 'DEVICE' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
                          'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {lead.entity_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        {lead.normalized_key}
                        {isCanary && (
                          <span className="ml-2 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] border border-amber-500/40 font-bold">
                            CANARY DECOY
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-black ${isHigh ? 'text-rose-400' : isMed ? 'text-amber-400' : 'text-slate-400'}`}>
                            {score.toFixed(1)}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            isHigh ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                            isMed ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {lead.confidence_band || 'Low'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {lead.risk_factors && Object.keys(lead.risk_factors).length > 0 ? (
                            Object.entries(lead.risk_factors).map(([factor, pts]) => (
                              <span key={factor} className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[10px] border border-slate-700/60">
                                {factor} (+{pts})
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[10px]">Normal baseline activity</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-xs text-cyan-400 hover:underline">Inspect &rarr;</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Evidence-Gap Detector */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">
              Evidence-Gap Detector
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Automated statutory compliance audit. Flags missing digital trails before statutory preservation windows lapse.
          </p>

          <div className="space-y-3">
            {evidenceGaps.map((gap) => (
              <div
                key={gap.gap_id}
                className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                  gap.severity === 'CRITICAL'
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                    : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {gap.gap_id}
                  </span>
                  <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                    gap.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {gap.severity}
                  </span>
                </div>
                <p className="text-slate-300 font-medium font-sans leading-tight">{gap.description}</p>
                <div className="pt-1.5 border-t border-slate-800/80">
                  <p className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wide font-mono">
                    Statutory Recommended Action:
                  </p>
                  <p className="text-slate-400 mt-0.5 text-[11px] font-sans leading-normal">{gap.recommended_action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
