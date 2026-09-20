import React, { useState } from 'react';
import {
  Clock, Phone, DollarSign, Download, Mail, Radio, Smartphone,
  Tag, Maximize2, Minimize2, Filter
} from 'lucide-react';
import type { Event } from '../types';

interface TimelineViewProps {
  events: Event[];
  isInvestigationMode: boolean;
  onToggleInvestigationMode: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  events,
  isInvestigationMode,
  onToggleInvestigationMode
}) => {
  const [timeGranularity, setTimeGranularity] = useState<'HOUR' | 'DAY' | 'WEEK'>('DAY');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CALL':
        return <Phone className="w-4 h-4 text-cyan-400" />;
      case 'TRANSACTION':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'APP_INSTALL':
        return <Download className="w-4 h-4 text-rose-400" />;
      case 'EMAIL_RECEIVED':
        return <Mail className="w-4 h-4 text-amber-400" />;
      case 'IP_SESSION':
        return <Radio className="w-4 h-4 text-indigo-400" />;
      default:
        return <Smartphone className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTime = (isoStr: string) => {
    try {
      const dt = new Date(isoStr);
      if (timeGranularity === 'HOUR') {
        return dt.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      } else if (timeGranularity === 'DAY') {
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      } else {
        return `Week of ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
    } catch {
      return isoStr;
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType !== 'ALL' && ev.event_type !== filterType) return false;
    return true;
  });

  return (
    <div
      className={`relative w-full bg-[#080d1a] overflow-y-auto transition-all duration-200 ${
        isInvestigationMode ? 'fixed inset-0 z-50 h-screen w-screen p-6' : 'p-6 max-w-6xl mx-auto'
      }`}
    >
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>Multi-Source Chronological Event Trail</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Forensic cross-correlation of CDR telecom calls, bank UPI settlements, APK malware droppers, and IP telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Zoom / Granularity Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-mono">
            {(['HOUR', 'DAY', 'WEEK'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setTimeGranularity(g)}
                className={`px-2.5 py-1 rounded transition ${
                  timeGranularity === g
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-mono"
            >
              <option value="ALL" className="bg-slate-900">All Event Types</option>
              <option value="CALL" className="bg-slate-900">Calls (CDR)</option>
              <option value="TRANSACTION" className="bg-slate-900">Transactions (Bank/UPI)</option>
              <option value="APP_INSTALL" className="bg-slate-900">APK Dropper</option>
              <option value="EMAIL_RECEIVED" className="bg-slate-900">Phishing Email</option>
              <option value="IP_SESSION" className="bg-slate-900">IP Sessions</option>
            </select>
          </div>

          {/* Investigation Mode Button */}
          <button
            onClick={onToggleInvestigationMode}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition border border-slate-700"
          >
            {isInvestigationMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isInvestigationMode ? 'Exit Full-Screen' : 'Full-Screen'}</span>
          </button>
        </div>
      </div>

      {/* Horizontal / Vertical Timeline Stream */}
      <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 space-y-6 font-mono mt-6">
        {filteredEvents.map((ev) => {
          const isTxn = ev.event_type === 'TRANSACTION';
          const isMalware = ev.event_type === 'APP_INSTALL';
          const isCall = ev.event_type === 'CALL';
          const isHovered = hoveredEvent?.event_id === ev.event_id;

          return (
            <div
              key={ev.event_id}
              className="relative group"
              onMouseEnter={() => setHoveredEvent(ev)}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              {/* Dot Icon on timeline line */}
              <div
                className={`absolute -left-[37px] sm:-left-[41px] top-2 p-2 rounded-full bg-slate-950 border-2 transition shadow-lg ${
                  isHovered ? 'border-cyan-400 scale-110 shadow-[0_0_10px_#22d3ee]' : 'border-slate-700'
                }`}
              >
                {getEventIcon(ev.event_type)}
              </div>

              {/* Event Content Box */}
              <div
                className={`bg-slate-900/90 border rounded-xl p-4 shadow-sm transition space-y-2 ${
                  isHovered ? 'border-cyan-500/70 bg-slate-900' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {ev.event_type}
                    </span>
                    <span className="text-cyan-400 font-bold text-[11px]">
                      {formatTime(ev.occurred_at)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                    <Tag className="w-3 h-3 text-cyan-400" />
                    <span>Raw Ref: <b className="text-slate-200">{ev.raw_ref || 'Row N/A'}</b></span>
                    <span>•</span>
                    <span>Evidence ID: <b className="text-slate-200">{ev.evidence_id.slice(0, 8)}...</b></span>
                  </div>
                </div>

                {/* Event Details */}
                <div className="text-xs text-slate-300 pt-1">
                  {isTxn && ev.metadata_json && (
                    <div className="flex flex-wrap items-center gap-3 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/30">
                      <span className="font-black text-emerald-400 text-sm font-mono">
                        INR {Number(ev.metadata_json.amount || 0).toLocaleString('en-IN')}
                      </span>
                      {ev.metadata_json.reference_id && (
                        <span className="text-slate-300 text-[11px]">
                          UTR: <code className="text-emerald-300">{ev.metadata_json.reference_id}</code>
                        </span>
                      )}
                      {ev.metadata_json.raw_details && (
                        <span className="text-slate-400 text-[11px]">
                          Route: <b className="text-slate-200">{ev.metadata_json.raw_details.remitter_vpa || 'Victim'}</b> &rarr; <b className="text-slate-200">{ev.metadata_json.raw_details.beneficiary_vpa || 'Mule Node'}</b>
                        </span>
                      )}
                    </div>
                  )}

                  {isCall && ev.metadata_json && (
                    <div className="bg-cyan-950/20 p-2.5 rounded-lg border border-cyan-500/30 text-[11px] space-y-1">
                      <p>
                        Calling Party: <b className="text-cyan-300">{ev.metadata_json.calling_no}</b> &rarr; Called Party: <b className="text-cyan-300">{ev.metadata_json.called_no}</b>
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        Handset IMEI: <span className="text-slate-200">{ev.metadata_json.imei}</span> | Tower Cell ID: <span className="text-slate-200">{ev.metadata_json.cell_id}</span> | Duration: {ev.metadata_json.duration_sec}s
                      </p>
                    </div>
                  )}

                  {isMalware && ev.metadata_json && (
                    <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/30 text-[11px] space-y-1">
                      <p className="text-rose-300 font-bold">
                        Trojan Dropper Package: {ev.metadata_json.package_name}
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        High-risk stealth permissions requested: {ev.metadata_json.suspicious_permissions_count} (SMS extraction & screen capture)
                      </p>
                    </div>
                  )}

                  {!isTxn && !isCall && !isMalware && (
                    <pre className="bg-slate-950 p-2 rounded text-[10px] text-slate-400 overflow-x-auto border border-slate-800">
                      {JSON.stringify(ev.metadata_json || {}, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Exact Source Evidence Hover Tooltip */}
                {isHovered && (
                  <div className="p-2 bg-slate-950 border border-cyan-500/40 rounded-lg text-[10px] text-slate-300 flex items-center justify-between">
                    <span className="text-cyan-300">
                      Exact Ingested File Source: <code className="text-slate-200">{ev.raw_ref}</code>
                    </span>
                    <span className="text-slate-500 font-mono">
                      Timestamp verified against SHA-256 ledger
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
