/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { PermissionButton } from './common/PermissionGuard';
import { safeLocalStorage } from '../utils/safeStorage';

const localStorage = safeLocalStorage;
import {
  Truck,
  Search,
  Plus,
  Trash2,
  X,
  Check,
  Building,
  Mail,
  Phone,
} from 'lucide-react';
import { formatINR } from '../utils/currency';

export const SuppliersView: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useAppState();

  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem('sf_global_search_term');
    if (saved) {
      localStorage.removeItem('sf_global_search_term');
      return saved;
    }
    return '';
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name?: string }>({ isOpen: false, id: null });

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      try {
        deleteSupplier(deleteConfirm.id);
        showToast('Record deleted successfully.', 'success');
      } catch (err) {
        showToast('Failed to delete record.', 'error');
      }
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  // Paydown State
  const [payOpen, setPayOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const filteredSuppliers = suppliers.filter((s) => {
    return (
      (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (s.company || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  });

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setCompany('');
    setEmail('');
    setOutstandingBalance(0);
    setFormOpen(true);
  };

  const openEditModal = (s: any) => {
    setEditingId(s.id);
    setName(s.name);
    setPhone(s.phone);
    setCompany(s.company);
    setEmail(s.email || '');
    setOutstandingBalance(s.outstandingBalance);
    setFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !company || !phone) {
      alert('Please fill in mandatory fields.');
      return;
    }

    const payload = {
      name,
      phone,
      company,
      email: email || undefined,
      outstandingBalance: Number(outstandingBalance),
    };

    if (editingId) {
      updateSupplier(editingId, payload);
    } else {
      addSupplier(payload);
    }
    setFormOpen(false);
  };

  const handlePayBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || payAmount <= 0) return;

    const supp = suppliers.find((s) => s.id === selectedSupplierId);
    if (supp) {
      const nextBal = Math.max(0, supp.outstandingBalance - payAmount);
      updateSupplier(selectedSupplierId, { outstandingBalance: nextBal });
      setPayOpen(false);
      setPayAmount(0);
    }
  };

  return (
    <div className="space-y-6" id="suppliers-view-container">
      {/* Toast alert */}
      {toast && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-xs border fixed top-6 right-6 z-[9999] shadow-2xl animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100">Fabric Suppliers & Mills</h1>
          <p className="text-xs text-slate-400">Manage apparel suppliers, wool merchant accounts, and outstanding raw fabric debts.</p>
        </div>
        <PermissionButton
          id="add-new-supplier"
          module="suppliers"
          action="add"
          onClick={openAddModal}
          className="flex items-center gap-2 gold-gradient text-slate-950 font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Add Supplier
        </PermissionButton>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="supplier-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search suppliers by name or apparel company..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="suppliers-list-grid">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
            <Truck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            No showroom supplier mills registered yet. Click "Add Supplier" to record.
          </div>
        ) : (
          filteredSuppliers.map((s) => (
            <div
              key={s.id}
              className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between hover:border-amber-500/20 transition relative group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-amber-500/60" /> {s.company}
                    </h3>
                    <p className="text-[10px] text-amber-500/70 italic mt-0.5 font-serif">Contact Representative: {s.name}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[10px] text-slate-400 bg-slate-950/40 p-2.5 rounded border border-slate-850">
                  <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-600" /> {s.phone}</p>
                  {s.email && (
                    <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-600 animate-pulse" /> {s.email}</p>
                  )}
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Outstanding Debt Balance:</span>
                    <h4 className={`text-base font-mono font-bold mt-0.5 ${s.outstandingBalance > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {formatINR(s.outstandingBalance, { keepDecimals: true })}
                    </h4>
                  </div>

                  {s.outstandingBalance > 0 && (
                    <button
                      id={`btn-pay-${s.id}`}
                      onClick={() => {
                        setSelectedSupplierId(s.id);
                        setPayAmount(s.outstandingBalance);
                        setPayOpen(true);
                      }}
                      className="text-[9px] bg-amber-500 text-slate-950 font-bold px-2.5 py-1.5 rounded uppercase tracking-wider transition hover:opacity-90 active:scale-95"
                    >
                      Pay Down
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-850 mt-4">
                <PermissionButton
                  id={`btn-supp-edit-${s.id}`}
                  module="suppliers"
                  action="edit"
                  onClick={() => openEditModal(s)}
                  className="text-[10px] font-bold text-amber-500 hover:text-amber-400 transition cursor-pointer"
                >
                  Edit Profile
                </PermissionButton>
                <PermissionButton
                  id={`btn-supp-del-${s.id}`}
                  module="suppliers"
                  action="delete"
                  onClick={() => setDeleteConfirm({ isOpen: true, id: s.id, name: s.company })}
                  className="text-[10px] font-bold text-red-400/80 hover:text-red-400 transition cursor-pointer"
                >
                  Delete
                </PermissionButton>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Supplier Profile Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  {editingId ? 'Refine Mill Profile' : 'Register Wholesale Fabric Supplier'}
                </h3>
                <p className="text-[10px] text-slate-400">Complete raw fabric supplier directory information.</p>
              </div>
              <button
                id="close-supplier-modal"
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Wholesale Company / Mill Name *</label>
                <input
                  id="form-supp-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g., Vittorio Sartorial Fabrics"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Representative Name *</label>
                <input
                  id="form-supp-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Marco Vittorio"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Mobile Phone *</label>
                  <input
                    id="form-supp-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="202-555-0144"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Contact Email</label>
                  <input
                    id="form-supp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="orders@vittoriomills.it"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Initial Outstanding Balance (₹)</label>
                <input
                  id="form-supp-bal"
                  type="number"
                  value={outstandingBalance || ''}
                  onChange={(e) => setOutstandingBalance(Number(e.target.value))}
                  placeholder="1200"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none"
                  min="0"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  id="submit-supplier-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-widest"
                >
                  {editingId ? 'Refine Mill' : 'Register Mill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay balance paydown modal */}
      {payOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Pay Down Outstanding</h3>
                <p className="text-[10px] text-slate-400">Record payments made to wholesale accounts.</p>
              </div>
              <button
                id="close-pay-modal"
                onClick={() => setPayOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePayBalance} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Payment Amount (₹) *</label>
                <input
                  id="pay-amount-input"
                  type="number"
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  placeholder="500"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 font-mono text-slate-200 text-lg text-center font-bold focus:outline-none"
                  min="1"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayOpen(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  id="submit-pay-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-widest"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl" id="delete-confirm-dialog">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-serif text-lg font-bold text-slate-100">Delete Record</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This action cannot be undone.
                  <br />
                  Are you sure you want to permanently delete this record{deleteConfirm.name ? ` "${deleteConfirm.name}"` : ''}?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                id="btn-delete-cancel"
                onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-delete-confirm"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/10 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
