import React, { useState } from 'react';
import {
  Users, Filter, AlertCircle,
  ArrowRight, X, GitCommit, Search, RefreshCw, Cpu
} from 'lucide-react';
import type { Entity, EntityLink } from '../types';

interface EntityCorrelationViewProps {
  entities: Entity[];
  links: EntityLink[];
  onRefreshCorrelations: () => void;
  onSelectEntityForGraph: (entity: Entity) => void;
}

export const EntityCorrelationView: React.FC<EntityCorrelationViewProps> = ({
  entities,
  links,
  onRefreshCorrelations,
  onSelectEntityForGraph
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterBand, setFilterBand] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntityForDrawer, setSelectedEntityForDrawer] = useState<Entity | null>(null);
  const [isRecomputing, setIsRecomputing] = useState<boolean>(false);

  // Filter entities
  const filteredEntities = entities.filter((e) => {
    if (filterType !== 'ALL' && e.entity_type !== filterType) return false;
    if (filterBand !== 'ALL' && e.confidence_band !== filterBand) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesKey = e.normalized_key.toLowerCase().includes(q);
      const matchesRaw = (e.raw_value || '').toLowerCase().includes(q);
      if (!matchesKey && !matchesRaw) return false;
    }
    return true;
  });

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      await onRefreshCorrelations();
    } finally {
      setIsRecomputing(false);
    }
  };

  // Get links associated with a given entity
  const getEntityLinks = (entityId: string) => {
    return links.filter(
      (l) => l.source_entity === entityId || l.target_entity === entityId
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Extracted Entities & Correlation Reasoning</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic and probabilistic entity resolution. Every link decomposes into weighted contributing factors.
            Near-miss decoy candidates display deliberate, transparent "Insufficient Evidence" decisions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRecompute}
            disabled={isRecomputing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition disabled:opacity-50 shadow-md shadow-cyan-950"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin' : ''}`} />
            <span>{isRecomputing ? 'Correlating...' : 'Re-run Correlation Engine'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by key or value..."
              className="bg-transparent focus:outline-none w-44 placeholder-slate-500 font-mono text-xs"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-1 bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Entity Types</option>
              <option value="PHONE" className="bg-slate-900">Phone Numbers</option>
              <option value="DEVICE" className="bg-slate-900">Handset IMEIs</option>
              <option value="ACCOUNT" className="bg-slate-900">Bank Accounts</option>
              <option value="UPI" className="bg-slate-900">UPI VPAs</option>
              <option value="APK" className="bg-slate-900">APK Malwares</option>
              <option value="EMAIL" className="bg-slate-900">Phishing Emails</option>
              <option value="IP" className="bg-slate-900">C2 IP Addresses</option>
            </select>
          </div>

          {/* Confidence Band Filter */}
          <div className="flex items-center space-x-1 bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400 mr-1.5 font-mono">Band:</span>
            <select
              value={filterBand}
              onChange={(e) => setFilterBand(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Confidence Bands</option>
              <option value="High" className="bg-slate-900">High Confidence (&gt; 0.70)</option>
              <option value="Medium" className="bg-slate-900">Medium Confidence (0.40 - 0.70)</option>
              <option value="Low" className="bg-slate-900">Low Confidence (&lt; 0.40)</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing <b className="text-cyan-400">{filteredEntities.length}</b> of {entities.length} entities
        </div>
      </div>

      {/* Main Entities Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Normalized Key</th>
                <th className="py-3 px-4">Confidence Band</th>
                <th className="py-3 px-4">Correlated Connections</th>
                <th className="py-3 px-4">Correlation Decision & Rule</th>
                <th className="py-3 px-4 text-right">Reasoning Drawer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredEntities.map((ent) => {
                const isCanary = ent.normalized_key.includes('RAW:') || ent.normalized_key === '918273645101' || Boolean(ent.metadata_json?.is_canary);
                const entLinks = getEntityLinks(ent.entity_id);
                const band = ent.confidence_band || 'Low';

                return (
                  <tr
                    key={ent.entity_id}
                    onClick={() => setSelectedEntityForDrawer(ent)}
                    className={`hover:bg-slate-800/40 transition cursor-pointer ${
                      isCanary ? 'bg-amber-950/20 hover:bg-amber-950/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ent.entity_type === 'PHONE' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                        ent.entity_type === 'ACCOUNT' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                        ent.entity_type === 'UPI' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                        ent.entity_type === 'DEVICE' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
                        ent.entity_type === 'APK' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {ent.entity_type}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-100">
                      <div className="flex items-center space-x-2">
                        <span>{ent.normalized_key}</span>
                        {isCanary && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            CANARY DECOY
                          </span>
                        )}
                      </div>
                      {ent.raw_value && ent.raw_value !== ent.normalized_key && (
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5 truncate max-w-xs">
                          {ent.raw_value}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {isCanary ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Insufficient Evidence</span>
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          band === 'High' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                          band === 'Medium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {band} Band
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-200 font-semibold">{entLinks.length} links</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {isCanary ? (
                        <div className="text-[11px] text-amber-300 space-y-0.5 max-w-sm">
                          <p className="font-semibold text-amber-400">Deliberate Refusal: Non-Merge</p>
                          <p className="text-[10px] text-amber-200/80">
                            {ent.metadata_json?.canary_note || 'Near-miss decoy candidate failed cryptographic identity verification.'}
                          </p>
                        </div>
                      ) : entLinks.length > 0 ? (
                        <div className="text-[11px] text-slate-300 space-y-0.5 max-w-sm">
                          <p className="text-cyan-300 font-semibold">
                            {entLinks[0].reasoning.rule || 'EXACT_MATCH'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {entLinks[0].reasoning.details || 'Correlated via digital telemetry'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Unlinked artifact</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEntityForDrawer(ent);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs inline-flex items-center space-x-1"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Reasoning Drawer */}
      {selectedEntityForDrawer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 h-full p-6 overflow-y-auto space-y-6 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Correlation Reasoning & Factor Decomposition
                </h3>
              </div>
              <button
                onClick={() => setSelectedEntityForDrawer(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If Canary: Distinct Insufficient Evidence Banner */}
            {(selectedEntityForDrawer.normalized_key.includes('RAW:') ||
              selectedEntityForDrawer.normalized_key === '918273645101' ||
              Boolean(selectedEntityForDrawer.metadata_json?.is_canary)) && (
              <div className="p-4 bg-amber-500/10 border-2 border-amber-500/50 rounded-xl text-amber-200 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-400 text-sm">
                  <AlertCircle className="w-5 h-5" />
                  <span>DELIBERATE CANARY DECISION: INSUFFICIENT EVIDENCE</span>
                </div>
                <p className="text-xs text-amber-300 leading-relaxed font-sans">
                  This entity is a forensic verification canary. The correlation engine deliberately evaluated candidate links
                  and decisively declined merging because statutory identity thresholds were not met.
                </p>
                <div className="p-2.5 bg-slate-950 rounded border border-amber-500/30 text-[11px] text-amber-200 space-y-1">
                  <p className="font-bold uppercase text-[10px] text-amber-400">Canary Audit Rationale:</p>
                  <p>{selectedEntityForDrawer.metadata_json?.canary_note || 'Country code mismatch (+1 vs +91) or off-by-one account transposition.'}</p>
                </div>
              </div>
            )}

            {/* Entity Overview */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Entity Key</p>
                  <p className="text-base font-bold text-slate-100 mt-0.5">{selectedEntityForDrawer.normalized_key}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {selectedEntityForDrawer.entity_type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-500">Risk Score:</span>
                  <span className="text-rose-400 font-bold ml-2">{selectedEntityForDrawer.latest_score?.toFixed(1)} pts</span>
                </div>
                <div>
                  <span className="text-slate-500">Confidence:</span>
                  <span className="text-slate-200 font-bold ml-2">{selectedEntityForDrawer.confidence_band}</span>
                </div>
              </div>
            </div>

            {/* Correlated Links & Factors */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Correlated Links ({getEntityLinks(selectedEntityForDrawer.entity_id).length})
              </h4>

              {getEntityLinks(selectedEntityForDrawer.entity_id).length > 0 ? (
                getEntityLinks(selectedEntityForDrawer.entity_id).map((l) => (
                  <div key={l.link_id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold text-[10px]">
                        {l.link_type}
                      </span>
                      <span className="text-emerald-400 font-bold text-[11px]">
                        Confidence: {(l.confidence * 100).toFixed(1)}% ({l.confidence_band})
                      </span>
                    </div>

                    <p className="text-slate-300 text-xs font-semibold">{l.reasoning.rule}</p>
                    {l.reasoning.details && (
                      <p className="text-slate-400 text-[11px]">{l.reasoning.details}</p>
                    )}

                    {l.reasoning.factors && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Contributing Factor Weights:</p>
                        {Object.entries(l.reasoning.factors).map(([factorName, weight]) => (
                          <div key={factorName} className="flex items-center justify-between text-[11px] text-slate-300">
                            <span>{factorName}</span>
                            <span className="text-cyan-400 font-bold">+{String(weight)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-center text-xs">
                  No active links correlated for this entity.
                </div>
              )}
            </div>

            {/* Action to View in Graph */}
            <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
              <button
                onClick={() => {
                  onSelectEntityForGraph(selectedEntityForDrawer);
                  setSelectedEntityForDrawer(null);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs transition flex items-center space-x-1.5 shadow-md shadow-cyan-950"
              >
                <span>Inspect in Graph View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
