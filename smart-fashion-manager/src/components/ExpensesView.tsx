/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import { useDebounce } from '../hooks/useDebounce';
import { PermissionButton } from './common/PermissionGuard';
import {
  IndianRupee,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
} from 'lucide-react';
import { formatINR } from '../utils/currency';

export const ExpensesView: React.FC = () => {
  const { expenses, addExpense, updateExpense, deleteExpense } = useAppState();

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Form Fields
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name?: string }>({ isOpen: false, id: null });

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      try {
        deleteExpense(deleteConfirm.id);
        showToast('Record deleted successfully.', 'success');
      } catch (err) {
        showToast('Failed to delete record.', 'error');
      }
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Rent');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const filteredExpenses = useMemo(() => {
    const term = (debouncedSearchTerm || '').toLowerCase().trim();
    return expenses.filter((e) => {
      if (!e) return false;
      const titleText = (e.title || e.description || '').toLowerCase();
      const notesText = (e.notes || e.description || '').toLowerCase();

      const matchSearch = !term || titleText.includes(term) || notesText.includes(term);
      const matchCategory = selectedCategory === 'All' || e.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [expenses, debouncedSearchTerm, selectedCategory]);

  const handleEditClick = (e: any) => {
    setEditingExpenseId(e.id);
    setTitle(e.title || e.description || '');
    setCategory(e.category || 'Rent');
    setAmount(e.amount || 0);
    setNotes(e.notes || e.description || '');
    setFormOpen(true);
  };

  const handleCloseModal = () => {
    setFormOpen(false);
    setEditingExpenseId(null);
    setTitle('');
    setCategory('Rent');
    setAmount(0);
    setNotes('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amount <= 0) {
      alert('Please fill in title and correct dollar amount.');
      return;
    }

    if (editingExpenseId) {
      updateExpense(editingExpenseId, {
        title,
        description: title,
        category,
        amount: Number(amount),
        notes,
      });
    } else {
      addExpense({
        title,
        description: title,
        category,
        amount: Number(amount),
        notes,
        date: new Date().toISOString()
      });
    }
    setFormOpen(false);
    setEditingExpenseId(null);
    setTitle('');
    setCategory('Rent');
    setAmount(0);
    setNotes('');
  };

  // Compile total expenses
  const totalSpent = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6" id="expenses-view-container">
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
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100">Store Expenditures</h1>
          <p className="text-xs text-slate-400">Log showroom maintenance bills, rent, alterations costs, and boutique utilities.</p>
        </div>
        <PermissionButton
          id="add-new-expense"
          module="expenses"
          action="add"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 gold-gradient text-slate-950 font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Record Expense
        </PermissionButton>
      </div>

      {/* Stats Cards */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Consolidated Outflow</span>
          <h3 className="text-2xl font-mono font-bold text-amber-300 mt-1">
            {formatINR(totalSpent, { keepDecimals: true })}
          </h3>
          <p className="text-[9px] text-slate-500 mt-1">Based on current filter parameters.</p>
        </div>

        <div className="flex gap-2">
          {/* Quick Filters */}
          <select
            id="expense-category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500 transition"
          >
            <option value="All">All Expense Types</option>
            <option value="Rent">Rent</option>
            <option value="Salaries">Stylist Salaries</option>
            <option value="Utilities">Electricity & Power</option>
            <option value="Maintenance">Alterations & Tailoring supplies</option>
            <option value="Others">Others</option>
          </select>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="expense-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search expenditures by name or remarks notes..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none transition"
          />
        </div>
      </div>

      {/* Expenses Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="p-4">Expenditure Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Date Logged</th>
                <th className="p-4">Remarks Remarks</th>
                <th className="p-4 text-right font-mono">Amount Out</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <IndianRupee className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    No logged showroom expenditures for this view.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/10 transition">
                    <td className="p-4">
                      <span className="font-bold text-slate-200">{e.title || e.description || 'Unnamed Expense'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                        {e.category || 'Others'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono">
                      {e.date ? new Date(e.date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-4 text-slate-400 italic max-w-[200px] truncate" title={e.notes || e.description || ''}>
                      {e.notes || e.description || 'No remarks recorded.'}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-amber-300">
                      {formatINR(e.amount || 0, { keepDecimals: true })}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-1.5">
                      <PermissionButton
                        id={`btn-exp-edit-${e.id}`}
                        module="expenses"
                        action="edit"
                        onClick={() => handleEditClick(e)}
                        className="p-1.5 rounded text-slate-500 hover:text-amber-400 transition cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit2 className="w-4 h-4" />
                      </PermissionButton>
                      <PermissionButton
                        id={`btn-exp-del-${e.id}`}
                        module="expenses"
                        action="delete"
                        onClick={() => setDeleteConfirm({ isOpen: true, id: e.id, name: e.title || e.description })}
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 transition cursor-pointer"
                        title="Void/Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </PermissionButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record/Edit Expense Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  {editingExpenseId ? 'Edit Showroom Expense' : 'Record Showroom Expense'}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {editingExpenseId ? 'Modify transaction details to update Net Profit calculations.' : 'Complete transaction details to update Net Profit calculations.'}
                </p>
              </div>
              <button
                id="close-expense-modal"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Expenditure Title *</label>
                <input
                  id="form-exp-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Showroom AC Compressor Alterations"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Expense Category</label>
                  <select
                    id="form-exp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-300 focus:outline-none"
                  >
                    <option value="Rent">Rent</option>
                    <option value="Salaries">Stylist Salaries</option>
                    <option value="Utilities">Electricity & Power</option>
                    <option value="Maintenance">Alterations & Tailoring supplies</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Amount Paid (₹) *</label>
                  <input
                    id="form-exp-amount"
                    type="number"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="120"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Remarks Remarks / Notes</label>
                <textarea
                  id="form-exp-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Voucher details, check numbers or description notes..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none h-20"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  id="submit-expense-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-widest"
                >
                  {editingExpenseId ? 'Update Entry' : 'Save Entry'}
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
