import React, { useState } from 'react';
import {
  Briefcase, Shield, Users, Network, Clock, AlertTriangle,
  FileText, Lock, ChevronLeft, ChevronRight, Command
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  evidenceCount: number;
  entitiesCount: number;
  evidenceGapsCount: number;
  onOpenCommandPalette: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  evidenceCount,
  entitiesCount,
  evidenceGapsCount,
  onOpenCommandPalette
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Cases',
      sublabel: 'Golden Hour & SLA',
      icon: Briefcase,
      badge: null
    },
    {
      id: 'vault',
      label: 'Evidence',
      sublabel: 'Vault & SHA-256 Seal',
      icon: Shield,
      badge: evidenceCount > 0 ? `${evidenceCount}` : null,
      badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-800'
    },
    {
      id: 'entities',
      label: 'Entities',
      sublabel: 'Correlations & Canaries',
      icon: Users,
      badge: entitiesCount > 0 ? `${entitiesCount}` : null,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    },
    {
      id: 'graph',
      label: 'Graph',
      sublabel: 'Entity & Money Network',
      icon: Network,
      badge: null
    },
    {
      id: 'timeline',
      label: 'Timeline',
      sublabel: 'Multi-Source Chronology',
      icon: Clock,
      badge: null
    },
    {
      id: 'risk',
      label: 'Risk',
      sublabel: 'Priority Queue & Gaps',
      icon: AlertTriangle,
      badge: evidenceGapsCount > 0 ? `${evidenceGapsCount} GAPS` : null,
      badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800'
    },
    {
      id: 'reports',
      label: 'Reports',
      sublabel: 'Sec 65B Dossier & Export',
      icon: FileText,
      badge: null
    },
    {
      id: 'audit',
      label: 'Audit Log',
      sublabel: 'Cryptographic Chain',
      icon: Lock,
      badge: 'SEC 65B',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800'
    }
  ];

  return (
    <aside
      className={`bg-[#0b0e17] border-r border-slate-800/90 text-slate-300 flex flex-col justify-between shrink-0 transition-all duration-200 select-none z-30 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Navigation Links */}
      <div className="py-3 flex flex-col space-y-1">
        {!isCollapsed && (
          <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            Investigation Modules
          </div>
        )}

        <nav className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? `${item.label} (${item.sublabel})` : undefined}
                className={`w-full flex items-center rounded-lg px-2.5 py-2.5 text-xs font-medium transition-all group relative ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {/* Active Indicator Strip */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                )}

                <Icon
                  className={`w-4 h-4 shrink-0 transition ${
                    isActive ? 'text-cyan-400 scale-110' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!isCollapsed && (
                  <div className="ml-3 text-left flex-1 min-w-0 flex items-center justify-between">
                    <div>
                      <p className="truncate text-xs">{item.label}</p>
                      <p className="truncate text-[10px] text-slate-500 font-mono leading-none mt-0.5">
                        {item.sublabel}
                      </p>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ml-1.5 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions: Collapse Button & Command Palette Shortcut */}
      <div className="p-2 border-t border-slate-800/80 space-y-1 bg-slate-950/40">
        <button
          onClick={onOpenCommandPalette}
          className={`w-full flex items-center rounded-lg px-2.5 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
          title="Command Palette (Ctrl+K)"
        >
          <div className="flex items-center space-x-2">
            <Command className="w-3.5 h-3.5 text-cyan-400" />
            {!isCollapsed && <span>Quick Palette</span>}
          </div>
          {!isCollapsed && (
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">
              Ctrl+K
            </kbd>
          )}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
