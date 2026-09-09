import React, { useState } from 'react';
import { useAppState } from '../../context/StateContext';
import { Search, Plus, Edit2, Trash2, FolderMinus, X, Check, Eye, EyeOff } from 'lucide-react';
import { ColorMaster } from '../../types';

export const ColorsMasterView: React.FC = () => {
  const { colorsList, addColor, updateColor, deleteColor } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ColorMaster | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name?: string }>({ isOpen: false, id: null });

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      try {
        deleteColor(deleteConfirm.id);
        showToast('Record deleted successfully.', 'success');
      } catch (err) {
        showToast('Failed to delete record.', 'error');
      }
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };
  
  // Form states
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Search filter
  const filtered = colorsList.filter((col) =>
    (col.name || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setStatus('active');
    setModalOpen(true);
  };

  const openEditModal = (item: ColorMaster) => {
    setEditingItem(item);
    setName(item.name);
    setStatus(item.status);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a color lining.');
      return;
    }

    if (editingItem) {
      updateColor(editingItem.id, { name: name.trim(), status });
    } else {
      addColor(name.trim(), status);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  return (
    <div className="space-y-4" id="colors-master-container">
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
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-serif font-bold text-amber-200">Color Master Directory</h2>
          <p className="text-xs text-slate-400">Configure designer clothing lining colors.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 gold-gradient text-slate-950 font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          New Color
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search colors by label..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* Grid or Table list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="p-4 w-16">#</th>
                <th className="p-4">Color Lining Label</th>
                <th className="p-4 text-center w-36">Status</th>
                <th className="p-4 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    <FolderMinus className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    No colors found. Click "New Color" to begin.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition">
                    <td className="p-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="p-4 font-semibold text-slate-200">{item.name}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.status === 'active' ? (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Active
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-500 border border-slate-800/80 transition"
                          title="Edit Color"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/30 text-slate-400 hover:text-rose-500 border border-slate-800/80 transition"
                          title="Delete Color"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Form overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          
          {/* Modal Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-serif text-sm font-bold text-amber-200">
                {editingItem ? 'Edit Color Record' : 'Create New Color'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Color Lining Label *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Midnight Black, Ivory White, Saddle Tan..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none placeholder-slate-600 transition"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none transition"
                >
                  <option value="active">Active (Available in Dropdowns)</option>
                  <option value="inactive">Inactive (Hidden in Dropdowns)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-transparent hover:bg-slate-800 border border-transparent rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold uppercase tracking-wider gold-gradient text-slate-950 rounded-lg transition hover:opacity-90 active:scale-95 shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  Save Record
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
