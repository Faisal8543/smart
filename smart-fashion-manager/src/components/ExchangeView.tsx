/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import { ExchangeRecord, Invoice, Product } from '../types';
import {
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  DollarSign,
  Check,
  ShoppingBag,
  ShieldAlert,
  Shirt,
  X,
  FileText,
  Filter,
  Barcode,
} from 'lucide-react';

export const ExchangeView: React.FC = () => {
  const {
    invoices,
    products,
    exchanges,
    settings,
    addExchangeRecord,
    currentRole,
  } = useAppState();

  const [activeSubTab, setActiveSubTab] = useState<'create' | 'history'>('create');

  // Search invoice state
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [searchInvoiceNo, setSearchInvoiceNo] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Auto-focus search input when create tab is active and no invoice is loaded
  React.useEffect(() => {
    if (activeSubTab === 'create' && !selectedInvoice) {
      searchInputRef.current?.focus();
    }
  }, [activeSubTab, selectedInvoice]);

  // Policy checklists
  const [policyChecks, setPolicyChecks] = useState({
    invoiceProvided: false,
    tagsAttached: false,
    productUnused: false,
  });

  // Return cart (items customer brings back)
  const [returnCart, setReturnCart] = useState<
    Record<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        size: string;
        color: string;
        sellingPrice: number;
        originalQuantity: number;
        quantity: number;
      }
    >
  >({});

  // Replacement cart (new items given in exchange)
  const [exchangeCart, setExchangeCart] = useState<
    Record<
      string,
      {
        product: Product;
        productId: string;
        sku: string;
        name: string;
        size: string;
        color: string;
        sellingPrice: number;
        quantity: number;
      }
    >
  >({});

  // Product catalog search states for adding replacement items
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [selectedProdForExchange, setSelectedProdForExchange] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [newExchangeQty, setNewExchangeQty] = useState(1);

  // Settlement & payment state
  const [cashierNotes, setCashierNotes] = useState('');
  const [forfeitDifference, setForfeitDifference] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [customerPaidAmount, setCustomerPaidAmount] = useState<string>('');

  // Confirmation Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Processing success banner / modal
  const [processedExchange, setProcessedExchange] = useState<ExchangeRecord | null>(null);

  // Exchange logs filter and detail modal
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedLogRecord, setSelectedLogRecord] = useState<ExchangeRecord | null>(null);

  const policy = settings.exchangePolicy || {
    enabled: true,
    exchangePeriodDays: 7,
    originalInvoiceRequired: true,
    originalTagsRequired: true,
    productMustBeUnused: true,
    discountedProductsExchange: false,
    promotionalProductsExchange: false,
    refundAllowed: false,
    exchangeOnly: true,
    customPolicyText: 'Exchange within 7 days from purchase date with original invoice & tags.\nUnused items only.',
  };

  // Helper: Format Dates as DD/MM/YYYY
  const formatDateDMY = (dateObj: Date | string) => {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper: Format Dates as DD/MM/YYYY HH:mm
  const formatDateTimeDMY = (dateObj: Date | string) => {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day}/${month}/${year} ${time}`;
  };

  // Helper: Get Exchange Valid Until Date strictly from Original Purchase Date
  const getExchangeValidUntil = (invoice: Invoice): Date => {
    const periodDays = settings.exchangePolicy?.exchangePeriodDays ?? 7;
    const purchaseDate = new Date(invoice.date);
    return new Date(purchaseDate.getTime() + periodDays * 24 * 60 * 60 * 1000);
  };

  // Helper: Calculate exact timeline metrics for an invoice
  const getExchangeTimeline = (invoice: Invoice) => {
    const validUntil = getExchangeValidUntil(invoice);
    const purchaseDate = new Date(invoice.date);

    // Normalize timestamps to midnight for accurate calendar day calculations
    const d1 = new Date();
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(validUntil);
    d2.setHours(0, 0, 0, 0);

    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      purchaseDate,
      validUntil,
      daysRemaining: diffDays >= 0 ? diffDays : 0,
      expiredBy: diffDays < 0 ? Math.abs(diffDays) : 0,
      isExpired: diffDays < 0,
    };
  };

  // Helper: Get total quantities already exchanged per item SKU / product ID
  const getAlreadyExchangedQuantities = (invoiceNo: string) => {
    const counts: Record<string, number> = {};
    exchanges
      .filter((exc) => exc.originalInvoiceNo === invoiceNo)
      .forEach((exc) => {
        exc.exchangedItems.forEach((item) => {
          const key = `${item.productId}_${item.size}_${item.color || 'OS'}`;
          counts[key] = (counts[key] || 0) + item.quantity;
        });
      });
    return counts;
  };

  // Helper: Get invoice exchange status badge (ELIGIBLE, PARTIALLY EXCHANGED, FULLY EXCHANGED, EXPIRED, POLICY RESTRICTED)
  const getInvoiceExchangeStatus = (invoice: Invoice) => {
    if (!policy.enabled) {
      return { status: 'POLICY RESTRICTED' as const, reason: 'Exchange Policy is currently disabled in Settings.' };
    }

    const timeline = getExchangeTimeline(invoice);
    if (timeline.isExpired) {
      return { status: 'EXPIRED' as const, reason: `Exchange period of ${policy.exchangePeriodDays} days has expired.` };
    }

    const alreadyExchangedMap = getAlreadyExchangedQuantities(invoice.invoiceNo);
    let totalPurchasedQty = 0;
    let totalExchangedQty = 0;

    invoice.items.forEach((item) => {
      totalPurchasedQty += item.quantity;
      const key = `${item.productId}_${item.size}_${item.color || 'OS'}`;
      totalExchangedQty += alreadyExchangedMap[key] || 0;
    });

    if (totalPurchasedQty > 0 && totalExchangedQty >= totalPurchasedQty) {
      return { status: 'FULLY EXCHANGED' as const, reason: 'All products from this invoice have already been exchanged.' };
    }

    if (totalExchangedQty > 0) {
      return { status: 'PARTIALLY EXCHANGED' as const };
    }

    return { status: 'ELIGIBLE' as const };
  };

  // Helper: Determine product-level exchange eligibility and exact reason
  const getItemEligibility = (item: any, invoice: Invoice) => {
    if (!policy.enabled) {
      return { eligible: false, reason: 'Exchange policy is currently disabled.' };
    }

    const timeline = getExchangeTimeline(invoice);
    if (timeline.isExpired) {
      return { eligible: false, reason: 'Exchange period for this invoice has expired.' };
    }

    // Check discounted-product restriction
    const isDiscounted = (item.discount && item.discount > 0) || (item.originalSellingPrice && item.sellingPrice < item.originalSellingPrice);
    if (isDiscounted && !policy.discountedProductsExchange) {
      return { eligible: false, reason: 'Discounted product cannot be exchanged according to current policy.' };
    }

    // Check promotional-product restriction
    const isPromo = item.isGift || (invoice.appliedOffers && invoice.appliedOffers.length > 0) || (invoice.discountAmount && invoice.discountAmount > 0) || (invoice.discountCardDiscount && invoice.discountCardDiscount > 0);
    if (isPromo && !policy.promotionalProductsExchange) {
      return { eligible: false, reason: 'Promotional product cannot be exchanged according to current policy.' };
    }

    // Check duplicate exchange limits
    const alreadyExchangedMap = getAlreadyExchangedQuantities(invoice.invoiceNo);
    const key = `${item.productId}_${item.size}_${item.color || 'OS'}`;
    const exchanged = alreadyExchangedMap[key] || 0;
    const remaining = item.quantity - exchanged;
    if (remaining <= 0) {
      return { eligible: false, reason: 'This product has already been fully exchanged.' };
    }

    return { eligible: true, remaining };
  };

  // Core invoice lookup logic for both barcode scanner & manual search
  const performInvoiceLookup = (query: string) => {
    setSearchError(null);
    const cleanNo = (query || '').trim().toUpperCase();
    if (!cleanNo) {
      setSearchError('Please enter or scan an invoice number to query.');
      return;
    }

    const normalizedNo = cleanNo.replace(/\s+/g, '');
    const found = invoices.find((inv) => {
      const invNoUpper = (inv.invoiceNo || '').trim().toUpperCase();
      const invIdUpper = (inv.id || '').trim().toUpperCase();
      return (
        invNoUpper === cleanNo ||
        invIdUpper === cleanNo ||
        invNoUpper.replace(/\s+/g, '') === normalizedNo ||
        invIdUpper.replace(/\s+/g, '') === normalizedNo
      );
    });

    if (!found) {
      setSearchError(`Invoice not found: No sales record matching "${cleanNo}".`);
      return;
    }

    setSelectedInvoice(found);
    setSearchInvoiceNo(found.invoiceNo);
    setReturnCart({});
    setExchangeCart({});
    setProcessedExchange(null);
    setPolicyChecks({
      invoiceProvided: true,
      tagsAttached: false,
      productUnused: false,
    });
  };

  // Handle invoice query form submit
  const handleSearchInvoice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    performInvoiceLookup(searchInvoiceNo);
  };

  // Handle select recent invoice
  const handleSelectRecentInvoice = (inv: Invoice) => {
    setSearchInvoiceNo(inv.invoiceNo);
    setSelectedInvoice(inv);
    setSearchError(null);
    setReturnCart({});
    setExchangeCart({});
    setProcessedExchange(null);
    setPolicyChecks({
      invoiceProvided: true,
      tagsAttached: false,
      productUnused: false,
    });
  };

  // Modify return item quantity
  const handleToggleReturnItem = (origItem: any, adjust: number) => {
    if (!selectedInvoice) return;
    const colorVal = origItem.color || 'OS';
    const key = `${origItem.productId}_${origItem.size}_${colorVal}`;
    const current = returnCart[key];

    const eligibility = getItemEligibility(origItem, selectedInvoice);
    if (!eligibility.eligible && adjust === 1) {
      alert(`Restriction: ${eligibility.reason}`);
      return;
    }

    const maxAllowed = eligibility.remaining ?? origItem.quantity;

    if (adjust === 1) {
      const currentQty = current ? current.quantity : 0;
      if (currentQty >= maxAllowed) {
        alert(`Cannot exchange more than available quantity (${maxAllowed} unit(s) available).`);
        return;
      }

      setReturnCart((prev) => ({
        ...prev,
        [key]: {
          productId: origItem.productId,
          sku: origItem.sku || '',
          name: origItem.name,
          size: origItem.size,
          color: colorVal,
          sellingPrice: origItem.sellingPrice,
          originalQuantity: origItem.quantity,
          quantity: currentQty + 1,
        },
      }));
    } else if (adjust === -1) {
      if (!current) return;
      if (current.quantity <= 1) {
        const updated = { ...returnCart };
        delete updated[key];
        setReturnCart(updated);
      } else {
        setReturnCart((prev) => ({
          ...prev,
          [key]: {
            ...current,
            quantity: current.quantity - 1,
          },
        }));
      }
    }
  };

  // Quick Direct Size Exchange Shortcut
  const handleDirectSizeExchange = (origItem: any, newSize: string) => {
    // Find the product in catalog
    const catProd = products.find((p) => p.id === origItem.productId) || products.find((p) => p.name.toLowerCase() === origItem.name.toLowerCase());
    if (!catProd) {
      alert('Replacement product not found in current catalog.');
      return;
    }

    // Check stock
    if (catProd.currentStock <= 0) {
      alert(`Replacement product out of stock: ${catProd.name} is currently out of stock.`);
      return;
    }

    // Auto-select 1 qty of original item for return if not already in return cart
    const returnKey = `${origItem.productId}_${origItem.size}_${origItem.color || 'OS'}`;
    if (!returnCart[returnKey]) {
      handleToggleReturnItem(origItem, 1);
    }

    // Add replacement item
    const replKey = `${catProd.id}_${newSize}_${origItem.color || 'OS'}`;
    const existing = exchangeCart[replKey];
    const newQty = (existing ? existing.quantity : 0) + 1;

    if (newQty > catProd.currentStock) {
      alert(`Insufficient stock: Only ${catProd.currentStock} unit(s) available in inventory.`);
      return;
    }

    setExchangeCart((prev) => ({
      ...prev,
      [replKey]: {
        product: catProd,
        productId: catProd.id,
        sku: catProd.sku,
        name: catProd.name,
        size: newSize,
        color: origItem.color || 'OS',
        sellingPrice: catProd.sellingPrice,
        quantity: newQty,
      },
    }));
  };

  // Add items from catalog to replacement cart
  const handleAddExchangeItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdForExchange) return;
    if (!selectedSize) {
      alert('Please select a size for the replacement product.');
      return;
    }

    if (selectedProdForExchange.currentStock <= 0) {
      alert(`Replacement product out of stock: ${selectedProdForExchange.name} has 0 stock.`);
      return;
    }

    const key = `${selectedProdForExchange.id}_${selectedSize}_${selectedColor || 'OS'}`;
    const existing = exchangeCart[key];
    const newQty = (existing ? existing.quantity : 0) + newExchangeQty;

    if (newQty > selectedProdForExchange.currentStock) {
      alert(`Insufficient stock: Available stock is ${selectedProdForExchange.currentStock}.`);
      return;
    }

    setExchangeCart((prev) => ({
      ...prev,
      [key]: {
        product: selectedProdForExchange,
        productId: selectedProdForExchange.id,
        sku: selectedProdForExchange.sku,
        name: selectedProdForExchange.name,
        size: selectedSize,
        color: selectedColor || 'OS',
        sellingPrice: selectedProdForExchange.sellingPrice,
        quantity: newQty,
      },
    }));

    // Reset picker
    setSelectedProdForExchange(null);
    setSelectedSize('');
    setSelectedColor('');
    setNewExchangeQty(1);
    setProdSearchQuery('');
  };

  const handleRemoveExchangeItem = (key: string) => {
    setExchangeCart((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleAdjustExchangeQty = (key: string, adjust: number) => {
    const existing = exchangeCart[key];
    if (!existing) return;

    const updatedQty = existing.quantity + adjust;
    if (updatedQty <= 0) {
      handleRemoveExchangeItem(key);
    } else {
      if (updatedQty > existing.product.currentStock) {
        alert(`Insufficient stock: Available inventory is ${existing.product.currentStock}.`);
        return;
      }
      setExchangeCart((prev) => ({
        ...prev,
        [key]: {
          ...existing,
          quantity: updatedQty,
        },
      }));
    }
  };

  // Financial Calculations
  const totalReturnedValue = (Object.values(returnCart) as any[]).reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0
  );

  const totalNewValue = (Object.values(exchangeCart) as any[]).reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0
  );

  const rawBalance = totalNewValue - totalReturnedValue;
  const additionalAmountPaid = rawBalance > 0 ? rawBalance : 0;
  const rawRefundAmount = rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const refundAmount = policy.refundAllowed ? rawRefundAmount : 0;
  const isLowerValue = rawBalance < 0;
  const isExchangeOnlyRestricted = isLowerValue && policy.exchangeOnly && !policy.refundAllowed;

  // Validation before allowing exchange
  const validateExchange = (): { valid: boolean; error?: string } => {
    if (!selectedInvoice) return { valid: false, error: 'No invoice selected' };
    if (Object.keys(returnCart).length === 0) return { valid: false, error: 'Please select at least one product to return' };
    if (Object.keys(exchangeCart).length === 0) return { valid: false, error: 'Please select at least one replacement product' };

    if (policy.enabled) {
      const timeline = getExchangeTimeline(selectedInvoice);
      if (timeline.isExpired) {
        return { valid: false, error: 'Exchange period expired: Grace period has passed.' };
      }

      if (policy.originalInvoiceRequired && !policyChecks.invoiceProvided) {
        return { valid: false, error: 'Original invoice required: Please verify customer has the original invoice.' };
      }
      if (policy.originalTagsRequired && !policyChecks.tagsAttached) {
        return { valid: false, error: 'Original tags required: Please verify garment tags and barcodes are intact.' };
      }
      if (policy.productMustBeUnused && !policyChecks.productUnused) {
        return { valid: false, error: 'Product must be unused: Please verify garment is unused and unworn.' };
      }

      if (isExchangeOnlyRestricted) {
        return {
          valid: false,
          error: 'Lower value replacement not allowed: Exchange-only policy does not permit refunds. Add replacement items to equal or exceed the original value.',
        };
      }
    }

    // Validate replacement stock availability
    for (const key of Object.keys(exchangeCart)) {
      const item = exchangeCart[key];
      const liveProduct = products.find((p) => p.id === item.productId);
      const stock = liveProduct ? liveProduct.currentStock : item.product.currentStock;
      if (stock < item.quantity) {
        return {
          valid: false,
          error: `Replacement product out of stock: ${item.name} (${item.size}) has only ${stock} in stock, but ${item.quantity} requested.`,
        };
      }
    }

    return { valid: true };
  };

  const validationResult = validateExchange();

  // Execute Exchange
  const handleConfirmExchange = () => {
    const val = validateExchange();
    if (!val.valid || !selectedInvoice) {
      alert(val.error || 'Exchange failed to validate.');
      return;
    }

    const returnedItemsList = (Object.values(returnCart) as any[]).map((it) => ({
      productId: it.productId,
      sku: it.sku,
      name: it.name,
      size: it.size,
      color: it.color,
      quantity: it.quantity,
      sellingPrice: it.sellingPrice,
    }));

    const newItemsList = (Object.values(exchangeCart) as any[]).map((it) => ({
      productId: it.productId,
      sku: it.sku,
      name: it.name,
      size: it.size,
      color: it.color,
      quantity: it.quantity,
      sellingPrice: it.sellingPrice,
    }));

    const exchangeId = `EXC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const res = addExchangeRecord({
      originalInvoiceNo: selectedInvoice.invoiceNo,
      originalSaleId: selectedInvoice.id,
      originalPurchaseDate: selectedInvoice.date,
      customerName: selectedInvoice.customerPhone
        ? `${selectedInvoice.customerName || 'Customer'} (${selectedInvoice.customerPhone})`
        : selectedInvoice.customerName || 'Walk-in Customer',
      exchangedItems: returnedItemsList,
      newItems: newItemsList,
      additionalAmountPaid: additionalAmountPaid,
      refundAmount: refundAmount,
      cashierName: currentRole === 'admin' ? 'System Administrator' : 'Sales Cashier',
      status: 'Completed',
      notes: cashierNotes.trim(),
    });

    if (res.success && res.exchange) {
      setShowConfirmModal(false);
      setProcessedExchange(res.exchange);
      // Clean up input fields
      setSelectedInvoice(null);
      setReturnCart({});
      setExchangeCart({});
      setSearchInvoiceNo('');
      setCashierNotes('');
      setCustomerPaidAmount('');
      setForfeitDifference(false);
    } else {
      alert(res.message || 'Exchange failed. Please check stock and settings.');
    }
  };

  // Filtered products for catalog autocomplete
  const filteredProducts = prodSearchQuery.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(prodSearchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(prodSearchQuery.toLowerCase())
      )
    : [];

  // Filtered logs
  const filteredExchangeLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return exchanges;
    const q = logSearchQuery.toLowerCase();
    return exchanges.filter(
      (exc) =>
        exc.id.toLowerCase().includes(q) ||
        exc.originalInvoiceNo.toLowerCase().includes(q) ||
        (exc.customerName && exc.customerName.toLowerCase().includes(q)) ||
        (exc.cashierName && exc.cashierName.toLowerCase().includes(q))
    );
  }, [exchanges, logSearchQuery]);

  const changeDue =
    additionalAmountPaid > 0 && customerPaidAmount
      ? Math.max(0, Number(customerPaidAmount) - additionalAmountPaid)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-amber-100 uppercase tracking-wider">Product Exchange Desk</h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Policy-enforced garment returns, sizing swaps, and real-time inventory adjustment
            </p>
          </div>
        </div>

        {/* View Switch */}
        <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-850 self-start md:self-auto">
          <button
            type="button"
            id="tab-create-exchange"
            onClick={() => setActiveSubTab('create')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeSubTab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Exchange
          </button>
          <button
            type="button"
            id="tab-exchange-logs"
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Exchange Logs ({exchanges.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search & Invoice Verification (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Search Invoice Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] uppercase font-bold text-amber-500/90 tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4" /> Search Invoice
                </h3>
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50">
                  <Barcode className="w-3.5 h-3.5 text-amber-400" /> Scanner Ready
                </span>
              </div>

              <form onSubmit={handleSearchInvoice} className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      required
                      autoFocus
                      id="exchange-invoice-search-input"
                      placeholder="Scan bill barcode or type SF/2026/0161..."
                      value={searchInvoiceNo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchInvoiceNo(val);
                        // Instant match if scanner sends/pastes exact code without submitting
                        const clean = val.trim().toUpperCase();
                        if (clean.length >= 8) {
                          const exact = invoices.find(
                            (inv) =>
                              inv.invoiceNo.trim().toUpperCase() === clean ||
                              inv.id.trim().toUpperCase() === clean
                          );
                          if (exact) {
                            performInvoiceLookup(clean);
                          }
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono tracking-wide"
                    />
                  </div>
                  <button
                    type="submit"
                    id="exchange-invoice-query-btn"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-amber-500/10 cursor-pointer flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Query
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  Tip: Point barcode scanner at the barcode at the bottom of the printed bill or type the invoice number manually.
                </p>
              </form>

              {searchError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-[11px] text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Recent Invoices from real POS data */}
              {invoices.length > 0 && !selectedInvoice && (
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                    Recent Invoices from POS Billing:
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {invoices.slice(0, 5).map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => handleSelectRecentInvoice(inv)}
                        className="w-full text-left bg-slate-950/40 border border-slate-850 hover:bg-slate-950 hover:border-amber-500/30 p-2.5 rounded-xl transition text-[11px] flex justify-between items-center group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-bold text-slate-300 group-hover:text-amber-400 truncate">
                            {inv.invoiceNo}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            {inv.customerName || 'Walk-in'} • {formatDateDMY(inv.date)} • {inv.items.length} item(s)
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-slate-200 font-mono">Rs. {inv.grandTotal}</p>
                          <ChevronRight className="w-4 h-4 text-slate-600 inline-block group-hover:text-amber-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Success Notification */}
            {processedExchange && (
              <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl p-5 space-y-3.5 shadow-lg animate-fadeIn text-xs">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  <CheckCircle className="w-5 h-5" />
                  Exchange Processed Successfully!
                </div>
                <div className="bg-slate-950/60 border border-emerald-500/10 p-3.5 rounded-xl font-mono text-[10px] text-slate-300 space-y-1.5">
                  <p><span className="text-slate-500">Exchange ID:</span> <strong className="text-amber-400">{processedExchange.id}</strong></p>
                  <p><span className="text-slate-500">Original Invoice:</span> {processedExchange.originalInvoiceNo}</p>
                  <p><span className="text-slate-500">Date:</span> {formatDateTimeDMY(processedExchange.date)}</p>
                  <p><span className="text-slate-500">Items Returned:</span> {processedExchange.exchangedItems.length}</p>
                  <p><span className="text-slate-500">Items Issued:</span> {processedExchange.newItems.length}</p>
                  {processedExchange.additionalAmountPaid > 0 && (
                    <p className="text-amber-400"><span className="text-slate-500">Difference Paid:</span> Rs. {processedExchange.additionalAmountPaid.toFixed(2)}</p>
                  )}
                  {processedExchange.refundAmount && processedExchange.refundAmount > 0 ? (
                    <p className="text-emerald-400"><span className="text-slate-500">Refund Amount:</span> Rs. {processedExchange.refundAmount.toFixed(2)}</p>
                  ) : null}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProcessedExchange(null);
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold uppercase rounded-xl tracking-wider text-[10px] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* 2. Verified Invoice Details & Policy Audit */}
            {selectedInvoice && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-lg text-xs">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                  <div>
                    <h4 className="font-serif text-sm font-bold text-slate-200">Invoice Verification</h4>
                    <span className="font-mono text-[10px] text-slate-500">Invoice: {selectedInvoice.invoiceNo}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInvoice(null);
                      setReturnCart({});
                      setExchangeCart({});
                    }}
                    className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold"
                  >
                    Clear
                  </button>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-850 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Purchase Date</span>
                    <span className="text-slate-200 font-bold">{formatDateDMY(selectedInvoice.date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Payment Mode</span>
                    <span className="text-slate-200 font-bold uppercase">{selectedInvoice.paymentMethod || 'CASH'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Customer</span>
                    <span className="text-slate-200 font-bold truncate block">{selectedInvoice.customerName || 'Walk-in'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Original Total</span>
                    <span className="text-amber-400 font-black">Rs. {selectedInvoice.grandTotal}</span>
                  </div>
                </div>

                {/* TIMELINE & EXCHANGE VALIDITY CALCULATION */}
                {(() => {
                  const timeline = getExchangeTimeline(selectedInvoice);
                  const statusInfo = getInvoiceExchangeStatus(selectedInvoice);

                  let badgeColors = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                  if (statusInfo.status === 'EXPIRED') {
                    badgeColors = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                  } else if (statusInfo.status === 'FULLY EXCHANGED') {
                    badgeColors = 'bg-slate-500/10 border-slate-500/20 text-slate-400';
                  } else if (statusInfo.status === 'PARTIALLY EXCHANGED') {
                    badgeColors = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                  } else if (statusInfo.status === 'POLICY RESTRICTED') {
                    badgeColors = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                  }

                  return (
                    <div className="space-y-4 border-t border-slate-800/85 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Exchange Status</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeColors}`}>
                          {statusInfo.status}
                        </span>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl space-y-2 text-[11px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Purchase Date:</span>
                          <span className="text-slate-300 font-bold">{formatDateDMY(timeline.purchaseDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Exchange Period:</span>
                          <span className="text-slate-300 font-bold">{policy.exchangePeriodDays} Days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Exchange Valid Until:</span>
                          <span className="text-amber-400 font-bold">{formatDateDMY(timeline.validUntil)}</span>
                        </div>

                        {timeline.isExpired ? (
                          <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-slate-900">
                            <span>Expired By:</span>
                            <span>{timeline.expiredBy} Days Ago</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-slate-900">
                            <span>Days Remaining:</span>
                            <span>{timeline.daysRemaining} Days</span>
                          </div>
                        )}
                      </div>

                      {/* Expired warning */}
                      {timeline.isExpired && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center space-y-1">
                          <p className="font-black uppercase tracking-wider text-rose-400 text-[10.5px]">EXCHANGE PERIOD EXPIRED</p>
                          <p className="text-[9.5px] text-slate-400 leading-snug">
                            This invoice was purchased on {formatDateDMY(timeline.purchaseDate)} and validity ended on {formatDateDMY(timeline.validUntil)}. Exchanges are locked.
                          </p>
                        </div>
                      )}

                      {/* Policy Verification Checklist */}
                      {policy.enabled && !timeline.isExpired && statusInfo.status !== 'FULLY EXCHANGED' && (
                        <div className="space-y-3 pt-1">
                          <h5 className="text-[10px] uppercase font-bold text-amber-500/90 tracking-widest flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> Exchange Policy Checklist
                          </h5>

                          <div className="space-y-2 text-[11px]">
                            {policy.originalInvoiceRequired && (
                              <label className="flex items-center justify-between p-2.5 bg-slate-950/30 border border-slate-850 hover:bg-slate-950/60 rounded-xl cursor-pointer transition select-none">
                                <span className="text-slate-300 font-medium">Original Invoice Produced</span>
                                <input
                                  type="checkbox"
                                  checked={policyChecks.invoiceProvided}
                                  onChange={(e) => setPolicyChecks({ ...policyChecks, invoiceProvided: e.target.checked })}
                                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                                />
                              </label>
                            )}

                            {policy.originalTagsRequired && (
                              <label className="flex items-center justify-between p-2.5 bg-slate-950/30 border border-slate-850 hover:bg-slate-950/60 rounded-xl cursor-pointer transition select-none">
                                <span className="text-slate-300 font-medium">Original Garment Tags Attached</span>
                                <input
                                  type="checkbox"
                                  checked={policyChecks.tagsAttached}
                                  onChange={(e) => setPolicyChecks({ ...policyChecks, tagsAttached: e.target.checked })}
                                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                                />
                              </label>
                            )}

                            {policy.productMustBeUnused && (
                              <label className="flex items-center justify-between p-2.5 bg-slate-950/30 border border-slate-850 hover:bg-slate-950/60 rounded-xl cursor-pointer transition select-none">
                                <span className="text-slate-300 font-medium">Product Must Be Unused & Clean</span>
                                <input
                                  type="checkbox"
                                  checked={policyChecks.productUnused}
                                  onChange={(e) => setPolicyChecks({ ...policyChecks, productUnused: e.target.checked })}
                                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right Column: Return Selection & Replacement Cart (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedInvoice ? (
              (() => {
                const timeline = getExchangeTimeline(selectedInvoice);
                if (timeline.isExpired) {
                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-lg text-xs flex flex-col items-center justify-center min-h-[300px]">
                      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h3 className="font-serif text-lg font-bold text-rose-400 uppercase tracking-wider">Exchange Period Expired</h3>
                      <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                        Purchase Date: <strong className="text-slate-200">{formatDateDMY(timeline.purchaseDate)}</strong>. 
                        Configured Exchange Grace Period: <strong className="text-slate-200">{policy.exchangePeriodDays} days</strong>. 
                        Validity expired on <strong className="text-slate-200">{formatDateDMY(timeline.validUntil)}</strong>. 
                        According to store exchange policy, exchanges are no longer permitted for this invoice.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* SECTION 4 & 5: INVOICE PRODUCTS SELECTION TABLE */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg text-xs">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-[11px] uppercase font-bold text-amber-500/90 tracking-widest flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" /> 1. Select Products for Exchange (Invoice Items)
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {selectedInvoice.items.length} item(s) on bill
                        </span>
                      </div>

                      <div className="space-y-3">
                        {selectedInvoice.items.map((item) => {
                          const colorVal = item.color || 'OS';
                          const key = `${item.productId}_${item.size}_${colorVal}`;
                          const inCart = returnCart[key]?.quantity || 0;

                          const alreadyExchangedMap = getAlreadyExchangedQuantities(selectedInvoice.invoiceNo);
                          const alreadyExchanged = alreadyExchangedMap[key] || 0;
                          const availableQty = Math.max(0, item.quantity - alreadyExchanged);
                          const eligibility = getItemEligibility(item, selectedInvoice);

                          // Find matching catalog product for quick size swapping
                          const catProd = products.find((p) => p.id === item.productId) || products.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
                          const availableSizes = catProd?.sizes || ['32', '34', '36', '38', '40', '42', 'S', 'M', 'L', 'XL'];

                          return (
                            <div
                              key={key}
                              className={`p-3.5 rounded-xl border transition-all ${
                                !eligibility.eligible
                                  ? 'bg-rose-500/5 border-rose-500/15 opacity-80'
                                  : inCart > 0
                                  ? 'bg-amber-500/5 border-amber-500/30 text-amber-100'
                                  : 'bg-slate-950/40 border-slate-850'
                              } space-y-2.5`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-100 text-xs">{item.name}</p>
                                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-400">
                                      SKU: {item.sku || 'N/A'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono text-amber-400 font-bold">
                                      Size: {item.size}
                                    </span>
                                    {colorVal !== 'OS' && (
                                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-400">
                                        Color: {colorVal}
                                      </span>
                                    )}
                                  </div>

                                  {/* Item quantities breakdown */}
                                  <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
                                    <span>Original Qty: <strong className="text-slate-200">{item.quantity}</strong></span>
                                    <span>Already Exchanged: <strong className={alreadyExchanged > 0 ? 'text-amber-400' : 'text-slate-400'}>{alreadyExchanged}</strong></span>
                                    <span>Available: <strong className={availableQty > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>{availableQty}</strong></span>
                                    <span>Rate: <strong className="text-slate-200">Rs. {item.sellingPrice}</strong></span>
                                  </div>
                                </div>

                                {/* Return selector button */}
                                {eligibility.eligible && availableQty > 0 ? (
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleReturnItem(item, -1)}
                                        disabled={inCart === 0}
                                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded disabled:opacity-30 cursor-pointer"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="w-8 text-center font-mono font-bold text-slate-200 text-xs">
                                        {inCart}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleReturnItem(item, 1)}
                                        disabled={inCart >= availableQty}
                                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded disabled:opacity-30 cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Selected: <strong className="text-amber-400">{inCart}</strong>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="shrink-0 self-end sm:self-center">
                                    <span className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[9px] uppercase tracking-wider">
                                      {availableQty === 0 ? 'FULLY EXCHANGED' : 'NOT ELIGIBLE'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Restriction reason display */}
                              {!eligibility.eligible && (
                                <div className="text-[9.5px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-start gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>{eligibility.reason}</span>
                                </div>
                              )}

                              {/* SECTION 7: FAST SIZE EXCHANGE SHORTCUT */}
                              {eligibility.eligible && availableQty > 0 && catProd && (
                                <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap text-[10px]">
                                  <span className="text-slate-400 flex items-center gap-1 font-bold text-[9px] uppercase">
                                    <Shirt className="w-3 h-3 text-amber-500" /> Fast Size Swap:
                                  </span>
                                  {availableSizes.map((sz) => {
                                    const isCurrentSize = sz === item.size;
                                    return (
                                      <button
                                        key={sz}
                                        type="button"
                                        onClick={() => handleDirectSizeExchange(item, sz)}
                                        disabled={isCurrentSize || catProd.currentStock <= 0}
                                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                                          isCurrentSize
                                            ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                                            : 'bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-slate-300 hover:text-amber-400'
                                        }`}
                                        title={isCurrentSize ? 'Current size' : `Exchange to size ${sz}`}
                                      >
                                        Size {sz}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {totalReturnedValue > 0 && (
                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs">
                          <span className="text-slate-400 font-sans font-bold uppercase text-[10px]">
                            Total Returned Product Value:
                          </span>
                          <span className="text-emerald-400 font-black text-sm">
                            Rs. {totalReturnedValue.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* SECTION 6: SELECT REPLACEMENT PRODUCT */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg text-xs">
                      <h3 className="text-[11px] uppercase font-bold text-amber-500/90 tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                        <Plus className="w-4 h-4" /> 2. Select Replacement Product (Products & Catalog Data)
                      </h3>

                      {/* Product Catalog Search */}
                      <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Search Replacement From Catalog
                        </span>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                          <input
                            type="text"
                            id="replacement-product-search"
                            placeholder="Search replacement by product name, SKU, or category..."
                            value={prodSearchQuery}
                            onChange={(e) => setProdSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Autocomplete Results */}
                        {filteredProducts.length > 0 && (
                          <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-850 shadow-xl">
                            {filteredProducts.slice(0, 6).map((p) => {
                              const isOutOfStock = p.currentStock <= 0;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={() => {
                                    setSelectedProdForExchange(p);
                                    setSelectedSize(p.sizes && p.sizes.length > 0 ? p.sizes[0] : 'M');
                                    setSelectedColor(p.colors && p.colors.length > 0 ? p.colors[0] : 'Black');
                                    setProdSearchQuery('');
                                  }}
                                  className={`w-full text-left p-2.5 transition flex justify-between items-center text-xs ${
                                    isOutOfStock
                                      ? 'opacity-50 bg-slate-950/40 cursor-not-allowed'
                                      : 'hover:bg-slate-950 cursor-pointer'
                                  }`}
                                >
                                  <div>
                                    <p className="font-bold text-slate-200">{p.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      SKU: {p.sku} | Cat: {p.category} | Stock: {p.currentStock}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-amber-500 font-mono">Rs. {p.sellingPrice}</span>
                                    {isOutOfStock ? (
                                      <p className="text-[9px] text-rose-400 font-bold uppercase">OUT OF STOCK</p>
                                    ) : (
                                      <p className="text-[9px] text-emerald-400 font-mono">In Stock ({p.currentStock})</p>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Selected Replacement Configuration Form */}
                        {selectedProdForExchange && (
                          <form onSubmit={handleAddExchangeItem} className="pt-2 border-t border-slate-800/80 space-y-3">
                            <div className="p-2.5 bg-slate-950 rounded-lg flex justify-between items-center border border-slate-850 text-xs">
                              <div>
                                <span className="font-bold text-slate-200 block">{selectedProdForExchange.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  Available Stock: <strong className="text-emerald-400">{selectedProdForExchange.currentStock}</strong>
                                </span>
                              </div>
                              <span className="font-bold text-amber-500 font-mono text-sm">
                                Rs. {selectedProdForExchange.sellingPrice}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              {/* Size */}
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Size</label>
                                <select
                                  value={selectedSize}
                                  onChange={(e) => setSelectedSize(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 focus:outline-none text-xs cursor-pointer"
                                >
                                  {(selectedProdForExchange.sizes || ['S', 'M', 'L', 'XL']).map((sz) => (
                                    <option key={sz} value={sz}>
                                      {sz}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Color */}
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Color</label>
                                <select
                                  value={selectedColor}
                                  onChange={(e) => setSelectedColor(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 focus:outline-none text-xs cursor-pointer"
                                >
                                  {(selectedProdForExchange.colors || ['Black', 'White', 'Blue', 'Navy']).map((col) => (
                                    <option key={col} value={col}>
                                      {col}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Qty */}
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Qty</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={selectedProdForExchange.currentStock}
                                  required
                                  value={newExchangeQty}
                                  onChange={(e) => setNewExchangeQty(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-slate-200 text-center text-xs font-mono"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedProdForExchange(null)}
                                className="flex-1 py-1.5 border border-slate-800 hover:bg-slate-900 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer shadow-md"
                              >
                                Add Replacement Item
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                      {/* Replacement Cart Items List */}
                      {Object.keys(exchangeCart).length > 0 ? (
                        <div className="space-y-2">
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {(Object.entries(exchangeCart) as [string, any][]).map(([key, item]) => (
                              <div
                                key={key}
                                className="p-3 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-slate-200">{item.name}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                    Size: {item.size} | Color: {item.color} | SKU: {item.sku} | Stock: {item.product.currentStock}
                                  </p>
                                </div>

                                <div className="flex items-center gap-4 shrink-0 font-mono">
                                  <span className="text-slate-300 font-bold">
                                    Rs. {(item.sellingPrice * item.quantity).toFixed(2)}
                                  </span>

                                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustExchangeQty(key, -1)}
                                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-6 text-center font-bold text-slate-300 text-xs">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustExchangeQty(key, 1)}
                                      disabled={item.quantity >= item.product.currentStock}
                                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded cursor-pointer disabled:opacity-30"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExchangeItem(key)}
                                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition cursor-pointer"
                                    title="Remove Item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs">
                            <span className="text-slate-400 uppercase font-sans font-bold text-[10px]">
                              Total Replacement Value:
                            </span>
                            <span className="text-amber-400 font-black text-sm">
                              Rs. {totalNewValue.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-500 italic border-2 border-dashed border-slate-850 rounded-xl bg-slate-950/20 text-xs">
                          No replacement items selected yet. Use fast size swap above or search catalog.
                        </div>
                      )}
                    </div>

                    {/* SECTION 8 & 9: SETTLEMENT, PRICE DIFFERENCE & CONFIRM EXCHANGE */}
                    {Object.keys(returnCart).length > 0 && Object.keys(exchangeCart).length > 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-lg text-xs">
                        <h3 className="text-[11px] uppercase font-bold text-amber-500/90 tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                          <DollarSign className="w-4 h-4" /> 3. Settlement & Price Difference
                        </h3>

                        {/* Price Breakdown */}
                        <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl font-mono text-[11px] space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Replacement Items Value (+):</span>
                            <span className="text-slate-200 font-bold">Rs. {totalNewValue.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-850 pb-2 mb-2">
                            <span className="text-slate-400">Total Returned Items Credit (-):</span>
                            <span className="text-emerald-400 font-bold">-Rs. {totalReturnedValue.toFixed(2)}</span>
                          </div>

                          {/* SECTION 8: AUTOMATIC PRICE DIFFERENCE COMPUTATION */}
                          {rawBalance > 0 ? (
                            <div className="space-y-3 pt-1">
                              <div className="flex justify-between items-center font-bold text-amber-400 text-sm">
                                <span>CUSTOMER TO PAY:</span>
                                <span>Rs. {additionalAmountPaid.toFixed(2)}</span>
                              </div>

                              {/* Payment Mode Selection */}
                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850 font-sans">
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                    Payment Mode
                                  </label>
                                  <select
                                    value={newPaymentMethod}
                                    onChange={(e) => setNewPaymentMethod(e.target.value as any)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none text-xs cursor-pointer"
                                  >
                                    <option value="cash">💵 Cash</option>
                                    <option value="upi">📱 UPI</option>
                                    <option value="card">💳 Card</option>
                                  </select>
                                </div>

                                {newPaymentMethod === 'cash' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                      Cash Received
                                    </label>
                                    <input
                                      type="text"
                                      placeholder={`e.g. ${Math.ceil(additionalAmountPaid)}`}
                                      value={customerPaidAmount}
                                      onChange={(e) => setCustomerPaidAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono"
                                    />
                                  </div>
                                )}
                              </div>

                              {newPaymentMethod === 'cash' && customerPaidAmount && (
                                <div className="flex justify-between items-center font-mono text-[11px] text-slate-400 pt-1">
                                  <span>Cash Change Returned:</span>
                                  <span className="text-emerald-400 font-bold">Rs. {changeDue.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          ) : rawBalance < 0 ? (
                            <div className="space-y-2.5 pt-1">
                              <div className="flex justify-between items-center font-bold text-emerald-400 text-sm">
                                <span>REFUND DUE:</span>
                                <span>Rs. {rawRefundAmount.toFixed(2)}</span>
                              </div>

                              {policy.refundAllowed ? (
                                <p className="text-[10px] text-emerald-400 font-sans leading-relaxed bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                                  Refund Approved: Issue Rs. {refundAmount.toFixed(2)} refund to customer.
                                </p>
                              ) : (
                                <div className="space-y-2 font-sans">
                                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                                    <p className="font-bold text-amber-400 text-xs uppercase tracking-wider">
                                      LOWER VALUE REPLACEMENT NOT ALLOWED
                                    </p>
                                    <p className="text-[10px] text-slate-400 leading-snug">
                                      Exchange-only policy does not permit refunds. Please add additional replacement items to equal or exceed the return value.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-between items-center font-bold text-emerald-400 text-xs pt-1">
                              <span>NO ADDITIONAL PAYMENT:</span>
                              <span>Even Exchange (Rs. 0.00)</span>
                            </div>
                          )}
                        </div>

                        {/* Cashier Notes */}
                        <div className="space-y-1.5 font-sans">
                          <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                            Cashier Notes (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={cashierNotes}
                            onChange={(e) => setCashierNotes(e.target.value)}
                            placeholder="e.g. Size 32 exchanged for Size 34 per customer request..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                          />
                        </div>

                        {/* Validation Error Banner */}
                        {!validationResult.valid && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-400 text-[11px]">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{validationResult.error}</span>
                          </div>
                        )}

                        {/* CONFIRM EXCHANGE TRIGGER BUTTON */}
                        <button
                          type="button"
                          id="exchange-confirm-review-btn"
                          disabled={!validationResult.valid}
                          onClick={() => setShowConfirmModal(true)}
                          className="w-full gold-gradient disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-slate-950 font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Check className="w-4 h-4" />
                          CONFIRM EXCHANGE
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="py-24 text-center text-slate-500 italic font-serif border-2 border-dashed border-slate-850 rounded-2xl bg-slate-900/40 shadow-inner space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No active query. Search and query an invoice on the left to start returns.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SECTION 15: EXCHANGE LOGS TAB */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm uppercase font-bold text-slate-200 tracking-wider">Exchange History & Audit Logs</h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Showing {filteredExchangeLogs.length} of {exchanges.length} exchange transactions
              </p>
            </div>

            {/* Filter Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Filter by invoice, customer, ID..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="px-4 py-3">Exchange ID</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Original Product(s)</th>
                  <th className="px-4 py-3">Replacement Product(s)</th>
                  <th className="px-4 py-3">Amount Diff</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-[11px]">
                {filteredExchangeLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500 font-mono italic">
                      No exchange records found.
                    </td>
                  </tr>
                ) : (
                  filteredExchangeLogs.map((exc) => (
                    <tr key={exc.id} className="hover:bg-slate-950/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-amber-400 select-all">{exc.id}</td>
                      <td className="px-4 py-3 font-mono text-slate-300 font-bold">{exc.originalInvoiceNo}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{formatDateTimeDMY(exc.date)}</td>
                      <td className="px-4 py-3 text-slate-300 font-medium truncate max-w-[140px]">
                        {exc.customerName || 'Walk-in'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[9px] uppercase">
                          {exc.exchangedItems.length} Returned
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[9px] uppercase">
                          {exc.newItems.length} Issued
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {exc.additionalAmountPaid > 0 ? (
                          <span className="text-amber-400">+Rs. {exc.additionalAmountPaid.toFixed(2)}</span>
                        ) : exc.refundAmount && exc.refundAmount > 0 ? (
                          <span className="text-emerald-400">-Rs. {exc.refundAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">Rs. 0.00</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-[120px]">
                        {exc.cashierName || 'Sales Cashier'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                          COMPLETED
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLogRecord(exc)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                            title="View Details"
                          >
                            <FileText className="w-3.5 h-3.5" />
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
      )}

      {/* SECTION 9: CONFIRM EXCHANGE SUMMARY MODAL */}
      {showConfirmModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-6 text-xs font-sans">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-serif">
                    Confirm Product Exchange
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">Original Invoice: {selectedInvoice.invoiceNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Details */}
            <div className="space-y-3 font-mono">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Customer</span>
                  <span className="text-slate-200 font-bold truncate block">{selectedInvoice.customerName || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Policy Status</span>
                  <span className="text-emerald-400 font-bold uppercase">COMPLIANT & AUTHORIZED</span>
                </div>
              </div>

              {/* Items Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Returned */}
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1 font-sans">
                    <Minus className="w-3.5 h-3.5" /> Returned Items ({Object.keys(returnCart).length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto text-[10px]">
                    {(Object.values(returnCart) as any[]).map((it, idx) => (
                      <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-300">
                        <span className="truncate max-w-[170px]">{it.name} ({it.size}) ×{it.quantity}</span>
                        <span className="font-bold">Rs. {(it.sellingPrice * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-900 font-bold text-[11px]">
                    <span className="text-slate-400">Total Returned:</span>
                    <span className="text-emerald-400">Rs. {totalReturnedValue.toFixed(2)}</span>
                  </div>
                </div>

                {/* Replacement */}
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1 font-sans">
                    <Plus className="w-3.5 h-3.5" /> Replacement Items ({Object.keys(exchangeCart).length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto text-[10px]">
                    {(Object.values(exchangeCart) as any[]).map((it, idx) => (
                      <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-300">
                        <span className="truncate max-w-[170px]">{it.name} ({it.size}) ×{it.quantity}</span>
                        <span className="font-bold">Rs. {(it.sellingPrice * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-900 font-bold text-[11px]">
                    <span className="text-slate-400">Total Replacement:</span>
                    <span className="text-amber-400">Rs. {totalNewValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Settlement Summary */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                <span className="text-slate-300 font-sans font-bold uppercase">Net Settlement:</span>
                {additionalAmountPaid > 0 ? (
                  <span className="text-amber-400 font-black text-sm font-mono">
                    Customer Pays: Rs. {additionalAmountPaid.toFixed(2)} ({newPaymentMethod.toUpperCase()})
                  </span>
                ) : refundAmount > 0 ? (
                  <span className="text-emerald-400 font-black text-sm font-mono">
                    Refund: Rs. {refundAmount.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-black text-sm font-mono">
                    Even Exchange (Rs. 0.00)
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase rounded-xl tracking-wider text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="exchange-modal-confirm-btn"
                onClick={handleConfirmExchange}
                className="flex-1 gold-gradient text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirm & Deduct Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL FOR LOGS */}
      {selectedLogRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-6 text-xs font-sans">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-serif">
                  Exchange Transaction Details
                </h3>
                <p className="text-[10px] text-amber-400 font-mono">ID: {selectedLogRecord.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogRecord(null)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Original Invoice</span>
                <span className="text-slate-200 font-bold">{selectedLogRecord.originalInvoiceNo}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Exchange Date</span>
                <span className="text-slate-200 font-bold">{formatDateTimeDMY(selectedLogRecord.date)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Customer</span>
                <span className="text-slate-200 font-bold truncate block">{selectedLogRecord.customerName || 'Walk-in'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Cashier</span>
                <span className="text-slate-200 font-bold">{selectedLogRecord.cashierName || 'Sales Cashier'}</span>
              </div>
            </div>

            {/* Returned Items */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1 font-mono">
                <Minus className="w-3.5 h-3.5" /> Returned Items
              </span>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 font-mono text-[10px]">
                {selectedLogRecord.exchangedItems.map((it, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-300">
                    <span>{it.name} (Sz: {it.size}, Col: {it.color}) ×{it.quantity}</span>
                    <span className="font-bold">Rs. {(it.sellingPrice * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Replacement Items */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1 font-mono">
                <Plus className="w-3.5 h-3.5" /> Replacement Items Issued
              </span>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 font-mono text-[10px]">
                {selectedLogRecord.newItems.map((it, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-900 pb-1 text-slate-300">
                    <span>{it.name} (Sz: {it.size}, Col: {it.color}) ×{it.quantity}</span>
                    <span className="font-bold">Rs. {(it.sellingPrice * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 font-sans font-bold uppercase">Settlement:</span>
              {selectedLogRecord.additionalAmountPaid > 0 ? (
                <span className="text-amber-400 font-bold">Collected: Rs. {selectedLogRecord.additionalAmountPaid.toFixed(2)}</span>
              ) : selectedLogRecord.refundAmount && selectedLogRecord.refundAmount > 0 ? (
                <span className="text-emerald-400 font-bold">Refunded: Rs. {selectedLogRecord.refundAmount.toFixed(2)}</span>
              ) : (
                <span className="text-emerald-400 font-bold">Even Exchange (Rs. 0.00)</span>
              )}
            </div>

            {selectedLogRecord.notes && (
              <p className="text-[10px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 font-mono">
                <strong className="text-slate-500 font-sans">Notes:</strong> {selectedLogRecord.notes}
              </p>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedLogRecord(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase rounded-xl tracking-wider text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
