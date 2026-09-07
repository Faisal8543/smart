/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import { Fabric } from '../types';
import { formatINR } from '../utils/currency';
import { useDebounce } from '../hooks/useDebounce';
import { PermissionButton } from './common/PermissionGuard';
import {
  Scissors,
  Plus,
  Search,
  Edit2,
  Trash2,
  History,
  CheckCircle,
  AlertCircle,
  X,
  FolderMinus,
  Barcode,
} from 'lucide-react';

interface FabricsDirectoryViewProps {
  onOpenBarcode?: (fabric: Fabric) => void;
}

export const FabricsDirectoryView: React.FC<FabricsDirectoryViewProps> = ({ onOpenBarcode }) => {
  const {
    fabrics = [],
    addFabric,
    updateFabric,
    deleteFabric,
    adjustFabricStock,
    fabricLedger = [],
    categoriesList = [],
    brandsList = [],
    colorsList = [],
    addCategory,
    addBrand,
    addColor,
    settings,
  } = useAppState();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  // Selected Fabrics (Table Multi-Select Checkbox)
  const [selectedFabricIds, setSelectedFabricIds] = useState<Set<string>>(new Set());

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null);

  // Stock Adjustment Modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTargetFabric, setAdjustTargetFabric] = useState<Fabric | null>(null);
  const [adjustMeters, setAdjustMeters] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove' | 'damaged'>('add');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustRefNo, setAdjustRefNo] = useState<string>('');

  // Stock Ledger History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ledgerFabricFilter, setLedgerFabricFilter] = useState<string>('all');

  // Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recordId: string | null; recordName?: string }>({
    isOpen: false,
    recordId: null,
  });

  // Quick Add Master Mini-Modal
  const [miniModalType, setMiniModalType] = useState<'category' | 'brand' | 'color' | null>(null);
  const [miniModalValue, setMiniModalValue] = useState('');

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formColorId, setFormColorId] = useState('');
  const [formWidth, setFormWidth] = useState('58 inch');
  const [formPurchaseRate, setFormPurchaseRate] = useState<string>('');
  const [formRetailRate, setFormRetailRate] = useState<string>('');
  const [formStockMeters, setFormStockMeters] = useState<string>('50.00');
  const [formMinAlert, setFormMinAlert] = useState<string>('10.00');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formDescription, setFormDescription] = useState('');

  // Active Masters Filter
  const activeCategories = useMemo(() => categoriesList.filter((c) => c.status === 'active'), [categoriesList]);
  const activeBrands = useMemo(() => brandsList.filter((b) => b.status === 'active'), [brandsList]);
  const activeColors = useMemo(() => colorsList.filter((c) => c.status === 'active'), [colorsList]);

  // Filtered Fabrics
  const filteredFabrics = useMemo(() => {
    const query = (debouncedSearchTerm || '').toLowerCase().trim();
    return fabrics
      .filter((fab) => {
        const matchesSearch =
          !query ||
          fab.name.toLowerCase().includes(query) ||
          fab.sku.toLowerCase().includes(query) ||
          (fab.categoryName || '').toLowerCase().includes(query) ||
          (fab.brandName || '').toLowerCase().includes(query) ||
          (fab.colorName || '').toLowerCase().includes(query) ||
          (fab.description || '').toLowerCase().includes(query);

        const matchesCategory = selectedCategory === 'all' || fab.categoryId === selectedCategory;
        const matchesBrand = selectedBrand === 'all' || fab.brandId === selectedBrand;

        let matchesStock = true;
        const currentStock = Number(fab.stockMeters) || 0;
        const minAlert = Number(fab.minStockAlertMeters) || 10;
        if (stockFilter === 'low_stock') {
          matchesStock = currentStock <= minAlert && currentStock > 0;
        } else if (stockFilter === 'out_of_stock') {
          matchesStock = currentStock <= 0;
        }

        return matchesSearch && matchesCategory && matchesBrand && matchesStock;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fabrics, debouncedSearchTerm, selectedCategory, selectedBrand, stockFilter]);

  // Filtered Ledger Entries
  const filteredLedger = useMemo(() => {
    if (ledgerFabricFilter === 'all') return fabricLedger;
    return fabricLedger.filter((l) => l.fabricId === ledgerFabricFilter);
  }, [fabricLedger, ledgerFabricFilter]);

  // Open Form for Adding New Fabric
  const openAddModal = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setEditingFabric(null);
    setFormName('');
    setFormSku(`FAB-${randomSuffix}`);
    setFormCategoryId(activeCategories[0]?.id || '');
    setFormBrandId(activeBrands[0]?.id || '');
    setFormColorId(activeColors[0]?.id || '');
    setFormWidth('58 inch');
    setFormPurchaseRate('');
    setFormRetailRate('');
    setFormStockMeters('50.00');
    setFormMinAlert('10.00');
    setFormStatus('active');
    setFormDescription('');
    setFormOpen(true);
  };

  // Open Form for Editing Existing Fabric
  const openEditModal = (fab: Fabric) => {
    setEditingFabric(fab);
    setFormName(fab.name);
    setFormSku(fab.sku);
    setFormCategoryId(fab.categoryId || '');
    setFormBrandId(fab.brandId || '');
    setFormColorId(fab.colorId || '');
    setFormWidth(fab.width || '58 inch');
    setFormPurchaseRate(fab.purchaseRate?.toString() || '');
    setFormRetailRate(fab.retailRate?.toString() || '');
    setFormStockMeters(fab.stockMeters?.toString() || '0');
    setFormMinAlert((fab.minStockAlertMeters ?? 10).toString());
    setFormStatus(fab.status);
    setFormDescription(fab.description || '');
    setFormOpen(true);
  };

  // Save Fabric Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Please enter a valid fabric name.', 'error');
      return;
    }
    if (!formCategoryId) {
      showToast('Please select a Category from Categories Master.', 'error');
      return;
    }
    if (!formBrandId) {
      showToast('Please select a Brand from Brands Master.', 'error');
      return;
    }
    if (!formColorId) {
      showToast('Please select a Color from Colors Master.', 'error');
      return;
    }

    const catObj = categoriesList.find((c) => c.id === formCategoryId);
    const brandObj = brandsList.find((b) => b.id === formBrandId);
    const colorObj = colorsList.find((c) => c.id === formColorId);

    const payload = {
      sku: formSku.trim() || `FAB-${Math.floor(100 + Math.random() * 900)}`,
      name: formName.trim(),
      categoryId: formCategoryId,
      brandId: formBrandId,
      colorId: formColorId,
      categoryName: catObj?.name || '',
      brandName: brandObj?.name || '',
      colorName: colorObj?.name || '',
      width: formWidth.trim() || '58 inch',
      purchaseRate: parseFloat(formPurchaseRate) || 0,
      retailRate: parseFloat(formRetailRate) || 0,
      stockMeters: parseFloat(formStockMeters) || 0,
      minStockAlertMeters: parseFloat(formMinAlert) || 10,
      status: formStatus,
      description: formDescription.trim(),
    };

    if (editingFabric) {
      updateFabric(editingFabric.id, payload);
      showToast(`Updated fabric "${payload.name}" successfully`, 'success');
    } else {
      addFabric(payload);
      showToast(`Added new fabric "${payload.name}" successfully`, 'success');
    }

    setFormOpen(false);
    setEditingFabric(null);
  };

  // Quick Add Master Handler
  const handleQuickAddMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = miniModalValue.trim();
    if (!trimmed) {
      showToast('Please enter a valid value.', 'error');
      return;
    }

    if (miniModalType === 'category') {
      const item = addCategory(trimmed);
      if (item) setFormCategoryId(item.id);
      showToast(`Added category "${trimmed}"`, 'success');
    } else if (miniModalType === 'brand') {
      const item = addBrand(trimmed);
      if (item) setFormBrandId(item.id);
      showToast(`Added brand "${trimmed}"`, 'success');
    } else if (miniModalType === 'color') {
      const item = addColor(trimmed);
      if (item) setFormColorId(item.id);
      showToast(`Added color "${trimmed}"`, 'success');
    }

    setMiniModalType(null);
    setMiniModalValue('');
  };

  // Open Stock Adjust Modal
  const openAdjustModal = (fab: Fabric) => {
    setAdjustTargetFabric(fab);
    setAdjustMeters('');
    setAdjustType('add');
    setAdjustReason('');
    setAdjustRefNo('');
    setAdjustOpen(true);
  };

  // Submit Stock Adjustment
  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetFabric) return;
    const qty = parseFloat(adjustMeters);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid meter quantity greater than 0.', 'error');
      return;
    }
    if (!adjustReason.trim()) {
      showToast('Please specify a reason for this stock adjustment.', 'error');
      return;
    }

    adjustFabricStock(
      adjustTargetFabric.id,
      qty,
      adjustType,
      adjustReason.trim(),
      adjustRefNo.trim() || undefined
    );

    showToast(
      `Adjusted stock for "${adjustTargetFabric.name}": ${adjustType === 'add' ? '+' : '-'}${qty.toFixed(2)} M`,
      'success'
    );

    setAdjustOpen(false);
    setAdjustTargetFabric(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (deleteConfirm.recordId) {
      deleteFabric(deleteConfirm.recordId);
      showToast('Fabric record deleted successfully', 'success');
    }
    setDeleteConfirm({ isOpen: false, recordId: null });
  };

  return (
    <div className="space-y-4" id="fabrics-directory-container">
      {/* Dynamic Toast Alerts */}
      {toast && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-xs border fixed top-6 right-6 z-[9999] shadow-2xl animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Compact Flex Header for Fabrics Directory (Exact match to Products Directory) */}
      <div
        id="fabrics-directory-header"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 border border-slate-800/70 rounded-xl px-4 py-2.5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-base sm:text-lg font-bold tracking-tight text-amber-100 leading-tight">
                Fabrics Directory & Meter Inventory
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 hidden sm:inline-block">
                {filteredFabrics.length} {filteredFabrics.length === 1 ? 'variety' : 'varieties'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              Precision fabric stock management in meters (M), cut transaction ledger, and roll inventory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            id="view-fabric-ledger-history"
            onClick={() => {
              setLedgerFabricFilter('all');
              setHistoryOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
            title="View Fabric Stock Ledger History"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Stock Ledger</span>
          </button>
          <PermissionButton
            id="add-new-fabric"
            module="products"
            action="add"
            onClick={openAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 gold-gradient text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>New Fabric</span>
          </PermissionButton>
        </div>
      </div>

      {/* Filter and Search Bar (Exact match to Products Directory) */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="fabric-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Fabric Name, SKU / Code, Category, Brand, Color..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {/* Category Filter */}
          <select
            id="fabric-category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none transition cursor-pointer"
          >
            <option value="all">All Categories</option>
            {activeCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            id="fabric-brand-filter"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none transition cursor-pointer"
          >
            <option value="all">All Brands</option>
            {activeBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            id="fabric-stock-filter"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none transition cursor-pointer"
          >
            <option value="all">All Stocks</option>
            <option value="low_stock">Low Stocks</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Fabrics Table Card (Exact match to Products Directory Table) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredFabrics.length > 0 && filteredFabrics.every((f) => selectedFabricIds.has(f.id))}
                    onChange={(e) => {
                      const updated = new Set(selectedFabricIds);
                      if (e.target.checked) {
                        filteredFabrics.forEach((f) => updated.add(f.id));
                      } else {
                        filteredFabrics.forEach((f) => updated.delete(f.id));
                      }
                      setSelectedFabricIds(updated);
                    }}
                    className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                </th>
                <th className="p-4">SKU & Fabric Name</th>
                <th className="p-4">Category / Brand</th>
                <th className="p-4 text-center">Specs (Width / Color)</th>
                <th className="p-4 text-right font-mono">Purchase (₹/M)</th>
                <th className="p-4 text-right font-mono">Retail (₹/M)</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredFabrics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <FolderMinus className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    No fabrics found in showroom inventory. Click "New Fabric" to add.
                  </td>
                </tr>
              ) : (
                filteredFabrics.map((fab) => {
                  const stock = Number(fab.stockMeters) || 0;
                  const alertThreshold = Number(fab.minStockAlertMeters) || 10;
                  const isOut = stock <= 0;
                  const isLow = stock <= alertThreshold && !isOut;

                  return (
                    <tr
                      key={fab.id}
                      className={`hover:bg-slate-800/20 transition ${
                        selectedFabricIds.has(fab.id) ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedFabricIds.has(fab.id)}
                          onChange={() => {
                            const updated = new Set(selectedFabricIds);
                            if (updated.has(fab.id)) {
                              updated.delete(fab.id);
                            } else {
                              updated.add(fab.id);
                            }
                            setSelectedFabricIds(updated);
                          }}
                          className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* SKU & Fabric Name */}
                      <td className="p-4">
                        <div>
                          <h4 className="font-bold text-slate-200">{fab.name}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                            <Scissors className="w-3.5 h-3.5 text-amber-500/50" />
                            {fab.sku}
                          </div>
                        </div>
                      </td>

                      {/* Category and Brand */}
                      <td className="p-4">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {fab.categoryName || categoriesList.find((c) => c.id === fab.categoryId)?.name || 'General'}
                          </span>
                          <p className="text-[10px] text-amber-500/80 mt-1 font-serif italic">
                            {fab.brandName || brandsList.find((b) => b.id === fab.brandId)?.name || 'House'}
                          </p>
                        </div>
                      </td>

                      {/* Specs (Width / Color) */}
                      <td className="p-4 text-center">
                        <div className="inline-flex gap-1 items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                            {fab.width || '58"'}
                          </span>
                          {(fab.colorName || colorsList.find((c) => c.id === fab.colorId)?.name) && (
                            <span className="text-[10px] text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded max-w-[90px] truncate">
                              {fab.colorName || colorsList.find((c) => c.id === fab.colorId)?.name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchase Rate per Meter */}
                      <td className="p-4 text-right font-mono font-medium text-slate-400">
                        {formatINR(fab.purchaseRate, { keepDecimals: true })}
                      </td>

                      {/* Retail Rate per Meter */}
                      <td className="p-4 text-right font-mono font-bold text-amber-200">
                        {formatINR(fab.retailRate, { keepDecimals: true })}
                      </td>

                      {/* Stock Alert State */}
                      <td className="p-4 text-center">
                        <div>
                          <span
                            className={`font-mono font-bold text-sm ${
                              isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-200'
                            }`}
                          >
                            {stock.toFixed(2)} M
                          </span>
                          {isOut ? (
                            <span className="flex items-center justify-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-red-500 mt-1">
                              <AlertCircle className="w-2.5 h-2.5" /> Out
                            </span>
                          ) : isLow ? (
                            <span className="flex items-center justify-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-500 mt-1 animate-pulse">
                              <AlertCircle className="w-2.5 h-2.5" /> Low Stock
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
                              <CheckCircle className="w-2.5 h-2.5 text-slate-600" /> Optimal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* Print Barcode button */}
                          <button
                            id={`btn-barcode-${fab.id}`}
                            title="Print Barcode Tag"
                            onClick={() => {
                              if (onOpenBarcode) {
                                onOpenBarcode(fab);
                              }
                            }}
                            className="p-1.5 rounded bg-slate-950 text-amber-500/80 hover:text-amber-400 border border-slate-800 hover:border-amber-500/20 transition cursor-pointer"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Adjust Stock */}
                          <PermissionButton
                            id={`btn-adjust-${fab.id}`}
                            module="products"
                            action="update_stock"
                            title="Adjust Meter Stock In-Out"
                            onClick={() => openAdjustModal(fab)}
                            className="text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                          >
                            Stock ±
                          </PermissionButton>

                          {/* Edit button */}
                          <PermissionButton
                            id={`btn-edit-${fab.id}`}
                            module="products"
                            action="edit"
                            onClick={() => openEditModal(fab)}
                            className="p-1.5 rounded bg-slate-950 text-blue-400 hover:text-blue-300 border border-slate-800 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </PermissionButton>

                          {/* Delete button */}
                          <PermissionButton
                            id={`btn-del-${fab.id}`}
                            module="products"
                            action="delete"
                            onClick={() => {
                              setDeleteConfirm({ isOpen: true, recordId: fab.id, recordName: fab.name });
                            }}
                            className="p-1.5 rounded bg-slate-950 text-red-400 hover:bg-red-500/10 border border-slate-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </PermissionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT LUXURY FABRIC MODAL (Exact match to Products Add/Edit Modal)  */}
      {/* ========================================================================= */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/10 rounded-2xl w-full max-w-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-xl font-bold text-amber-100">
                  {editingFabric ? 'Refine Fabric Variety' : 'Add Luxury Fabric Variety'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Complete fabric profile, meter roll rates, and master specs with ERP precision.
                </p>
              </div>
              <button
                id="close-form-modal"
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5 text-xs">
              {/* Fabric Name (Full Width) */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Fabric Name *
                </label>
                <input
                  id="form-fabric-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Super 150s Merino Wool Navy, Premium Giza Cotton"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <hr className="border-slate-800/80" />

              {/* SKU / Code and Width */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Fabric SKU / Code *
                  </label>
                  <input
                    id="form-fabric-sku"
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="FAB-101"
                    className="w-full bg-slate-950 border border-slate-800 font-mono focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Roll Width Spec *
                  </label>
                  <input
                    id="form-fabric-width"
                    type="text"
                    value={formWidth}
                    onChange={(e) => setFormWidth(e.target.value)}
                    placeholder="58 inch"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Category, Brand, Color (3 Columns linked to Masters) */}
              <div className="grid grid-cols-3 gap-6">
                {/* Category */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Category *
                  </label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-fabric-category"
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Select Category</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('category');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap cursor-pointer"
                      title="Add New Category"
                    >
                      + New
                    </button>
                  </div>
                </div>

                {/* Brand */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Fabric Brand *
                  </label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-fabric-brand"
                      value={formBrandId}
                      onChange={(e) => setFormBrandId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Select Brand</option>
                      {activeBrands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('brand');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap cursor-pointer"
                      title="Add New Brand"
                    >
                      + New
                    </button>
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Color *
                  </label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-fabric-color"
                      value={formColorId}
                      onChange={(e) => setFormColorId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Select Color</option>
                      {activeColors.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('color');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap cursor-pointer"
                      title="Add New Color"
                    >
                      + New
                    </button>
                  </div>
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Purchase Rate and Retail Rate */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Purchase Rate (₹/M) *
                  </label>
                  <input
                    id="form-fabric-buy"
                    type="number"
                    step="0.01"
                    value={formPurchaseRate}
                    onChange={(e) => setFormPurchaseRate(e.target.value)}
                    placeholder="280.00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Retail Selling Rate (₹/M) *
                  </label>
                  <input
                    id="form-fabric-sell"
                    type="number"
                    step="0.01"
                    value={formRetailRate}
                    onChange={(e) => setFormRetailRate(e.target.value)}
                    placeholder="350.00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none font-bold"
                    min="0"
                    required
                  />
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Current Stock (Meters), Minimum Alert (Meters), Status */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Current Stock (M) *
                  </label>
                  <input
                    id="form-fabric-stock"
                    type="number"
                    step="0.01"
                    value={formStockMeters}
                    onChange={(e) => setFormStockMeters(e.target.value)}
                    placeholder="50.00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0"
                    required
                    disabled={editingFabric !== null}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Min Alert Threshold (M) *
                  </label>
                  <input
                    id="form-fabric-alert"
                    type="number"
                    step="0.01"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    placeholder="10.00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Showroom Status
                  </label>
                  <select
                    id="form-fabric-status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active On Display</option>
                    <option value="inactive">Archived / Hidden</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Description / Weave Notes
                </label>
                <textarea
                  id="form-fabric-description"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. 100% Egyptian Giza long-staple combed cotton for bespoke dress shirts..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              {editingFabric && (
                <p className="text-[10px] text-amber-500/80 italic font-medium pt-1">
                  Note: Updating current stock meters directly is locked. Please use the "Stock ±" quick button on the table page to audit entries.
                </p>
              )}

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-800">
                <button
                  id="cancel-fabric-form"
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-5 py-2.5 rounded-lg font-bold transition active:scale-95 text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-fabric-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-7 py-2.5 rounded-lg font-extrabold uppercase tracking-widest transition active:scale-95 shadow-lg text-xs cursor-pointer"
                >
                  {editingFabric ? 'Refine Fabric' : 'Add Fabric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK STOCK ± ADJUSTMENT MODAL (Exact match to Products Stock ± Modal)    */}
      {/* ========================================================================= */}
      {adjustOpen && adjustTargetFabric && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Audit Fabric Meter Stock</h3>
                <p className="text-[10px] text-slate-400">
                  Log roll procurement or cuts for:{' '}
                  <span className="text-amber-500 font-bold">{adjustTargetFabric.name}</span>
                </p>
              </div>
              <button
                id="close-adjust-modal"
                onClick={() => setAdjustOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Adjust Type */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Adjustment Category
                  </label>
                  <select
                    id="adjust-type-select"
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-300 focus:outline-none"
                  >
                    <option value="add">Restock In (+)</option>
                    <option value="remove">Cut / Out (-)</option>
                    <option value="damaged">Damaged / Flaw (-)</option>
                  </select>
                </div>

                {/* Adjust Qty in Meters */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Meters Affected (M)
                  </label>
                  <input
                    id="adjust-qty-input"
                    type="number"
                    step="0.01"
                    value={adjustMeters}
                    onChange={(e) => setAdjustMeters(e.target.value)}
                    placeholder="2.50"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0.01"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Adjust Reason */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Explanation / Audit Reason *
                </label>
                <textarea
                  id="adjust-reason-input"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Procured roll from Raymond Mills or bespoke suit cut sample"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none h-20"
                  required
                />
              </div>

              {/* Ref / Voucher No */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Ref / Voucher No. (Optional)
                </label>
                <input
                  id="adjust-ref-input"
                  type="text"
                  value={adjustRefNo}
                  onChange={(e) => setAdjustRefNo(e.target.value)}
                  placeholder="e.g., ADJ-ROLL-102"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              {/* Forecast preview banner */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between font-mono">
                <span className="text-slate-400">Current Stock:</span>
                <span className="font-bold text-amber-500">
                  {(Number(adjustTargetFabric.stockMeters) || 0).toFixed(2)} M
                </span>
                <span className="text-slate-400">→ Forecast:</span>
                <span className="font-bold text-amber-300">
                  {(
                    adjustType === 'add'
                      ? (Number(adjustTargetFabric.stockMeters) || 0) + (parseFloat(adjustMeters) || 0)
                      : Math.max(0, (Number(adjustTargetFabric.stockMeters) || 0) - (parseFloat(adjustMeters) || 0))
                  ).toFixed(2)}{' '}
                  M
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustOpen(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-adjust-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-widest cursor-pointer shadow-md"
                >
                  Commit Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STOCK LEDGER HISTORY MODAL (Exact match to Products Stock Ledger Modal)  */}
      {/* ========================================================================= */}
      {historyOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-3xl p-6 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Fabric Stock Ledger Logs</h3>
                <p className="text-[10px] text-slate-400">
                  Historic record of roll restocks, bespoke cuts, sales bills, and write-offs.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={ledgerFabricFilter}
                  onChange={(e) => setLedgerFabricFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Fabrics ({fabrics.length})</option>
                  {fabrics.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.sku})
                    </option>
                  ))}
                </select>

                <button
                  id="close-history-modal"
                  onClick={() => setHistoryOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase font-bold text-slate-400">
                    <th className="p-3">Date</th>
                    <th className="p-3">Fabric / SKU</th>
                    <th className="p-3">Action</th>
                    <th className="p-3 text-center">Amount (M)</th>
                    <th className="p-3 text-center font-mono">Stock Balance</th>
                    <th className="p-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No logs created in the fabric ledger.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((log) => {
                      const isAdd = log.metersAdded > 0;
                      const isCut = log.metersRemoved > 0;
                      const formattedDate = log.date
                        ? new Date(log.date).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/20">
                          <td className="p-3 text-slate-500 font-mono whitespace-nowrap">{formattedDate}</td>
                          <td className="p-3">
                            <h5 className="font-bold text-slate-300">{log.fabricName}</h5>
                            {log.refNo && <span className="text-[10px] text-amber-400/80 font-mono">{log.refNo}</span>}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                log.type === 'opening'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : log.type === 'bill'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : log.type === 'adjustment-add'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : log.type === 'damaged'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {log.type}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            {isAdd ? `+${log.metersAdded.toFixed(2)} M` : isCut ? `-${log.metersRemoved.toFixed(2)} M` : '0 M'}
                          </td>
                          <td className="p-3 text-center font-mono text-amber-300 font-semibold">
                            {log.balanceMeters.toFixed(2)} M
                          </td>
                          <td className="p-3 text-slate-400 italic font-sans max-w-[200px] truncate" title={log.reason}>
                            {log.reason}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK ADD MINI-MODAL FOR MASTERS (Exact match to Products Mini-Modal)     */}
      {/* ========================================================================= */}
      {miniModalType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs" onClick={() => setMiniModalType(null)} />
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h4 className="font-serif text-xs font-bold text-amber-200 uppercase tracking-wide">
                Quick Add {miniModalType}
              </h4>
              <button
                onClick={() => setMiniModalType(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleQuickAddMaster} className="p-4 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  {miniModalType} Name *
                </label>
                <input
                  type="text"
                  value={miniModalValue}
                  onChange={(e) => setMiniModalValue(e.target.value)}
                  placeholder={`e.g. New ${miniModalType}`}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-xs text-slate-200 focus:outline-none placeholder-slate-600 transition"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setMiniModalType(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 gold-gradient text-slate-950 font-bold uppercase tracking-wider rounded-lg transition hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOM DELETE CONFIRMATION MODAL (Exact match to Products Delete Modal)   */}
      {/* ========================================================================= */}
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
                  Are you sure you want to permanently delete this fabric variety
                  {deleteConfirm.recordName ? ` "${deleteConfirm.recordName}"` : ''}?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                id="btn-delete-cancel"
                onClick={() => setDeleteConfirm({ isOpen: false, recordId: null })}
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
