import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { Gift } from '../types';
import { formatINR } from '../utils/currency';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Printer, 
  History, 
  AlertTriangle, 
  Upload, 
  X, 
  Check, 
  SlidersHorizontal, 
  FileSpreadsheet,
  Package,
  Tags,
  QrCode
} from 'lucide-react';

const CODE128_PATTERNS: Record<string, string> = {
  ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
  '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
  '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
  ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
  '0': '10011101100', '1': '10011100110', '2': '11001110100', '3': '11001110010',
  '4': '11001011100', '5': '11001001110', '6': '11001100110', '7': '11001101110',
  '8': '11001110010', '9': '11001110110', ':': '11101101100', ';': '11101100110',
  '<': '11100101100', '=': '11100100110', '>': '11100111010', '?': '11100111011',
  '@': '11101110100', 'A': '11101110010', 'B': '11100111010', 'C': '11100111011',
  'D': '11011011100', 'E': '11011001110', 'F': '11011100110', 'G': '11011101100',
  'H': '11011100110', 'I': '11011101110', 'J': '11101101110', 'K': '11101100110',
  'L': '11100110110', 'M': '11100110011', 'N': '11100111011', 'O': '11001110110',
  'P': '11001110111', 'Q': '11110110110', 'R': '11011110110', 'S': '11011110111',
  'T': '11101111010', 'U': '11101111011', 'V': '11110110110', 'W': '11110110111',
  'X': '11110111010', 'Y': '11110111011', 'Z': '11110111101', '[': '11111011101',
  '\\': '11111011110', ']': '11111011111', '^': '11111101111', '_': '11111101111'
};

export const GiftsMasterView: React.FC = () => {
  const { 
    gifts, 
    addGift, 
    updateGift, 
    deleteGift, 
    adjustGiftStock, 
    inventoryHistory,
    suppliers,
    settings,
    categoriesList,
    brandsList,
    addCategory,
    addBrand
  } = useAppState();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Searchable brand dropdown states
  const [brandSearch, setBrandSearch] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Selected entities for modals
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name?: string }>({ isOpen: false, id: null });

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      try {
        deleteGift(deleteConfirm.id);
        showToast('Record deleted successfully.', 'success');
      } catch (err) {
        showToast('Failed to delete record.', 'error');
      }
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  // Stock Adjust Modal fields
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<'stock-in' | 'stock-out' | 'adjustment' | 'damaged'>('stock-in');
  const [adjustReason, setAdjustReason] = useState('');

  // Barcode Printer Modal fields
  const [barcodeQty, setBarcodeQty] = useState(1);
  const [barcodeLabelTitle, setBarcodeLabelTitle] = useState(true);
  const [barcodeLabelPrice, setBarcodeLabelPrice] = useState(true);

  // Bulk Import state
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Gift Form Fields
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    brand: '',
    mrp: 0,
    sellingPrice: 0,
    purchasePrice: 0,
    currentStock: 0,
    minStockAlert: 5,
    supplier: '',
    imageUrl: '',
    status: 'active' as 'active' | 'inactive',
    description: ''
  });

  // Reset form
  const resetForm = () => {
    const firstActiveCat = categoriesList.find(c => c.status === 'active')?.id || '';
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      category: firstActiveCat,
      brand: '',
      mrp: 0,
      sellingPrice: 0,
      purchasePrice: 0,
      currentStock: 0,
      minStockAlert: 5,
      supplier: suppliers[0]?.name || 'Sudarshan Corp',
      imageUrl: '',
      status: 'active',
      description: ''
    });
    setBrandSearch('');
    setIsBrandDropdownOpen(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (gift: Gift) => {
    setSelectedGift(gift);
    setFormData({
      name: gift.name,
      sku: gift.sku,
      barcode: gift.barcode || gift.sku,
      category: gift.category,
      brand: gift.brand || '',
      mrp: gift.mrp,
      sellingPrice: gift.sellingPrice,
      purchasePrice: gift.purchasePrice,
      currentStock: gift.currentStock,
      minStockAlert: gift.minStockAlert,
      supplier: gift.supplier || suppliers[0]?.name || 'Sudarshan Corp',
      imageUrl: gift.imageUrl || '',
      status: gift.status,
      description: gift.description || ''
    });
    setBrandSearch('');
    setIsBrandDropdownOpen(false);
    setIsEditOpen(true);
  };

  const handleOpenAdjust = (gift: Gift) => {
    setSelectedGift(gift);
    setAdjustQty(1);
    setAdjustType('stock-in');
    setAdjustReason('Regular stock replenishment');
    setIsAdjustOpen(true);
  };

  const handleOpenBarcode = (gift: Gift) => {
    setSelectedGift(gift);
    setBarcodeQty(1);
    setIsBarcodeOpen(true);
  };

  // Submit operations
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    // Validation: Category is mandatory
    if (!formData.category) {
      alert('Category is mandatory.');
      return;
    }
    const selectedCat = categoriesList.find(c => c.id === formData.category);
    if (!selectedCat || selectedCat.status !== 'active') {
      alert('Please select a valid, active category from the Category Master.');
      return;
    }

    // Brand is optional, but if specified, it must be valid and active
    if (formData.brand) {
      const selectedBr = brandsList.find(b => b.id === formData.brand);
      if (!selectedBr || selectedBr.status !== 'active') {
        alert('The selected brand is invalid or has been deactivated/deleted in Brand Master.');
        return;
      }
    }
    
    addGift({
      ...formData,
      barcode: formData.barcode || formData.sku
    });
    setIsAddOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift) return;

    // Validation: Category is mandatory
    if (!formData.category) {
      alert('Category is mandatory.');
      return;
    }
    const selectedCat = categoriesList.find(c => c.id === formData.category);
    if (!selectedCat || selectedCat.status !== 'active') {
      alert('Please select a valid, active category from the Category Master.');
      return;
    }

    // Brand is optional, but if specified, it must be valid and active
    if (formData.brand) {
      const selectedBr = brandsList.find(b => b.id === formData.brand);
      if (!selectedBr || selectedBr.status !== 'active') {
        alert('The selected brand is invalid or has been deactivated/deleted in Brand Master.');
        return;
      }
    }
    
    updateGift(selectedGift.id, {
      ...formData,
      barcode: formData.barcode || formData.sku
    });
    setIsEditOpen(false);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift) return;

    const actualQty = adjustType === 'stock-in' ? adjustQty : -adjustQty;
    adjustGiftStock(selectedGift.id, actualQty, adjustType, adjustReason || `Manual ${adjustType}`);
    setIsAdjustOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  // Bulk Import Submit
  const handleBulkImport = () => {
    setImportError('');
    setImportSuccessMsg('');
    if (!importText.trim()) {
      setImportError('Please enter some text or comma-separated values to import.');
      return;
    }

    const lines = importText.split('\n');
    let importedCount = 0;
    let skipCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      // Format support: Name, SKU, Barcode, Category, [Optional Brand], MRP, SellingPrice, PurchasePrice, Stock, MinAlert, Supplier, Description
      const parts = line.split(/[,\t]/).map(p => p.trim());
      if (parts.length < 2) {
        skipCount++;
        continue;
      }

      const name = parts[0];
      const sku = parts[1];
      const barcode = parts[2] || sku;
      
      // Category handling (dynamic lookup or dynamic creation)
      const rawCategory = parts[3] || 'Bottle';
      let categoryId = '';
      const matchedCat = categoriesList.find(c => (c.name || '').toLowerCase() === (rawCategory || '').toLowerCase() || c.id === rawCategory);
      if (matchedCat) {
        categoryId = matchedCat.id;
      } else {
        const newCat = addCategory(rawCategory, 'active');
        categoryId = newCat.id;
      }

      // Brand handling (dynamic lookup or dynamic creation)
      let brandId = '';
      let mrpIdx = 4;
      let brandVal = '';
      if (parts[4] && isNaN(Number(parts[4]))) {
        brandVal = parts[4];
        mrpIdx = 5;
      }
      
      if (brandVal) {
        const matchedBr = brandsList.find(b => (b.name || '').toLowerCase() === (brandVal || '').toLowerCase() || b.id === brandVal);
        if (matchedBr) {
          brandId = matchedBr.id;
        } else {
          const newBr = addBrand(brandVal, 'active');
          brandId = newBr.id;
        }
      }

      const mrp = Number(parts[mrpIdx]) || 199;
      const sellingPrice = Number(parts[mrpIdx + 1]) || 0;
      const purchasePrice = Number(parts[mrpIdx + 2]) || 50;
      const currentStock = Number(parts[mrpIdx + 3]) || 50;
      const minStockAlert = Number(parts[mrpIdx + 4]) || 10;
      const supplier = parts[mrpIdx + 5] || suppliers[0]?.name || 'Sudarshan Corp';
      const description = parts[mrpIdx + 6] || 'Bulk imported promotional merchandise.';

      addGift({
        name,
        sku,
        barcode,
        category: categoryId,
        brand: brandId,
        mrp,
        sellingPrice,
        purchasePrice,
        currentStock,
        minStockAlert,
        supplier,
        imageUrl: '',
        status: 'active',
        description
      });
      importedCount++;
    }

    setImportSuccessMsg(`Successfully imported ${importedCount} gift products! Skipped ${skipCount} invalid lines.`);
    setImportText('');
    setTimeout(() => {
      setIsImportOpen(false);
      setImportSuccessMsg('');
    }, 2500);
  };

  // Code128 generation helper
  const generateCode128Bars = (sku: string) => {
    const CODE128_ORDER = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_';
    const cleanSku = sku ? sku.trim().slice(0, 30) : '0000000000';
    let sum = 104;
    for (let i = 0; i < cleanSku.length; i++) {
      const char = cleanSku[i];
      const codeIndex = CODE128_ORDER.indexOf(char);
      const val = codeIndex >= 0 ? codeIndex : 0;
      sum += val * (i + 1);
    }
    const checkIndex = sum % 103;
    
    let binary = '11010010000';
    for (let i = 0; i < cleanSku.length; i++) {
      const char = cleanSku[i];
      const pattern = CODE128_PATTERNS[char] || CODE128_PATTERNS[' '];
      binary += pattern;
    }
    
    const checkChar = CODE128_ORDER[checkIndex] || ' ';
    binary += CODE128_PATTERNS[checkChar] || CODE128_PATTERNS[' '];
    binary += '1100011101011';
    
    return { binary, displayValue: cleanSku };
  };

  const renderBarcodeSVG = (sku: string, height: number = 36) => {
    const { binary } = generateCode128Bars(sku);
    const scale = 1.3;
    const barWidth = 1.1 * scale;
    const svgWidth = binary.length * barWidth;
    
    return (
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${svgWidth} ${height}`} 
        preserveAspectRatio="none"
        className="mx-auto block"
      >
        {binary.split('').map((bit, idx) => {
          if (bit === '1') {
            return (
              <rect
                key={idx}
                x={idx * barWidth}
                y={0}
                width={barWidth}
                height={height}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>
    );
  };

  // Filtered lists
  const lowStockGifts = gifts.filter(g => g.currentStock <= g.minStockAlert && g.status === 'active');
  
  const filteredGifts = gifts.filter((g) => {
    const catObj = categoriesList.find(c => c.id === g.category || c.name === g.category);
    const catName = catObj ? catObj.name : 'Unknown / Deleted';
    const brandObj = brandsList.find(b => b.id === g.brand || b.name === g.brand);
    const brandName = brandObj ? brandObj.name : (g.brand || 'Generic');

    const matchesSearch = 
      (g.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (g.sku || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (g.barcode && String(g.barcode).toLowerCase().includes((searchTerm || '').toLowerCase())) ||
      (g.supplier && String(g.supplier).toLowerCase().includes((searchTerm || '').toLowerCase())) ||
      (catName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (brandName || '').toLowerCase().includes((searchTerm || '').toLowerCase());
      
    const matchesCategory = selectedCategory 
      ? (g.category === selectedCategory || (catObj && catObj.id === selectedCategory)) 
      : true;
    const matchesStatus = selectedStatus ? g.status === selectedStatus : true;
    const matchesLowStock = showLowStockOnly ? g.currentStock <= g.minStockAlert : true;

    return matchesSearch && matchesCategory && matchesStatus && matchesLowStock;
  });

  // Gift inventory logs
  const giftLogs = inventoryHistory.filter(h => h.isGift || h.giftId);

  // Trigger Direct Barcode Print Dialog
  const handlePrintBarcodeLabels = () => {
    if (!selectedGift) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const { binary } = generateCode128Bars(selectedGift.sku);
    const scale = 1.5;
    const barWidth = 1.2 * scale;
    const svgWidth = binary.length * barWidth;

    let svgLines = '';
    binary.split('').map((bit, idx) => {
      if (bit === '1') {
        svgLines += `<rect x="${idx * barWidth}" y="0" width="${barWidth}" height="38" fill="#000000" />`;
      }
    });

    const labelsHTML = Array.from({ length: barcodeQty }).map(() => `
      <div style="width: 50mm; height: 25mm; border: 1px dashed #ccc; padding: 2mm; box-sizing: border-box; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: 'Poppins', sans-serif; page-break-inside: avoid; margin: 3px; background: white;">
        ${barcodeLabelTitle ? `<div style="font-size: 8pt; font-weight: bold; margin-bottom: 1px; color: black; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Poppins', sans-serif;">${selectedGift.name}</div>` : ''}
        <div style="font-size: 6pt; color: #555; margin-bottom: 2px; font-family: 'Poppins', sans-serif;">SKU: ${selectedGift.sku}</div>
        <svg width="100%" height="32" viewBox="0 0 ${svgWidth} 32" style="max-height: 32px; display: block; margin: 2px 0;">
          ${svgLines}
        </svg>
        <div style="font-size: 7pt; font-weight: 600; color: black; font-family: 'Poppins', sans-serif; letter-spacing: 0.5px;">${selectedGift.sku}</div>
        ${barcodeLabelPrice ? `<div style="font-size: 8pt; font-weight: bold; margin-top: 1px; color: black; font-family: 'Poppins', sans-serif;">MRP: ${formatINR(selectedGift.mrp)}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Gift Labels - ${selectedGift.name}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
            @media print {
              body { margin: 0; background: white; }
              @page { size: auto; margin: 0mm; }
            }
            body { font-family: 'Poppins', sans-serif; display: flex; flex-wrap: wrap; padding: 10px; background: #f3f4f6; }
          </style>
        </head>
        <body>
          ${labelsHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsBarcodeOpen(false);
  };

  return (
    <div className="space-y-6">
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
      {/* Low Stock Alert Header Warning */}
      {lowStockGifts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-lg text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-200">Critical Low Stock Warning ({lowStockGifts.length} items)</h4>
              <p className="text-xs text-red-300/80">Complementary and promotional merchandise is running below thresholds. Replenish immediately to ensure smooth Gift-with-Purchase (GWP) POS allocations.</p>
            </div>
          </div>
          <div className="hidden md:flex gap-1 bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-mono text-red-300">
            {lowStockGifts.slice(0, 3).map(g => g.name.split(' ')[0]).join(', ')}
            {lowStockGifts.length > 3 && '...'}
          </div>
        </div>
      )}

      {/* Main Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100">Enterprise Gift Products Master</h1>
          <p className="text-xs text-slate-400">Track and manage complimentary giveaways, promotional merchandise, and brand gifts independently of apparel inventory.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/20 px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
          >
            <History className="w-4 h-4 text-amber-500/80" />
            Gift Stock Ledger
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/20 px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            Bulk Import CSV
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 gold-gradient text-slate-950 font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Create Gift Item
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Gift Name, SKU / Barcode, or Supplier..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="">All Gift Categories</option>
            {categoriesList.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border ${
              showLowStockOnly 
                ? 'bg-amber-500/10 border-amber-500 text-amber-300' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4.5 h-4.5" />
            Low Stock Alerts
          </button>
        </div>
      </div>

      {/* Gifts Table Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-4">Gift Details (Name / Barcode / SKU)</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4 text-right">MRP / Selling Price</th>
                <th className="py-4 px-4 text-right">Purchase Cost</th>
                <th className="py-4 px-4 text-center">Current Stock</th>
                <th className="py-4 px-4">Supplier</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {filteredGifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Package className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-[1.5]" />
                    No promotional gifts found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredGifts.map((gift) => {
                  const isLowStock = gift.currentStock <= gift.minStockAlert;
                  return (
                    <tr 
                      key={gift.id} 
                      className={`hover:bg-slate-950/20 transition-colors ${
                        isLowStock && gift.status === 'active' ? 'bg-red-500/[0.02]' : ''
                      }`}
                    >
                      {/* Name / Barcode / SKU */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            {gift.imageUrl ? (
                              <img 
                                src={gift.imageUrl} 
                                alt={gift.name} 
                                className="w-full h-full object-cover rounded-lg"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-amber-500/60" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-100 block truncate max-w-[240px]">
                              {gift.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                SKU: {gift.sku}
                              </span>
                              {gift.barcode && (
                                <span className="font-mono text-[10px] text-amber-500/80 bg-amber-500/[0.03] px-1.5 py-0.5 rounded border border-amber-500/10">
                                  BC: {gift.barcode}
                                </span>
                              )}
                              {(() => {
                                const brandObj = brandsList.find(b => b.id === gift.brand || b.name === gift.brand);
                                const bName = brandObj ? brandObj.name : (gift.brand || '');
                                if (!bName || bName === 'Generic' || bName === 'Unknown / Deleted') return null;
                                return (
                                  <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/10 font-medium">
                                    Brand: {bName}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-200">
                        <span className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-300">
                          <Tags className="w-3.5 h-3.5 text-amber-500/60" />
                          {(() => {
                            const cat = categoriesList.find(c => c.id === gift.category || c.name === gift.category);
                            return cat ? cat.name : 'Unknown / Deleted';
                          })()}
                        </span>
                      </td>

                      {/* MRP / Selling Price */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-slate-100">{formatINR(gift.mrp)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {gift.sellingPrice === 0 ? (
                            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">FREE (Promo)</span>
                          ) : (
                            <span>Customer Pays: {formatINR(gift.sellingPrice)}</span>
                          )}
                        </div>
                      </td>

                      {/* Purchase Cost */}
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {formatINR(gift.purchasePrice)}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`font-mono font-bold text-sm ${
                            isLowStock 
                              ? 'text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20' 
                              : 'text-slate-100'
                          }`}>
                            {gift.currentStock}
                          </span>
                          {isLowStock && (
                            <span className="text-[9px] text-red-300 mt-1 font-semibold animate-pulse">
                              Low (Min: {gift.minStockAlert})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4 text-slate-400 max-w-[150px] truncate">
                        {gift.supplier || 'N/A'}
                      </td>

                      {/* Status badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          gift.status === 'active' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}>
                          {gift.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenBarcode(gift)}
                            title="Print Barcode Labels"
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/20 text-slate-300 hover:text-amber-400 rounded-lg transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenAdjust(gift)}
                            title="Stock In/Out Quick Adjust"
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => handleOpenEdit(gift)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/20 text-slate-300 hover:text-sky-400 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(gift.id, gift.name)}
                            className="p-1.5 bg-slate-950 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* CREATE GIFT MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Add New Gift Product
              </h3>
              <button 
                onClick={() => setIsAddOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Gift Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. HydroFit Sports Bottle"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. GFT-BOT-001"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Barcode Value (Defaults to SKU)</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="e.g. 8901234001"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categoriesList.filter(c => c.status === 'active').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Brand (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none text-left flex justify-between items-center"
                  >
                    <span>
                      {(() => {
                        const brandObj = brandsList.find(b => b.id === formData.brand || b.name === formData.brand);
                        return brandObj ? brandObj.name : 'Generic / None';
                      })()}
                    </span>
                    <span className="text-slate-500 text-[10px]">▼</span>
                  </button>
                  
                  {isBrandDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-2 space-y-2 max-h-60 overflow-y-auto z-50">
                      <input
                        type="text"
                        placeholder="Search brands..."
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, brand: '' });
                            setIsBrandDropdownOpen(false);
                            setBrandSearch('');
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white rounded transition"
                        >
                          Generic / None (Optional)
                        </button>
                        {brandsList
                          .filter(b => b.status === 'active' && (b.name || '').toLowerCase().includes((brandSearch || '').toLowerCase()))
                          .map(brand => (
                            <button
                              key={brand.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, brand: brand.id });
                                setIsBrandDropdownOpen(false);
                                setBrandSearch('');
                              }}
                              className={`w-full text-left px-2 py-1 text-xs rounded transition flex items-center justify-between ${
                                formData.brand === brand.id 
                                  ? 'bg-amber-500/10 text-amber-300 font-bold' 
                                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <span>{brand.name}</span>
                              {formData.brand === brand.id && <Check className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                          ))
                        }
                        {brandsList.filter(b => b.status === 'active' && (b.name || '').toLowerCase().includes((brandSearch || '').toLowerCase())).length === 0 && (
                          <div className="text-[10px] text-slate-500 text-center py-2">No active brands found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Supplier</label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.name}>{sup.name}</option>
                    ))}
                    {suppliers.length === 0 && <option value="Sudarshan Corp">Sudarshan Corp</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">MRP Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.mrp || ''}
                    onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                    placeholder="Retail Price value"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Selling/Promo Price (Set ₹0 for FREE giveaway)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    placeholder="₹0 if complimentary"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.purchasePrice || ''}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    placeholder="Procurement cost"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Initial Opening Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock || ''}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    placeholder="Quantity in hand"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Minimum Stock Threshold Alert *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.minStockAlert || ''}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                    placeholder="Threshold for visual alerts"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Merchandise Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="active">Active (Available for POS GWP)</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Product Description / Notes</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details regarding quality materials, campaign uses, etc."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 gold-gradient text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md"
                >
                  Create Gift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GIFT MODAL */}
      {isEditOpen && selectedGift && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                Edit Gift Product: {selectedGift.name}
              </h3>
              <button 
                onClick={() => setIsEditOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Gift Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Barcode Value</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categoriesList.filter(c => c.status === 'active').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Brand (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none text-left flex justify-between items-center"
                  >
                    <span>
                      {(() => {
                        const brandObj = brandsList.find(b => b.id === formData.brand || b.name === formData.brand);
                        return brandObj ? brandObj.name : 'Generic / None';
                      })()}
                    </span>
                    <span className="text-slate-500 text-[10px]">▼</span>
                  </button>
                  
                  {isBrandDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-2 space-y-2 max-h-60 overflow-y-auto z-50">
                      <input
                        type="text"
                        placeholder="Search brands..."
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, brand: '' });
                            setIsBrandDropdownOpen(false);
                            setBrandSearch('');
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white rounded transition"
                        >
                          Generic / None (Optional)
                        </button>
                        {brandsList
                          .filter(b => b.status === 'active' && (b.name || '').toLowerCase().includes((brandSearch || '').toLowerCase()))
                          .map(brand => (
                            <button
                              key={brand.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, brand: brand.id });
                                setIsBrandDropdownOpen(false);
                                setBrandSearch('');
                              }}
                              className={`w-full text-left px-2 py-1 text-xs rounded transition flex items-center justify-between ${
                                formData.brand === brand.id 
                                  ? 'bg-amber-500/10 text-amber-300 font-bold' 
                                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <span>{brand.name}</span>
                              {formData.brand === brand.id && <Check className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                          ))
                        }
                        {brandsList.filter(b => b.status === 'active' && (b.name || '').toLowerCase().includes((brandSearch || '').toLowerCase())).length === 0 && (
                          <div className="text-[10px] text-slate-500 text-center py-2">No active brands found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Supplier</label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.name}>{sup.name}</option>
                    ))}
                    {suppliers.length === 0 && <option value="Sudarshan Corp">Sudarshan Corp</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">MRP Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Selling/Promo Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stock Level (Direct edit creates adjustment history) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Minimum Alert Threshold *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Merchandise Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="active">Active (Available for POS GWP)</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Product Description / Notes</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition hover:bg-sky-400"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {isAdjustOpen && selectedGift && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                Adjust Stock: {selectedGift.name}
              </h3>
              <button 
                onClick={() => setIsAdjustOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Stock:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedGift.currentStock} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SKU / Code:</span>
                  <span className="font-mono text-slate-300">{selectedGift.sku}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => {
                    const type = e.target.value as any;
                    setAdjustType(type);
                    if (type === 'stock-in') setAdjustReason('Regular stock replenishment');
                    else if (type === 'stock-out') setAdjustReason('POS manual checkout');
                    else if (type === 'damaged') setAdjustReason('Damaged / Defective stock write-off');
                    else setAdjustReason('Physical audit discrepancy adjustment');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="stock-in">Stock In (+ Increase)</option>
                  <option value="stock-out">Stock Out (- Decrease)</option>
                  <option value="adjustment">Stock Adjustment (Internal)</option>
                  <option value="damaged">Damaged / Defective (- Decrease)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty || ''}
                  onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Adjustment Reason / Notes *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Received new shipment, Damaged box, audit"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 text-[10px] text-amber-300/80 leading-relaxed">
                Saving this adjustment will instantly write a permanent transaction record into the exclusive **Gift Stock Ledger History** to preserve compliance.
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 gold-gradient text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md"
                >
                  Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARCODE PRINT LABEL MODAL */}
      {isBarcodeOpen && selectedGift && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-500" />
                Barcode Label Generator
              </h3>
              <button 
                onClick={() => setIsBarcodeOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Visual preview card */}
              <div className="bg-white p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center shadow-inner text-slate-900">
                <div className="w-[50mm] min-h-[25mm] p-2 bg-white flex flex-col items-center justify-center text-center">
                  {barcodeLabelTitle && (
                    <div className="text-[10px] font-bold text-black tracking-tight max-w-[150px] truncate">
                      {selectedGift.name}
                    </div>
                  )}
                  <div className="text-[8px] text-slate-500 font-semibold mb-1">SKU: {selectedGift.sku}</div>
                  
                  {/* Generated code128 SVG */}
                  <div className="w-full py-1">
                    {renderBarcodeSVG(selectedGift.sku, 32)}
                  </div>
                  
                  <div className="text-[9px] font-mono tracking-wider font-bold text-black">{selectedGift.sku}</div>
                  {barcodeLabelPrice && (
                    <div className="text-[10px] font-bold mt-1 text-black">MRP: {formatINR(selectedGift.mrp)}</div>
                  )}
                </div>
              </div>

              {/* Configurations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Include Item Name</span>
                  <input
                    type="checkbox"
                    checked={barcodeLabelTitle}
                    onChange={(e) => setBarcodeLabelTitle(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 bg-slate-950 rounded border-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Include MRP Price on Tag</span>
                  <input
                    type="checkbox"
                    checked={barcodeLabelPrice}
                    onChange={(e) => setBarcodeLabelPrice(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 bg-slate-950 rounded border-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Labels to Print (Quantity)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={barcodeQty}
                    onChange={(e) => setBarcodeQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBarcodeOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrintBarcodeLabels}
                  className="px-4 py-2 gold-gradient text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 transition hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4 stroke-[2.5]" />
                  Trigger Print Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Bulk Import Gifts
              </h3>
              <button 
                onClick={() => setIsImportOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-amber-300">CSV Paste Format (Comma or Tab Separated):</span>
                <p className="mt-1 font-mono text-[10px] text-slate-300">
                  Name, SKU, Barcode, Category, MRP, SellingPrice, PurchasePrice, Stock, MinAlert, Supplier, Description
                </p>
                <p className="mt-2 text-[10px] text-slate-400">
                  *Category must be configured in Category Master (e.g. {categoriesList.map(c => c.name).join(', ')})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Paste CSV / TSV Content Below</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="e.g.&#10;Premium Coffee Mug, GFT-MUG-001, 8901234006, Coffee Mug, 299, 0, 80, 100, 15, Sudarshan Corp, Ceramic matte mug&#10;Sporty Gym Cap, GFT-CAP-004, 8901234007, Cap, 199, 0, 45, 120, 20, Sporty Wearables, Cotton baseball mesh cap"
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none resize-none"
                />
              </div>

              {importError && (
                <div className="text-xs text-red-400 font-semibold bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  {importError}
                </div>
              )}

              {importSuccessMsg && (
                <div className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                  {importSuccessMsg}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  className="px-4 py-2 gold-gradient text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
                >
                  Process Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STOCK LEDGER HISTORY MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                Gifts Stock Ledger Logs
              </h3>
              <button 
                onClick={() => setIsHistoryOpen(false)} 
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Independent Audit Ledger</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Showing absolute transaction history for promo rewards, stock ins, physical count overrides, and damaged stock write-offs.</p>
                </div>
                <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                  Total Ledger Records: <span className="font-bold text-amber-400">{giftLogs.length}</span>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Date / Time</th>
                        <th className="py-3 px-4">Gift Item</th>
                        <th className="py-3 px-4 text-center">Type</th>
                        <th className="py-3 px-4 text-right">Adjustment</th>
                        <th className="py-3 px-4 text-right">Balance Stock</th>
                        <th className="py-3 px-4">Activity Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-[11px] text-slate-300">
                      {giftLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 font-semibold">
                            No ledger logs generated yet. Perform a Stock Adjustment or complete a checkout containing a gift to initialize ledger records.
                          </td>
                        </tr>
                      ) : (
                        giftLogs.map((log) => {
                          const associatedGift = gifts.find(g => g.id === log.giftId);
                          const itemName = log.giftName || (associatedGift ? associatedGift.name : 'Unknown Gift');
                          const itemSku = associatedGift ? associatedGift.sku : '';

                          return (
                            <tr key={log.id} className="hover:bg-slate-950/40 transition-colors">
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {new Date(log.date).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-200">
                                <div>{itemName}</div>
                                {itemSku && <div className="text-[9px] text-slate-500 font-mono mt-0.5">SKU: {itemSku}</div>}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                  log.type === 'stock-in' 
                                    ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400' 
                                    : log.type === 'stock-out'
                                      ? 'bg-blue-500/10 border-blue-500/10 text-blue-400'
                                      : log.type === 'damaged'
                                        ? 'bg-red-500/10 border-red-500/10 text-red-400'
                                        : 'bg-amber-500/10 border-amber-500/10 text-amber-400'
                                }`}>
                                  {log.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                                {log.type === 'stock-in' ? `+${log.quantity}` : `-${log.quantity}`}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-400">
                                {log.prevStock} → <span className="font-bold text-slate-200">{log.newStock}</span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 leading-relaxed">
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

            <div className="p-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Close Ledger
              </button>
            </div>
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
