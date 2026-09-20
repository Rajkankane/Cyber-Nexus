import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Briefcase, Shield, Users, Network, Clock,
  AlertTriangle, FileText, Lock, PlusCircle, CornerDownLeft
} from 'lucide-react';
import type { Case, Entity } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  cases: Case[];
  activeCaseId?: string | null;
  onSelectCase: (caseId: string) => void;
  onSelectTab: (tab: string) => void;
  onOpenNewCaseModal: () => void;
  onOpenReportModal: () => void;
  entities: Entity[];
  onSelectEntity: (entity: Entity) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  cases,
  onSelectCase,
  onSelectTab,
  onOpenNewCaseModal,
  onOpenReportModal,
  entities,
  onSelectEntity
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Global shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open triggered by parent
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Define static actions and views
  const staticItems = [
    { id: 'tab-dashboard', type: 'VIEW', title: 'Open Cases & Golden Hour SLA Console', tab: 'dashboard', icon: Briefcase },
    { id: 'tab-vault', type: 'VIEW', title: 'Open Evidence Vault & Ingestion', tab: 'vault', icon: Shield },
    { id: 'tab-entities', type: 'VIEW', title: 'Open Extracted Entities & Correlations', tab: 'entities', icon: Users },
    { id: 'tab-graph', type: 'VIEW', title: 'Open Entity & Money Flow Graph', tab: 'graph', icon: Network },
    { id: 'tab-timeline', type: 'VIEW', title: 'Open Multi-Source Chronological Timeline', tab: 'timeline', icon: Clock },
    { id: 'tab-risk', type: 'VIEW', title: 'Open Risk Priority Queue & Explainability', tab: 'risk', icon: AlertTriangle },
    { id: 'tab-reports', type: 'VIEW', title: 'Open Court Brief Generator & Preview', tab: 'reports', icon: FileText },
    { id: 'tab-audit', type: 'VIEW', title: 'Open Section 65B Audit Chain Inspector', tab: 'audit', icon: Lock },
    { id: 'action-new-case', type: 'ACTION', title: 'Create New Cyber Investigation Case', action: onOpenNewCaseModal, icon: PlusCircle },
    { id: 'action-report', type: 'ACTION', title: 'Generate Section 65B Certified Legal Brief', action: onOpenReportModal, icon: FileText }
  ];

  // Cases items
  const caseItems = cases.map((c) => ({
    id: `case-${c.case_id}`,
    type: 'CASE',
    title: `Switch Case: ${c.title} (INR ${Number(c.amount_inr || 0).toLocaleString('en-IN')})`,
    caseId: c.case_id,
    icon: Briefcase
  }));

  // Entity items
  const entityItems = entities.slice(0, 15).map((e) => ({
    id: `entity-${e.entity_id}`,
    type: 'ENTITY',
    title: `Inspect ${e.entity_type}: ${e.normalized_key} (Score: ${e.latest_score?.toFixed(0)} pts)`,
    entity: e,
    icon: Users
  }));

  const allItems = [...staticItems, ...caseItems, ...entityItems];

  const filteredItems = query.trim()
    ? allItems.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        handleExecute(selected);
      }
    }
  };

  const handleExecute = (item: any) => {
    if (item.type === 'VIEW' && item.tab) {
      onSelectTab(item.tab);
    } else if (item.type === 'ACTION' && item.action) {
      item.action();
    } else if (item.type === 'CASE' && item.caseId) {
      onSelectCase(item.caseId);
    } else if (item.type === 'ENTITY' && item.entity) {
      onSelectEntity(item.entity);
      onSelectTab('graph');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f1422] border border-slate-700/80 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden font-sans border-t-cyan-500/50">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/60">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInInput}
            placeholder="Type a command, case name, phone, IMEI, or entity to jump..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />
          <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono shrink-0">
            ESC to close
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleExecute(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition text-xs ${
                    isSelected
                      ? 'bg-cyan-600 text-white font-semibold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-cyan-400'}`} />
                    <span className="truncate font-mono">{item.title}</span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border ${
                        isSelected
                          ? 'bg-cyan-700/80 border-cyan-400/40 text-cyan-100'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {item.type}
                    </span>
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white/80" />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-slate-500 font-mono text-xs">
              No matching commands or entities found for "{query}".
            </div>
          )}
        </div>

        {/* Palette Footer Help */}
        <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center space-x-3">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
          </div>
          <span>CYBER-NEXUS Command Palette</span>
        </div>
      </div>
    </div>
  );
};
