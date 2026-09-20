import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import type { Core, EventObject } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCw, Filter, ShieldAlert,
  FileSpreadsheet, X, AlertCircle, Flame, Layers
} from 'lucide-react';
import type { GraphData, GraphNode, GraphEdge, Entity } from '../types';

cytoscape.use(dagre);

interface EntityGraphViewProps {
  graphData: GraphData | null;
  onRefreshGraph: () => void;
  selectedEntity: Entity | null;
  onSelectEntity: (entity: Entity | null) => void;
  isInvestigationMode: boolean;
  onToggleInvestigationMode: () => void;
}

export const EntityGraphView: React.FC<EntityGraphViewProps> = ({
  graphData,
  onRefreshGraph,
  selectedEntity,
  onSelectEntity,
  isInvestigationMode,
  onToggleInvestigationMode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [selectedNodeData, setSelectedNodeData] = useState<GraphNode | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<GraphEdge | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [highlightChokepoints, setHighlightChokepoints] = useState<boolean>(true);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Build elements with mapped sizes and widths
    const elements: any[] = [];

    graphData.nodes.forEach((n) => {
      if (filterType !== 'ALL' && n.type !== filterType) return;

      let color = '#0284c7'; // default cyan/blue
      if (n.type === 'PHONE') color = '#06b6d4';
      if (n.type === 'DEVICE') color = '#a855f7';
      if (n.type === 'ACCOUNT') color = '#10b981';
      if (n.type === 'UPI') color = '#3b82f6';
      if (n.type === 'APK') color = '#f43f5e';
      if (n.type === 'EMAIL') color = '#f59e0b';
      if (n.type === 'IP') color = '#6366f1';

      const isChoke = n.is_chokepoint && highlightChokepoints;
      if (isChoke) {
        color = '#ef4444'; // Red-hot chokepoint
      }
      if (n.is_canary) {
        color = '#eab308'; // Amber canary
      }

      // Map node size to risk score: score 20 -> size 44, score 90 -> size 72
      const calculatedSize = Math.max(42, Math.min(76, Math.round(38 + (n.score / 100) * 36)));

      elements.push({
        group: 'nodes',
        data: {
          id: n.id,
          label: `${n.type}\n${n.label.length > 18 ? n.label.slice(0, 18) + '...' : n.label}`,
          raw_node: n,
          bgColor: color,
          borderColor: isChoke ? '#f87171' : (n.is_canary ? '#fef08a' : '#1e293b'),
          borderWidth: isChoke ? 5 : (n.is_canary ? 4 : 2),
          size: calculatedSize
        }
      });
    });

    graphData.edges.forEach((e) => {
      const hasSource = elements.some((el) => el.group === 'nodes' && el.data.id === e.source);
      const hasTarget = elements.some((el) => el.group === 'nodes' && el.data.id === e.target);

      if (hasSource && hasTarget) {
        // Map edge thickness to link confidence (0.40 -> 2px, 0.99 -> 6px)
        const edgeWidth = Math.max(2, Math.min(6, Math.round(e.confidence * 6)));

        elements.push({
          group: 'edges',
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: `${e.type} (${(e.confidence * 100).toFixed(0)}%)`,
            raw_edge: e,
            width: edgeWidth,
            lineColor: e.type === 'FUND_TRANSFER' ? '#10b981' : e.type === 'DEVICE_REUSE' ? '#a855f7' : '#64748b'
          }
        });
      }
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(bgColor)',
            'label': 'data(label)',
            'color': '#f8fafc',
            'font-size': '10px',
            'font-family': 'monospace',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'width': 'data(size)',
            'height': 'data(size)',
            'border-color': 'data(borderColor)',
            'border-width': 'data(borderWidth)',
            'text-outline-color': '#0f172a',
            'text-outline-width': 2
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(width)',
            'line-color': 'data(lineColor)',
            'target-arrow-color': 'data(lineColor)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'font-family': 'monospace',
            'color': '#94a3b8',
            'text-rotation': 'autorotate',
            'text-background-color': '#0f172a',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px'
          }
        },
        {
          selector: ':selected',
          style: {
            'border-color': '#38bdf8',
            'border-width': 6,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8'
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 50,
        spacingFactor: 1.35
      }
    });

    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      const raw = node.data('raw_node') as GraphNode;
      setSelectedNodeData(raw);
      setSelectedEdgeData(null);
      if (onSelectEntity) {
        onSelectEntity(null);
      }
    });

    cy.on('tap', 'edge', (evt: EventObject) => {
      const edge = evt.target;
      const raw = edge.data('raw_edge') as GraphEdge;
      setSelectedEdgeData(raw);
      setSelectedNodeData(null);
    });

    if (selectedEntity) {
      const targetNode = cy.$(`node[id = "${selectedEntity.entity_id}"]`);
      if (targetNode.length > 0) {
        targetNode.select();
        cy.center(targetNode);
        const raw = targetNode.data('raw_node') as GraphNode;
        setSelectedNodeData(raw);
      }
    }

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, filterType, highlightChokepoints, selectedEntity, onSelectEntity]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit();
  const handleResetLayout = () => {
    cyRef.current?.layout({ name: 'breadthfirst', directed: true, padding: 50 }).run();
    if (onRefreshGraph) {
      onRefreshGraph();
    }
  };

  return (
    <div
      className={`relative w-full bg-[#080d1a] overflow-hidden flex transition-all duration-200 ${
        isInvestigationMode
          ? 'fixed inset-0 z-50 h-screen w-screen'
          : 'h-[calc(100vh-100px)]'
      }`}
    >
      {/* Cytoscape Canvas */}
      <div className="flex-1 relative h-full">
        {/* Floating Investigation HUD Controls */}
        <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2 shadow-2xl backdrop-blur font-mono text-xs">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
            title="Fit Graph to View"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetLayout}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
            title="Re-layout Graph"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Type Filter */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer py-1 pr-1 font-mono"
            >
              <option value="ALL" className="bg-slate-900">All Entities</option>
              <option value="PHONE" className="bg-slate-900">Phones</option>
              <option value="ACCOUNT" className="bg-slate-900">Bank Accounts</option>
              <option value="UPI" className="bg-slate-900">UPI VPAs</option>
              <option value="DEVICE" className="bg-slate-900">Handset IMEIs</option>
              <option value="APK" className="bg-slate-900">APKs</option>
              <option value="EMAIL" className="bg-slate-900">Emails</option>
              <option value="IP" className="bg-slate-900">IPs</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Chokepoint Toggle */}
          <button
            onClick={() => setHighlightChokepoints(!highlightChokepoints)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
              highlightChokepoints
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${highlightChokepoints ? 'text-rose-400 animate-pulse' : ''}`} />
            <span>Chokepoint Glow</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Investigation Mode Toggle */}
          <button
            onClick={onToggleInvestigationMode}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
              isInvestigationMode
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={isInvestigationMode ? 'Exit Investigation Mode' : 'Enter Distraction-Free Investigation Mode'}
          >
            {isInvestigationMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isInvestigationMode ? 'Exit Full-Screen' : 'Investigation Mode'}</span>
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-[11px] space-y-1.5 shadow-2xl backdrop-blur font-mono">
          <p className="font-bold text-slate-300 uppercase tracking-wider mb-1">Topology Legend</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400 text-[10px]">
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500 mr-1.5" /> Phone</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-1.5" /> Handset IMEI</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" /> Bank Account</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" /> UPI ID</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5" /> Malware APK</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" /> Email / Phish</span>
            <span className="flex items-center col-span-2 text-rose-300 font-semibold mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 mr-1.5 border border-red-300 shadow-[0_0_6px_#ef4444]" /> Betweenness Chokepoint (Cash-Out Mule Hub)
            </span>
            <span className="flex items-center col-span-2 text-amber-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 mr-1.5" /> Canary Decoy (Unmerged Near-Miss)
            </span>
          </div>
        </div>

        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Right Drawer: Entity Details & Linked Evidence */}
      {(selectedNodeData || selectedEdgeData) && (
        <div className="w-96 bg-[#0f1422] border-l border-slate-800 p-5 overflow-y-auto flex flex-col justify-between shadow-2xl z-20 font-mono text-xs animate-in slide-in-from-right duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {selectedNodeData ? 'Entity Detail Drawer' : 'Link Correlation Proof'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedNodeData(null);
                  setSelectedEdgeData(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If Node Selected */}
            {selectedNodeData && (
              <div className="space-y-3.5">
                {/* Canary Banner */}
                {selectedNodeData.is_canary && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-amber-200 space-y-1.5 font-sans">
                    <div className="flex items-center space-x-1.5 font-bold text-amber-400 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      <span>DELIBERATE FALSE-LINK CANARY</span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      Refused merge: The engine identified this near-miss (+1 US or off-by-one account) and decided
                      <b>"Insufficient Evidence"</b> to prevent wrongful false-positive attribution.
                    </p>
                  </div>
                )}

                {/* Chokepoint Banner */}
                {selectedNodeData.is_chokepoint && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-200 space-y-1 font-sans">
                    <div className="flex items-center space-x-1.5 font-bold text-rose-400 text-xs">
                      <ShieldAlert className="w-4 h-4" />
                      <span>CASH-OUT MULE CHOKEPOINT</span>
                    </div>
                    <p className="text-[11px] text-rose-300 leading-relaxed">
                      Betweenness Centrality: {selectedNodeData.centrality}. Top-tier nexus node through which multiple fraudulent routing streams converge for liquidation.
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">Normalized Key</p>
                  <p className="font-mono text-sm font-bold text-slate-100 mt-0.5 break-all">
                    {selectedNodeData.label}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                    {selectedNodeData.type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-400">Risk Score</p>
                    <p className="text-lg font-black text-rose-400 font-mono">
                      {selectedNodeData.score.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-400">Confidence Band</p>
                    <p className="text-sm font-bold text-slate-200 font-mono mt-0.5">
                      {selectedNodeData.confidence_band}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <p className="text-slate-400 font-semibold text-[11px]">Cluster & Topology Degree</p>
                  <p className="text-slate-300 font-mono">{selectedNodeData.cluster}</p>
                  <p className="text-slate-400 text-[10px]">
                    In-degree: {selectedNodeData.in_degree} | Out-degree: {selectedNodeData.out_degree}
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <p className="text-slate-400 font-semibold text-[11px]">Source Evidence Metadata</p>
                  <pre className="bg-slate-950 p-2.5 rounded text-[10px] text-slate-300 overflow-x-auto font-mono max-h-48 border border-slate-800">
                    {JSON.stringify(selectedNodeData.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* If Edge Selected */}
            {selectedEdgeData && (
              <div className="space-y-3.5">
                <div>
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">Correlated Link Type</p>
                  <p className="font-mono text-sm font-bold text-slate-100 mt-0.5">
                    {selectedEdgeData.type}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Confidence: {(selectedEdgeData.confidence * 100).toFixed(1)}% ({selectedEdgeData.confidence_band} Band)
                  </span>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <p className="text-slate-400 font-semibold text-[11px]">Decomposed Factor Breakdown</p>
                  <div className="bg-slate-950 p-3 rounded-lg space-y-1.5 font-mono text-[11px] border border-slate-800">
                    <p className="text-cyan-400 font-semibold">
                      Rule: {selectedEdgeData.reasoning.rule || 'DETERMINISTIC_BINDING'}
                    </p>
                    {selectedEdgeData.reasoning.details && (
                      <p className="text-slate-300 leading-normal">{selectedEdgeData.reasoning.details}</p>
                    )}
                    {selectedEdgeData.reasoning.factors && (
                      <div className="mt-2 space-y-1 pt-2 border-t border-slate-800">
                        <p className="text-slate-500 text-[10px] uppercase">Named Factor Weights:</p>
                        {Object.entries(selectedEdgeData.reasoning.factors).map(([f, w]) => (
                          <div key={f} className="flex justify-between text-slate-400 text-[10px]">
                            <span>{f}</span>
                            <span className="text-cyan-400 font-bold">+{String(w)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <p className="text-slate-400 font-semibold text-[11px]">Source Evidence Reference</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Linked Evidence Artifact IDs:</p>
                  <ul className="list-disc pl-4 text-slate-300 font-mono text-[10px] space-y-0.5 mt-1">
                    {selectedEdgeData.evidence_ids.map((id) => (
                      <li key={id} className="text-cyan-300">{id}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Sec 65B Electronic Record // Immutable Hash Protected
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
