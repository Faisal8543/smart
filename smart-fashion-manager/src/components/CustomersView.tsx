/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import { useDebounce } from '../hooks/useDebounce';
import { safeLocalStorage } from '../utils/safeStorage';
import { PermissionButton } from './common/PermissionGuard';
import { DuplicateCustomerModal } from './common/DuplicateCustomerModal';

const localStorage = safeLocalStorage;
import {
  Users,
  Search,
  Plus,
  Trash2,
  History,
  FileSpreadsheet,
  X,
  Check,
  Calendar,
  Trophy,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Edit2,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { Customer } from '../types';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { calculateCreditSummary } from '../utils/creditUtils';
import { TopCustomersModal } from './TopCustomersModal';
import { AnniversaryCampaignModal } from './AnniversaryCampaignModal';

export const CustomersView: React.FC = () => {
  const { customers, addCustomer, findCustomerByPhone, updateCustomer, deleteCustomer, invoices } = useAppState();

  const [topCustomersOpen, setTopCustomersOpen] = useState(false);
  const [anniversaryCampaignOpen, setAnniversaryCampaignOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem('sf_global_search_term');
    if (saved) {
      localStorage.removeItem('sf_global_search_term');
      return saved;
    }
    return '';
  });
  const debouncedSearchTerm = useDebounce(searchTerm, 250);

  // Precomputed customer invoice spend map (O(N) single pass)
  const customerSpendMap = useMemo(() => {
    const map = new Map<string, { totalSpend: number; count: number }>();
    invoices.forEach((inv) => {
      if (inv.customerPhone) {
        const existing = map.get(inv.customerPhone) || { totalSpend: 0, count: 0 };
        existing.totalSpend += inv.grandTotal;
        existing.count += 1;
        map.set(inv.customerPhone, existing);
      }
    });
    return map;
  }, [invoices]);

  // Modal & Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Duplicate Modal State
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    existingCustomer: Customer | null;
  }>({
    isOpen: false,
    existingCustomer: null,
  });

  // Import Modal & Report States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importReport, setImportReport] = useState<{
    imported: { name: string; phone: string; notes?: string }[];
    skipped: { name: string; phone: string; reason: string }[];
    failed: { name: string; phone: string; reason: string }[];
  } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name?: string }>({ isOpen: false, id: null });

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      try {
        deleteCustomer(deleteConfirm.id);
        showToast('Record deleted successfully.', 'success');
      } catch (err) {
        showToast('Failed to delete record.', 'error');
      }
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  // Selected customer for history drawer
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyTab, setHistoryTab] = useState<'all' | 'credit'>('all');

  const filteredCustomers = useMemo(() => {
    const term = (debouncedSearchTerm || '').toLowerCase().trim();
    if (!term) return customers;
    return customers.filter((c) => {
      return (
        (c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').includes(term)
      );
    });
  }, [customers, debouncedSearchTerm]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setNotes('');
    setFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setNotes(cust.notes || '');
    setFormOpen(true);
  };

  // Handle Save / Submit
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!name.trim() || cleanPhone.length < 7) {
      showToast('Please enter a valid patron name and mobile number (min 7 digits).', 'error');
      return;
    }

    // Check duplicate mobile number
    const existing = findCustomerByPhone(cleanPhone, editingCustomer ? editingCustomer.id : undefined);
    if (existing) {
      setDuplicateModal({
        isOpen: true,
        existingCustomer: existing,
      });
      return;
    }

    try {
      if (editingCustomer) {
        updateCustomer(editingCustomer.id, {
          name: name.trim(),
          phone: cleanPhone,
          notes: notes.trim(),
        });
        showToast('Patron profile updated successfully.', 'success');
      } else {
        addCustomer(name.trim(), cleanPhone, notes.trim());
        showToast('New patron profile established successfully.', 'success');
      }
      setFormOpen(false);
      setName('');
      setPhone('');
      setNotes('');
      setEditingCustomer(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save customer.', 'error');
    }
  };

  // Open Existing Customer Profile from Duplicate Modal
  const handleOpenExistingFromDuplicate = (existingCust: Customer) => {
    setDuplicateModal({ isOpen: false, existingCustomer: null });
    setFormOpen(false);
    setHistoryCustomer(existingCust);
  };

  // Process Customer Import
  const handleProcessImport = () => {
    if (!importText.trim()) {
      showToast('Please paste CSV or text data to import.', 'error');
      return;
    }

    const lines = importText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const imported: { name: string; phone: string; notes?: string }[] = [];
    const skipped: { name: string; phone: string; reason: string }[] = [];
    const failed: { name: string; phone: string; reason: string }[] = [];

    // Track phones already encountered during this import batch
    const processedPhonesInBatch = new Set<string>();

    lines.forEach((line, index) => {
      // Ignore CSV header if present
      if (index === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('mobile') || line.toLowerCase().includes('phone'))) {
        return;
      }

      const parts = line.split(/,|\t/).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) {
        failed.push({
          name: parts[0] || `Row #${index + 1}`,
          phone: parts[1] || 'N/A',
          reason: 'Invalid row format. Required: Name, Mobile Number'
        });
        return;
      }

      const rowName = parts[0];
      const rawPhone = parts[1];
      const rowNotes = parts[2] || 'Imported via CSV batch';
      const cleanPhone = rawPhone.replace(/\D/g, '');

      if (!rowName || cleanPhone.length < 7) {
        failed.push({
          name: rowName || `Row #${index + 1}`,
          phone: rawPhone || 'N/A',
          reason: 'Name missing or phone number has fewer than 7 digits'
        });
        return;
      }

      // Check if duplicate in current batch
      if (processedPhonesInBatch.has(cleanPhone)) {
        skipped.push({
          name: rowName,
          phone: cleanPhone,
          reason: 'Duplicate mobile number in import file'
        });
        return;
      }

      // Check if duplicate in existing system database
      const existingInSystem = findCustomerByPhone(cleanPhone);
      if (existingInSystem) {
        skipped.push({
          name: rowName,
          phone: cleanPhone,
          reason: `Duplicate mobile number (belongs to existing customer: ${existingInSystem.name})`
        });
        return;
      }

      // Record valid and add customer
      processedPhonesInBatch.add(cleanPhone);
      addCustomer(rowName, cleanPhone, rowNotes);
      imported.push({
        name: rowName,
        phone: cleanPhone,
        notes: rowNotes
      });
    });

    setImportReport({ imported, skipped, failed });
    setImportText('');
  };

  // Fetch invoices for a specific customer phone
  const getCustomerInvoices = (custPhone: string) => {
    return invoices.filter((inv) => inv.customerPhone === custPhone);
  };

  return (
    <div className="space-y-6" id="customers-view-container">
      {/* Toast alert */}
      {toast && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-xs border fixed top-6 right-6 z-[9999] shadow-2xl animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30' : 'bg-red-950/90 text-red-200 border-red-500/30'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100">Patron Directory</h1>
          <p className="text-xs text-slate-400">View customer purchases, club memberships, and bespoke tailoring fitting notes.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-import-customers"
            onClick={() => setImportModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>Import Customers</span>
          </button>

          <PermissionButton
            id="add-new-customer"
            module="customers"
            action="add"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 gold-gradient text-slate-950 font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Create Patron
          </PermissionButton>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="customer-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name or mobile digits..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-top-customers"
            onClick={() => setTopCustomersOpen(true)}
            className="bg-slate-950 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-500 text-amber-200 font-bold px-3.5 py-2.5 rounded-lg text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>🏆 Top Customers</span>
          </button>

          <button
            id="btn-anniversary-campaign"
            onClick={() => setAnniversaryCampaignOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3.5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg shadow-amber-950/20"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>🎉 Anniversary Campaign</span>
          </button>
        </div>
      </div>

      {/* Customers List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="customers-cards-grid">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            No customer profiles linked yet. Add customers via POS checkout or the button above.
          </div>
        ) : (
          filteredCustomers.map((c) => {
            const stats = customerSpendMap.get(c.phone) || { totalSpend: 0, count: 0 };
            const totalSpend = stats.totalSpend;
            const invCount = stats.count;

            return (
              <div
                key={c.id}
                className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between hover:border-amber-500/20 transition relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />
                
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm">{formatMemberName(c.name)}</h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.phone}</p>
                    </div>
                    <button
                      id={`btn-edit-cust-${c.id}`}
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition cursor-pointer"
                      title="Edit Patron Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {c.notes && (
                    <div className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-lg text-[10px] text-slate-400 italic">
                      {c.notes}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="p-2 bg-slate-950 rounded">
                      <span className="text-slate-500 uppercase font-semibold block">Total Spend:</span>
                      <span className="font-mono font-bold text-amber-200 mt-0.5 block">{formatINR(totalSpend, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded">
                      <span className="text-slate-500 uppercase font-semibold block">Invoices Billed:</span>
                      <span className="font-mono font-bold text-slate-300 mt-0.5 block">{invCount} bills</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-850 mt-4 text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Registered: {new Date(c.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex gap-2">
                    {/* View History log */}
                    <button
                      id={`btn-cust-history-${c.id}`}
                      onClick={() => setHistoryCustomer(c)}
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 transition cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" /> Log
                    </button>

                    {/* Delete profile */}
                    <PermissionButton
                      id={`btn-cust-del-${c.id}`}
                      module="customers"
                      action="delete"
                      onClick={() => setDeleteConfirm({ isOpen: true, id: c.id, name: c.name })}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </PermissionButton>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Customer Profile Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  {editingCustomer ? 'Edit Patron Profile' : 'Establish Patron Profile'}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {editingCustomer ? 'Update client details and mobile contact credentials.' : 'Add a client profile to track purchase histories and club memberships.'}
                </p>
              </div>
              <button
                id="close-customer-modal"
                onClick={() => { setFormOpen(false); setEditingCustomer(null); }}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Patron Full Name *</label>
                <input
                  id="new-cust-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alexander Sterling"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Mobile Phone Number *</label>
                <input
                  id="new-cust-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="5551234567"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none"
                  required
                />
                <p className="text-[9px] text-slate-500">Each patron must have a unique mobile number.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Bespoke Fitting Notes & Styling advice</label>
                <textarea
                  id="new-cust-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred fit, sleeve length, shoulder parameters or designer brands..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none h-24"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setFormOpen(false); setEditingCustomer(null); }}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-customer-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-widest cursor-pointer"
                >
                  {editingCustomer ? 'Update Profile' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Customer Warning Modal */}
      <DuplicateCustomerModal
        isOpen={duplicateModal.isOpen}
        existingCustomer={duplicateModal.existingCustomer}
        onOpenExisting={handleOpenExistingFromDuplicate}
        onCancel={() => setDuplicateModal({ isOpen: false, existingCustomer: null })}
        moduleContext="Patron Directory"
      />

      {/* Import Customers Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-amber-100">Import Patron Profiles</h3>
                  <p className="text-[10px] text-slate-400">Bulk import customers from CSV or spreadsheet data.</p>
                </div>
              </div>
              <button
                id="close-import-modal"
                onClick={() => { setImportModalOpen(false); setImportReport(null); }}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!importReport ? (
              <div className="space-y-4">
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1.5 text-[11px] text-slate-300">
                  <p className="font-bold text-amber-300">CSV Data Format Rules:</p>
                  <p className="font-mono text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-850">
                    Name, Mobile Number, Notes (Optional)<br />
                    John Doe, 9876543210, VIP Client<br />
                    Sarah Jenkins, 9876543211, Prefers Slim Fit
                  </p>
                  <p className="text-[10px] text-amber-200/70">
                    * Duplicate mobile numbers will be skipped automatically and logged in the import report.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Paste CSV Rows Below</label>
                  <textarea
                    id="import-csv-textarea"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="John Doe, 9876543210, VIP Client&#10;Sarah Jenkins, 9876543211, Prefers Slim Fit"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none h-44"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {importText.split(/\r?\n/).filter(Boolean).length} rows detected
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(false)}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-process-import"
                      type="button"
                      onClick={handleProcessImport}
                      className="gold-gradient text-slate-950 px-5 py-2 rounded-lg font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Process Import</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Import Report Modal Screen */
              <div className="space-y-4">
                <div className="text-center pb-2 border-b border-slate-800">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
                  <h4 className="font-serif text-base font-bold text-slate-100">Customer Import Report</h4>
                  <p className="text-[10px] text-slate-400">Batch processing execution results</p>
                </div>

                {/* 3 Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-center">
                    <span className="text-[9px] uppercase font-bold text-emerald-400 block">Imported Records</span>
                    <span className="font-mono text-xl font-extrabold text-emerald-200 mt-1 block">{importReport.imported.length}</span>
                  </div>

                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-center">
                    <span className="text-[9px] uppercase font-bold text-amber-400 block">Skipped Duplicates</span>
                    <span className="font-mono text-xl font-extrabold text-amber-200 mt-1 block">{importReport.skipped.length}</span>
                  </div>

                  <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3 text-center">
                    <span className="text-[9px] uppercase font-bold text-red-400 block">Failed Records</span>
                    <span className="font-mono text-xl font-extrabold text-red-200 mt-1 block">{importReport.failed.length}</span>
                  </div>
                </div>

                {/* Report Lists */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {/* Skipped Duplicate Mobile Numbers */}
                  {importReport.skipped.length > 0 && (
                    <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-3 space-y-1.5">
                      <h5 className="font-bold text-amber-300 text-[10px] uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Skipped Duplicate Mobile Numbers ({importReport.skipped.length})
                      </h5>
                      <div className="space-y-1">
                        {importReport.skipped.map((s, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-900 p-1.5 rounded border border-slate-850">
                            <span className="font-semibold text-slate-200">{s.name} ({s.phone})</span>
                            <span className="text-amber-400/80 italic">{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Imported Records */}
                  {importReport.imported.length > 0 && (
                    <div className="bg-slate-950 border border-emerald-500/20 rounded-xl p-3 space-y-1.5">
                      <h5 className="font-bold text-emerald-300 text-[10px] uppercase flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Imported Records ({importReport.imported.length})
                      </h5>
                      <div className="space-y-1">
                        {importReport.imported.map((imp, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-900 p-1.5 rounded border border-slate-850">
                            <span className="font-semibold text-slate-200">{imp.name}</span>
                            <span className="font-mono text-emerald-400">{imp.phone}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Failed Records */}
                  {importReport.failed.length > 0 && (
                    <div className="bg-slate-950 border border-red-500/20 rounded-xl p-3 space-y-1.5">
                      <h5 className="font-bold text-red-300 text-[10px] uppercase flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" /> Failed Records ({importReport.failed.length})
                      </h5>
                      <div className="space-y-1">
                        {importReport.failed.map((f, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-900 p-1.5 rounded border border-slate-850">
                            <span className="font-semibold text-slate-200">{f.name} ({f.phone})</span>
                            <span className="text-red-400 italic">{f.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    id="btn-close-import-report"
                    type="button"
                    onClick={() => { setImportModalOpen(false); setImportReport(null); }}
                    className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Purchases History Drawer Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-y-auto max-h-[85vh] text-xs">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">{formatMemberName(historyCustomer.name)}'s Ledger & History</h3>
                <p className="text-[10px] text-slate-400 font-mono">Mobile: {historyCustomer.phone}</p>
              </div>
              <button
                id="close-cust-history-modal"
                onClick={() => setHistoryCustomer(null)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 mb-4 font-bold text-xs">
              <button
                onClick={() => setHistoryTab('all')}
                className={`py-2 px-4 border-b-2 font-bold cursor-pointer transition ${
                  historyTab === 'all'
                    ? 'border-amber-500 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                All Billed Invoices
              </button>
              <button
                onClick={() => setHistoryTab('credit')}
                className={`py-2 px-4 border-b-2 font-bold cursor-pointer transition ${
                  historyTab === 'credit'
                    ? 'border-amber-500 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Credit Ledger (Udhar)
              </button>
            </div>

            {/* Content */}
            <div className="space-y-3">
              {getCustomerInvoices(historyCustomer.phone)
                .filter((inv) => historyTab === 'all' || inv.paymentMethod === 'credit')
                .length === 0 ? (
                <div className="text-center py-8 text-slate-500 font-medium">
                  No invoice records located for this customer.
                </div>
              ) : (
                getCustomerInvoices(historyCustomer.phone)
                  .filter((inv) => historyTab === 'all' || inv.paymentMethod === 'credit')
                  .map((inv) => {
                    const credSummary = calculateCreditSummary(inv);
                    return (
                      <div
                        key={inv.id}
                        className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2 hover:border-slate-800 transition"
                      >
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-bold text-slate-200">{inv.invoiceNo}</span>
                          <span className="text-amber-400 font-bold">{formatINR(inv.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Date: {new Date(inv.date).toLocaleDateString()}</span>
                          <span className="uppercase font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {inv.paymentMethod}
                          </span>
                        </div>
                        {inv.paymentMethod === 'credit' && (
                          <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">
                              Balance Due: <strong className="text-red-400">{formatINR(credSummary.balanceDue)}</strong>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                credSummary.status === 'Paid'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {credSummary.status}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Customers Modal */}
      {topCustomersOpen && (
        <TopCustomersModal
          isOpen={topCustomersOpen}
          onClose={() => setTopCustomersOpen(false)}
          onOpenAnniversaryCampaign={() => {
            setTopCustomersOpen(false);
            setAnniversaryCampaignOpen(true);
          }}
        />
      )}

      {/* Anniversary Campaign Modal */}
      {anniversaryCampaignOpen && (
        <AnniversaryCampaignModal
          isOpen={anniversaryCampaignOpen}
          onClose={() => setAnniversaryCampaignOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-xs text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-slate-200">Delete Patron Record</h3>
              <p className="text-slate-400 mt-1">Are you sure you want to remove <strong className="text-slate-200">{deleteConfirm.name}</strong>?</p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
