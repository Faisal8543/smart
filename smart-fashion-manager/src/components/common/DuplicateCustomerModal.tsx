/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, User, Phone, ArrowRight, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Customer } from '../../types';
import { formatMemberName } from '../../utils/nameFormatter';

interface DuplicateCustomerModalProps {
  isOpen: boolean;
  existingCustomer: Customer | { name: string; phone: string; notes?: string; id?: string } | null;
  onOpenExisting: (customer: any) => void;
  onCancel: () => void;
  title?: string;
  moduleContext?: string;
}

export const DuplicateCustomerModal: React.FC<DuplicateCustomerModalProps> = ({
  isOpen,
  existingCustomer,
  onOpenExisting,
  onCancel,
  title = "Duplicate Mobile Number Detected",
  moduleContext
}) => {
  if (!isOpen || !existingCustomer) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      <div 
        id="duplicate-customer-modal"
        className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs select-none relative overflow-hidden"
      >
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 gold-gradient" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-100">{title}</h3>
              <p className="text-[10px] text-slate-400 font-medium">Unique Mobile Number Constraint Violation</p>
            </div>
          </div>
          <button
            id="btn-close-duplicate-modal"
            onClick={onCancel}
            className="w-7 h-7 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Alert Message Box */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 text-amber-200/90 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p id="duplicate-warning-message" className="font-bold text-amber-300">
              Customer already exists with this mobile number.
            </p>
            <p className="text-[10px] text-amber-200/70 mt-0.5">
              One mobile number can belong to only ONE customer in Smart Fashion Manager. Duplicate records are restricted.
            </p>
          </div>
        </div>

        {/* Existing Customer Profile Summary Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 mb-5">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3 text-amber-400" /> Existing Profile Record
            </span>
            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Registered Client
            </span>
          </div>

          <div className="space-y-1.5">
            <div>
              <label className="text-[9px] text-slate-500 uppercase font-semibold">Patron Name</label>
              <h4 id="existing-cust-name-display" className="font-bold text-slate-100 text-sm">
                {formatMemberName(existingCustomer.name || 'Valued Patron')}
              </h4>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <label className="text-[9px] text-slate-500 uppercase font-semibold block">Mobile Number</label>
                <span id="existing-cust-phone-display" className="font-mono text-amber-300 font-extrabold flex items-center gap-1">
                  <Phone className="w-3 h-3 text-amber-500 inline" />
                  {existingCustomer.phone}
                </span>
              </div>
              {moduleContext && (
                <div className="text-right">
                  <label className="text-[9px] text-slate-500 uppercase font-semibold block">Source</label>
                  <span className="text-[10px] text-slate-400 font-medium">{moduleContext}</span>
                </div>
              )}
            </div>

            {existingCustomer.notes && (
              <div className="pt-2 text-[10px] text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-850">
                "{existingCustomer.notes}"
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            id="btn-cancel-duplicate"
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition border border-slate-700 cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            id="btn-open-existing-customer"
            type="button"
            onClick={() => onOpenExisting(existingCustomer)}
            className="w-full sm:w-auto gold-gradient text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-lg shadow-amber-950/30 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Existing Customer</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
