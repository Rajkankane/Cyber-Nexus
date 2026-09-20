import React, { useState } from 'react';
import {
  Target, CheckCircle, Sparkles, BrainCircuit, Filter,
  ArrowUpDown
} from 'lucide-react';
import type { Entity } from '../types';

interface RiskExplainabilityViewProps {
  entities: Entity[];
}

export const RiskExplainabilityView: React.FC<RiskExplainabilityViewProps> = ({ entities }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortDirection, setSortDirection] = useState<'DESC' | 'ASC'>('DESC');
  const [hoveredFactor, setHoveredFactor] = useState<{ entityId: string; factor: string; points: number } | null>(null);

  // Colors for factor decomposition segments
  const factorColors = [
    'bg-rose-500 hover:bg-rose-400',
    'bg-amber-500 hover:bg-amber-400',
    'bg-cyan-500 hover:bg-cyan-400',
    'bg-purple-500 hover:bg-purple-400',
    'bg-emerald-500 hover:bg-emerald-400',
    'bg-blue-500 hover:bg-blue-400'
  ];

  const filteredEntities = entities
    .filter((e) => (filterType === 'ALL' ? true : e.entity_type === filterType))
    .sort((a, b) => {
      const scoreA = a.latest_score || 20;
      const scoreB = b.latest_score || 20;
      return sortDirection === 'DESC' ? scoreB - scoreA : scoreA - scoreB;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Target className="w-5 h-5 text-cyan-400" />
            <span>Risk Priority Queue & Factor Decomposition</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Statutory Transparency: Every risk score is 100% decomposed into stored evidence factors.
            Machine-learning anomaly flags are strictly segregated as non-authoritative advisory hints.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-xs text-indigo-300 font-mono shadow-sm">
          <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>IsolationForest: Unsupervised Anomaly Engine Active</span>
        </div>
      </div>

      {/* Explanatory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
            <CheckCircle className="w-4 h-4" />
            <span>Authoritative Statutory Rule Weights</span>
          </div>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            Deterministic forensic checks: IMEI device churn, rapid fan-in/fan-out mule routing,
            Android SMS interception permissions, and phishing SPF/DKIM spoof flags.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
            <Sparkles className="w-4 h-4" />
            <span>Non-Authoritative Outlier Detection</span>
          </div>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            Unsupervised IsolationForest flags multi-dimensional behavioral anomalies. Outlined chips guarantee
            the statistical hint is never visually merged with the court-admissible legal score.
          </p>
        </div>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Entity Types</option>
              <option value="PHONE" className="bg-slate-900">Phones</option>
              <option value="ACCOUNT" className="bg-slate-900">Bank Accounts</option>
              <option value="UPI" className="bg-slate-900">UPI VPAs</option>
              <option value="DEVICE" className="bg-slate-900">Handset IMEIs</option>
              <option value="APK" className="bg-slate-900">APKs</option>
              <option value="EMAIL" className="bg-slate-900">Emails</option>
            </select>
          </div>

          <button
            onClick={() => setSortDirection(sortDirection === 'DESC' ? 'ASC' : 'DESC')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sort by Score: {sortDirection === 'DESC' ? 'Highest First' : 'Lowest First'}</span>
          </button>
        </div>

        <div className="text-slate-400">
          Showing <b>{filteredEntities.length}</b> prioritized entities
        </div>
      </div>

      {/* Priority Queue Table with Stacked Score Bars */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Identifier / Normalized Key</th>
                <th className="py-3 px-4">Score & Band</th>
                <th className="py-3 px-4 w-72">Decomposed Factor Stack</th>
                <th className="py-3 px-4">Secondary Anomaly Chip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredEntities.map((ent) => {
                const score = ent.latest_score || 20;
                const isHigh = score >= 70;
                const isMed = score >= 40 && score < 70;
                const isCanary = ent.normalized_key.includes('RAW:') || ent.normalized_key === '918273645101' || Boolean(ent.metadata_json?.is_canary);
                const factors = ent.risk_factors || {};
                const factorEntries = Object.entries(factors);
                const totalFactorPoints = factorEntries.reduce((acc, [, pts]) => acc + (pts as number), 0) || score;

                return (
                  <tr
                    key={ent.entity_id}
                    className={`hover:bg-slate-800/40 transition ${
                      isCanary ? 'bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                        {ent.entity_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-200">
                      <div className="flex items-center space-x-2">
                        <span>{ent.normalized_key}</span>
                        {isCanary && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] border border-amber-500/40 font-bold">
                            CANARY
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className={`text-base font-black ${isHigh ? 'text-rose-400' : isMed ? 'text-amber-400' : 'text-slate-400'}`}>
                          {score.toFixed(1)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isHigh ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                          isMed ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {ent.confidence_band || 'Low'}
                        </span>
                      </div>
                    </td>

                    {/* Stacked Horizontal Score Bar */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        <div className="h-3 w-full bg-slate-800/90 rounded-md overflow-hidden flex shadow-inner">
                          {factorEntries.length > 0 ? (
                            factorEntries.map(([factorName, points], fIdx) => {
                              const pts = points as number;
                              const segmentWidth = Math.max(8, Math.round((pts / totalFactorPoints) * 100));
                              const colorClass = factorColors[fIdx % factorColors.length];

                              return (
                                <div
                                  key={factorName}
                                  onMouseEnter={() => setHoveredFactor({ entityId: ent.entity_id, factor: factorName, points: pts })}
                                  onMouseLeave={() => setHoveredFactor(null)}
                                  className={`${colorClass} h-full transition-all cursor-pointer`}
                                  style={{ width: `${segmentWidth}%` }}
                                  title={`${factorName}: +${pts} pts`}
                                />
                              );
                            })
                          ) : (
                            <div className="w-full bg-slate-700/40 h-full" title="Baseline normal activity" />
                          )}
                        </div>

                        {/* Hover Factor Tooltip Info */}
                        {hoveredFactor && hoveredFactor.entityId === ent.entity_id ? (
                          <p className="text-[10px] text-cyan-300 truncate">
                            Factor: <b>{hoveredFactor.factor}</b> (+{hoveredFactor.points} pts)
                          </p>
                        ) : factorEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {factorEntries.map(([f, pts]) => (
                              <span key={f} className="text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                {f}: +{pts}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Normal activity baseline</span>
                        )}
                      </div>
                    </td>

                    {/* Segregated Outlined Anomaly Badge */}
                    <td className="py-3.5 px-4">
                      {ent.anomaly_flag && ent.anomaly_flag.is_anomalous ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-[10px] font-bold border-2 border-dashed border-indigo-400 text-indigo-300 bg-indigo-950/20 shadow-sm">
                            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>STATISTICAL OUTLIER (ISOLATION-FOREST)</span>
                          </span>
                          <p className="text-[9px] text-slate-500">
                            Score: {ent.anomaly_flag.anomaly_score} (Non-authoritative hint)
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Statistical norm
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
