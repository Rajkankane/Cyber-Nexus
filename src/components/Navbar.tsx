import React, { useState, useRef, useEffect } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, FolderGit2, PlusCircle,
  UserCheck, Search, Command, X, ArrowRight
} from 'lucide-react';
import type { Case, Entity } from '../types';

interface NavbarProps {
  cases: Case[];
  activeCaseId: string | null;
  activeCase: Case | null;
  onSelectCase: (caseId: string) => void;
  onOpenNewCaseModal: () => void;
  onOpenCommandPalette: () => void;
  isChainValid: boolean;
  entities: Entity[];
  onSelectEntity: (entity: Entity) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  cases,
  activeCaseId,
  activeCase,
  onSelectCase,
  onOpenNewCaseModal,
  onOpenCommandPalette,
  isChainValid,
  entities,
  onSelectEntity
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter entities based on global search input
  const filteredEntities = searchQuery.trim()
    ? entities.filter((e) =>
        e.normalized_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.raw_value && e.raw_value.toLowerCase().includes(searchQuery.toLowerCase())) ||
        e.entity_type.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#0b0e17] border-b border-slate-800/90 text-slate-100 sticky top-0 z-40 select-none shadow-md">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand Identity (NO v2.1 FORENSIC badge) */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/40 rounded-lg text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-base tracking-widest bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                CYBER-NEXUS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">
              Evidence-First Forensic Command Center
            </p>
          </div>
        </div>

        {/* Center: Case Selector & Global Quick Search */}
        <div className="flex items-center space-x-3 flex-1 max-w-2xl">
          {/* Active Case Selector */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/70 rounded-lg px-2.5 py-1.5 shrink-0 shadow-inner">
            <FolderGit2 className="w-4 h-4 text-cyan-400 mr-2 shrink-0" />
            <select
              value={activeCaseId || ''}
              onChange={(e) => onSelectCase(e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id} className="bg-slate-900 text-slate-200">
                  {c.title} (INR {Number(c.amount_inr || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
            {activeCase && (
              <span className={`ml-2 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                activeCase.status === 'ACTIVE' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                activeCase.status === 'UNDER_REVIEW' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                'bg-slate-700/40 text-slate-300 border-slate-600'
              }`}>
                {activeCase.status}
              </span>
            )}
          </div>

          {/* Global Search Bar */}
          <div ref={searchRef} className="relative flex-1">
            <div className="flex items-center bg-slate-900/90 border border-slate-700/70 rounded-lg px-3 py-1.5 focus-within:border-cyan-500/70 transition shadow-inner">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search across phone, IMEI, UPI, account, hash..."
                className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full font-mono"
              />
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={onOpenCommandPalette}
                  className="flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 ml-1.5"
                  title="Command Palette (Ctrl+K)"
                >
                  <Command className="w-2.5 h-2.5" />
                  <span>K</span>
                </button>
              )}
            </div>

            {/* Quick Search Dropdown Results */}
            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0f1422] border border-slate-700 rounded-lg shadow-2xl p-2 z-50 space-y-1 font-mono">
                <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                  Matching Correlated Entities ({filteredEntities.length})
                </div>
                {filteredEntities.length > 0 ? (
                  filteredEntities.map((ent) => (
                    <div
                      key={ent.entity_id}
                      onClick={() => {
                        onSelectEntity(ent);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="p-2 hover:bg-slate-800/80 rounded cursor-pointer transition flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                          {ent.entity_type}
                        </span>
                        <span className="text-slate-200 font-semibold">{ent.normalized_key}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="text-rose-400 font-bold">{ent.latest_score?.toFixed(0)} pts</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-400 text-center font-sans">
                    No matching entity or evidence hash found for "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New Case Button */}
          <button
            onClick={onOpenNewCaseModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Case</span>
          </button>
        </div>

        {/* Right: Section 65B Integrity Status & Officer Identity */}
        <div className="flex items-center space-x-4 shrink-0">
          {/* Cryptographic Chain Integrity Badge */}
          <div className="flex items-center space-x-2 border-r border-slate-800 pr-4">
            {isChainValid ? (
              <div className="flex items-center space-x-1.5 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-mono font-medium tracking-tight">SEC 65B: INTACT</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-[11px] px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.25)] animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="font-mono font-bold tracking-tight">TAMPER DETECTED</span>
              </div>
            )}
          </div>

          {/* Officer & Role Chip */}
          <div className="flex items-center space-x-2.5 text-xs text-slate-300">
            <div className="p-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <p className="font-semibold text-slate-100 text-xs">Insp. Raj Kankane</p>
                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  INVESTIGATOR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">POL-CY-4092</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
