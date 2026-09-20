import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { api } from '../api/client';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (newCaseId: string) => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated
}) => {
  const [title, setTitle] = useState('');
  const [incidentType, setIncidentType] = useState('INVESTMENT_FRAUD');
  const [amount, setAmount] = useState('500000');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setCreating(true);
      const created = await api.createCase(title.trim(), incidentType, parseFloat(amount) || 0);
      onCaseCreated(created.case_id);
      onClose();
    } catch (err) {
      console.error('Failed to create case', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <FolderPlus className="w-5 h-5" />
            <span>Open New Investigation Case</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1">Case Title / Incident Tag</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operation Cyber Shield - Job Scam"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Incident Classification</label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="INVESTMENT_FRAUD">INVESTMENT_FRAUD / PART-TIME TASK</option>
              <option value="LOAN_APP_EXTORTION">LOAN_APP_EXTORTION / HARASSMENT</option>
              <option value="PHISHING_CREDENTIAL_HARVEST">PHISHING_CREDENTIAL_HARVEST</option>
              <option value="DIGITAL_ARREST">DIGITAL_ARREST / FEDEX SPOOF</option>
              <option value="SIM_SWAP_FRAUD">SIM_SWAP_FRAUD</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Defrauded Amount (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold transition disabled:opacity-50"
            >
              {creating ? 'Registering...' : 'Register Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
