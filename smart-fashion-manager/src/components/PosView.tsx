/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { useAppState } from '../context/StateContext';
import { useShortcuts } from '../context/ShortcutContext';
import { useDebounce } from '../hooks/useDebounce';
import { safeLocalStorage } from '../utils/safeStorage';
import { DuplicateCustomerModal } from './common/DuplicateCustomerModal';
import {
  Barcode,
  Search,
  ShoppingCart,
  Trash2,
  Tag,
  User,
  QrCode,
  IndianRupee,
  Share2,
  CheckCircle,
  X,
  CreditCard,
  Smartphone,
  Plus,
  Minus,
  Sparkles,
  Clock,
  Shirt,
  Loader2,
  BookOpen,
  Calendar,
  AlertCircle,
  Scissors,
} from 'lucide-react';
import { CartItem, Product, Invoice, Offer, Customer, Fabric, FabricBill } from '../types';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { calculateCreditSummary, getPreviousOutstandingForCustomer } from '../utils/creditUtils';
import { evaluateOffers, isProductInOfferScope, getBestAvailableOfferRecommendation } from '../utils/offerEvaluator';
import { buildCompletePrintPageHtml } from '../utils/printInvoiceHtml';
import { buildCompleteFabricPrintPageHtml } from '../utils/printFabricInvoiceHtml';
import { InvoiceBarcode } from './InvoiceBarcode';

export const PosView: React.FC = () => {
  const {
    products,
    customers,
    findCustomerByPhone,
    offers,
    completeSale,
    settings,
    addCustomer,
    discountCards,
    calculateMembershipDiscount,
    membershipTypes,
    invoices,
    gifts,
    customerCoupons,
    couponValidationEngine,
    couponDeliveryLogs,
    setCouponDeliveryLogs,
    ensureCouponGeneratedForInvoice,
    recordCreditPayment,
    fabrics,
    createFabricBill,
    fabricBills,
    categoriesList,
    brandsList,
    colorsList,
  } = useAppState();

  const { registerShortcut, showToast } = useShortcuts();

  // Tab control state
  const [billingTab, setBillingTab] = useState<'products' | 'fabrics'>('products');

  // Fabric POS specific states
  const [fabricCart, setFabricCart] = useState<{
    fabric: Fabric;
    meters: number;
    ratePerMeter: number;
    customDiscount?: number;
    customDiscountType?: 'percentage' | 'flat';
  }[]>([]);
  const [selectedFabricCartIndex, setSelectedFabricCartIndex] = useState<number | null>(null);
  const [fabricSkuInput, setFabricSkuInput] = useState('');
  const [fabricScanError, setFabricScanError] = useState('');
  const [fabricSearchTerm, setFabricSearchTerm] = useState('');
  const debouncedFabricSearchTerm = useDebounce(fabricSearchTerm, 200);
  const [fabricSelectedCategory, setFabricSelectedCategory] = useState('All');
  const [fabricPhone, setFabricPhone] = useState('');
  const [fabricCustName, setFabricCustName] = useState('');
  const [isFabricNewCust, setIsFabricNewCust] = useState(false);
  const [fabricPaymentMethod, setFabricPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [fabricDiscount, setFabricDiscount] = useState('');
  const [fabricCashTendered, setFabricCashTendered] = useState('');
  const [fabricCreditAmountPaid, setFabricCreditAmountPaid] = useState('');
  const [fabricCreditDueDate, setFabricCreditDueDate] = useState('');
  const [fabricCreditReason, setFabricCreditReason] = useState('');
  const [fabricCreditRemarks, setFabricCreditRemarks] = useState('');
  const [fabricCollectPreviousDue, setFabricCollectPreviousDue] = useState(false);
  const [fabricNotes, setFabricNotes] = useState('');
  const [fabricLatestInvoice, setFabricLatestInvoice] = useState<FabricBill | null>(null);
  const [isGeneratingFabricBill, setIsGeneratingFabricBill] = useState(false);

  // ====================================================
  // BASIC DYNAMIC UPI QR PAYMENT STATES & HELPERS
  // ====================================================
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiModalConfig, setUpiModalConfig] = useState<{
    billType: 'products' | 'fabrics';
    amount: number;
    invoiceNo: string;
    onConfirm: () => void;
  } | null>(null);
  const [upiQrCodeDataUrl, setUpiQrCodeDataUrl] = useState<string>('');
  const [showUpiConfirmDialog, setShowUpiConfirmDialog] = useState(false);
  const [upiUriString, setUpiUriString] = useState<string>('');

  const generateProvisionalInvoiceNo = (prefix: string) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}${mm}`;

    if (prefix === 'FB') {
      const billSerial = (fabricBills.length + 1).toString().padStart(4, '0');
      return `FB${timeStr}${billSerial}`;
    } else {
      let nextSerial = 1;
      const serials = invoices.map((inv) => {
        const s = parseInt(inv.invoiceNo.slice(-4), 10);
        return isNaN(s) ? 0 : s;
      });
      if (serials.length > 0) {
        nextSerial = Math.max(...serials) + 1;
      }
      let serialStr = String(nextSerial).padStart(4, '0');
      let invoiceNo = `SF${timeStr}${serialStr}`;
      while (invoices.some((inv) => inv.invoiceNo === invoiceNo)) {
        nextSerial++;
        serialStr = String(nextSerial).padStart(4, '0');
        invoiceNo = `SF${timeStr}${serialStr}`;
      }
      return invoiceNo;
    }
  };

  const handleOpenUpiModal = async (
    billType: 'products' | 'fabrics',
    amount: number,
    invoiceNo: string,
    onConfirm: () => void
  ) => {
    const upiId = settings.storeProfile.upiId;
    if (!upiId || upiId.trim() === '') {
      showToast?.('Please configure the store UPI ID in Payment Settings.', 'error');
      return;
    }

    if (amount <= 0) {
      showToast?.('Final amount must be greater than ₹0.', 'error');
      return;
    }

    const formattedAmount = amount.toFixed(2);
    const merchantName = settings.storeProfile.upiDisplayName || settings.storeProfile.name || 'Smart Fashion';

    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(merchantName.trim())}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`;

    try {
      const dataUrl = await QRCode.toDataURL(upiUri, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setUpiQrCodeDataUrl(dataUrl);
      setUpiUriString(upiUri);
      setUpiModalConfig({
        billType,
        amount,
        invoiceNo,
        onConfirm,
      });
      setShowUpiModal(true);
    } catch (err) {
      console.error('Failed to generate UPI QR:', err);
      showToast?.('Failed to generate UPI QR code. Please try again.', 'error');
    }
  };

  // Basic POS states
  const [skuInput, setSkuInput] = useState('');
  const [scanError, setScanError] = useState('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Auto-focus barcode scanner input on mount & cleanup scan timeout
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      const el = document.getElementById('barcode-scanner-simulator');
      if (el) el.focus();
    }, 100);

    return () => {
      clearTimeout(focusTimer);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Discount Card State
  const [discountCardNo, setDiscountCardNo] = useState('');
  const [activeDiscountCard, setActiveDiscountCard] = useState<any | null>(null);
  const [discountCardFeedback, setDiscountCardFeedback] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer State
  const [phone, setPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [isNewCust, setIsNewCust] = useState(false);
  const [posDuplicateModal, setPosDuplicateModal] = useState<{
    isOpen: boolean;
    existingCustomer: Customer | null;
  }>({ isOpen: false, existingCustomer: null });

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [couponFeedback, setCouponFeedback] = useState('');
  const [manuallySelectedCouponCode, setManuallySelectedCouponCode] = useState<string | null>(null);

  // Billing & Generation State
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);

  // Silent Scanning States for Coupon Automation
  const [isScanningCoupons, setIsScanningCoupons] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Real-time Customer Ledger status state & calculations
  const [collectPreviousDue, setCollectPreviousDue] = useState(false);

  const customerCleanPhone = React.useMemo(() => {
    const rawPhone = phone || activeDiscountCard?.mobileNumber || '';
    return rawPhone.replace(/\D/g, '');
  }, [phone, activeDiscountCard]);

  const priorCreditInvoices = React.useMemo(() => {
    if (!customerCleanPhone || customerCleanPhone.length < 5) return [];
    return invoices.filter((inv) => {
      if (!inv.customerPhone) return false;
      const invPhone = inv.customerPhone.replace(/\D/g, '');
      if (invPhone !== customerCleanPhone) return false;
      if (inv.paymentMethod !== 'credit') return false;
      const summary = calculateCreditSummary(inv);
      return summary.balanceDue > 0.01;
    });
  }, [customerCleanPhone, invoices]);

  const previousOutstandingAmount = React.useMemo(() => {
    return priorCreditInvoices.reduce((sum, inv) => {
      const summary = calculateCreditSummary(inv);
      return sum + summary.balanceDue;
    }, 0);
  }, [priorCreditInvoices]);

  const oldestDueDate = React.useMemo(() => {
    if (priorCreditInvoices.length === 0) return null;
    const sorted = [...priorCreditInvoices].sort((a, b) => {
      const d1 = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const d2 = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return d1 - d2;
    });
    return sorted[0]?.dueDate || null;
  }, [priorCreditInvoices]);

  const isAnyOverdue = React.useMemo(() => {
    return priorCreditInvoices.some((inv) => {
      const summary = calculateCreditSummary(inv);
      return summary.isOverdue;
    });
  }, [priorCreditInvoices]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Find all active, unexpired customer coupons for the current phone
  const activeCustomerCoupons = React.useMemo(() => {
    if (!phone || phone.length < 7) return [];
    const autoConfig = settings?.couponAutomation;
    if (autoConfig?.enabled && autoConfig.autoCouponDetection === false) {
      return [];
    }
    const todayStr = new Date().toISOString().split('T')[0];
    return customerCoupons.filter(
      (c) => c.customerPhone === phone && c.status === 'active' && c.expiryDate >= todayStr
    );
  }, [customerCoupons, phone, settings?.couponAutomation]);

  // Trigger silent coupon scanning when phone number is entered/selected
  useEffect(() => {
    if (phone.length >= 7) {
      setIsScanningCoupons(true);
      setScanMessage('Silently scanning for active coupons...');
      const timer = setTimeout(() => {
        setIsScanningCoupons(false);
        const autoConfig = settings?.couponAutomation;
        const hasCoupons = activeCustomerCoupons.length > 0;
        if (autoConfig?.enabled && autoConfig.autoCouponDetection === false) {
          setScanMessage('Auto coupon detection is disabled in settings.');
        } else if (hasCoupons) {
          setScanMessage(`Found ${activeCustomerCoupons.length} active coupon(s).`);
        } else {
          setScanMessage('No active coupons found.');
        }
      }, 500); // 500ms beautiful silent scan simulation
      return () => clearTimeout(timer);
    } else {
      setIsScanningCoupons(false);
      setScanMessage('');
    }
  }, [phone, activeCustomerCoupons.length, settings?.couponAutomation]);

  // Find the single coupon that yields the absolute maximum financial savings
  const { getBestCouponForCart, setAppliedCoupons, setCashierOverrideCouponCode } = couponValidationEngine;

  const bestCouponResult = React.useMemo(() => {
    const autoConfig = settings?.couponAutomation;
    if (autoConfig?.enabled && autoConfig.autoCouponDetection === false) {
      return null;
    }
    const res = getBestCouponForCart(phone, cart);
    if (!res) return null;
    return {
      code: res.bestCoupon?.code || '',
      savings: res.maxSavings,
      coupon: res.bestCoupon,
      offer: res.bestOffer,
    };
  }, [phone, cart, getBestCouponForCart, settings?.couponAutomation]);

  useEffect(() => {
    // Sync appliedCoupons in the engine
    const matchedCoupon = activeCustomerCoupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase());
    if (matchedCoupon) {
      setAppliedCoupons([matchedCoupon]);
    } else {
      setAppliedCoupons([]);
    }
  }, [couponCode, activeCustomerCoupons, setAppliedCoupons]);

  useEffect(() => {
    // Sync cashierOverrideCouponCode in the engine
    setCashierOverrideCouponCode(manuallySelectedCouponCode);
  }, [manuallySelectedCouponCode, setCashierOverrideCouponCode]);

  useEffect(() => {
    if (!phone || cart.length === 0) {
      setManuallySelectedCouponCode(null);
    }
  }, [phone, cart.length]);

  useEffect(() => {
    const autoConfig = settings?.couponAutomation;
    const autoApplyEnabled = autoConfig?.enabled ? autoConfig.autoApplyOnNextVisit !== false : true;

    if (manuallySelectedCouponCode !== null) {
      setCouponCode(manuallySelectedCouponCode);
    } else if (autoApplyEnabled && bestCouponResult && bestCouponResult.savings > 0) {
      setCouponCode(bestCouponResult.code);
    } else {
      const isACustomerCoupon = activeCustomerCoupons.some(c => c.code.toUpperCase() === couponCode.toUpperCase());
      if (isACustomerCoupon) {
        setCouponCode('');
      }
    }
  }, [bestCouponResult, manuallySelectedCouponCode, activeCustomerCoupons, settings?.couponAutomation]);

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [creditAmountPaid, setCreditAmountPaid] = useState<string>('0');
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  const [creditReason, setCreditReason] = useState<string>('');
  const [creditRemarks, setCreditRemarks] = useState<string>('');
  const [latestInvoice, setLatestInvoice] = useState<Invoice | null>(null);

  // Dedicated Print Function using synchronous blank tab
  const handlePrintInvoice = (invoiceToPrint?: Invoice | null) => {
    const target = invoiceToPrint || latestInvoice;
    if (!target) {
      showToast?.('No invoice available to print.', 'error');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      showToast?.('Pop-up blocked. Please allow pop-ups for Smart Fashion Manager to print bill.', 'error');
      return;
    }
    const printableHtml = buildCompletePrintPageHtml(target, settings, invoices);
    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();
  };

  // Transaction Holding / Resuming System State
  const [heldBills, setHeldBills] = useState<any[]>(() => {
    const saved = safeLocalStorage.getItem('sf_pos_held_bills');
    return saved ? JSON.parse(saved) : [];
  });
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  // Active highlighted cart item selection index for keyboard-only quantity adjustment
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);

  useEffect(() => {
    safeLocalStorage.setItem('sf_pos_held_bills', JSON.stringify(heldBills));
  }, [heldBills]);

  useEffect(() => {
    if (cart.length === 0) {
      setSelectedCartIndex(-1);
    } else if (selectedCartIndex >= cart.length) {
      setSelectedCartIndex(cart.length - 1);
    } else if (selectedCartIndex === -1) {
      setSelectedCartIndex(0);
    }
  }, [cart, selectedCartIndex]);

  // POS transaction hold / resume handlers
  const handleHoldBill = () => {
    if (cart.length === 0) {
      showToast?.('Checkout basket is empty, nothing to hold.', 'f5');
      return;
    }
    const newHold = {
      id: 'held_' + Date.now(),
      cart,
      phone,
      custName,
      isNewCust,
      discountCardNo,
      activeDiscountCard,
      discountCardFeedback,
      couponCode,
      couponFeedback,
      paymentMethod,
      heldAt: new Date().toISOString()
    };
    setHeldBills((prev) => [...prev, newHold]);
    // Reset state
    setCart([]);
    setPhone('');
    setCustName('');
    setIsNewCust(false);
    setCouponCode('');
    setCouponFeedback('');
    setDiscountCardNo('');
    setActiveDiscountCard(null);
    setDiscountCardFeedback('');
    setPaymentMethod('cash');
    setSelectedCartIndex(-1);
    showToast?.('Current checkout basket placed on hold', 'f5');
  };

  const handleResumeBill = (held: any) => {
    setCart(held.cart);
    setPhone(held.phone);
    setCustName(held.custName);
    setIsNewCust(held.isNewCust);
    setDiscountCardNo(held.discountCardNo || '');
    setActiveDiscountCard(held.activeDiscountCard || null);
    setDiscountCardFeedback(held.discountCardFeedback || '');
    setCouponCode(held.couponCode || '');
    setCouponFeedback(held.couponFeedback || '');
    setPaymentMethod(held.paymentMethod || 'cash');
    if (held.cart && held.cart.length > 0) {
      setSelectedCartIndex(0);
    } else {
      setSelectedCartIndex(-1);
    }
    setHeldBills((prev) => prev.filter((b) => b.id !== held.id));
    setIsResumeModalOpen(false);
    showToast?.('Held transaction successfully resumed', 'f6');
  };

  const handleF6Resume = () => {
    if (heldBills.length === 0) {
      showToast?.('No transactions currently on hold', 'f6');
      return;
    }
    if (heldBills.length === 1) {
      handleResumeBill(heldBills[0]);
    } else {
      setIsResumeModalOpen(true);
    }
  };

  // Focus Helper
  const focusElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    }
  };

  // Keyboard shortcut registry
  useEffect(() => {
    const unregisterList = [
      registerShortcut('f1', 'POS', 'Focus SKU / Barcode Scanner', () => {
        focusElement('barcode-scanner-simulator');
      }),
      registerShortcut('f2', 'POS', 'Focus Customer Phone Input', () => {
        focusElement('pos-cust-phone');
      }),
      registerShortcut('f3', 'POS', 'Focus Membership Card Input', () => {
        focusElement('pos-card-input');
      }),
      registerShortcut('f4', 'POS', 'Focus Coupon Input', () => {
        focusElement('pos-coupon-input');
      }),
      registerShortcut('f5', 'POS', 'Hold Current Transaction', () => {
        handleHoldBill();
      }),
      registerShortcut('f6', 'POS', 'Resume Held Transaction', () => {
        handleF6Resume();
      }),
      registerShortcut('f7', 'POS', 'Focus Complete Sale Button', () => {
        focusElement('pos-submit-sale');
      }),
      registerShortcut('f8', 'POS', 'Select Cash Payment', () => {
        setPaymentMethod('cash');
        showToast?.('Switched payment to Cash', 'f8');
      }),
      registerShortcut('f9', 'POS', 'Select UPI QR Payment', () => {
        setPaymentMethod('upi');
        showToast?.('Switched payment to UPI QR', 'f9');
      }),
      registerShortcut('f10', 'POS', 'Select Credit Card Payment', () => {
        setPaymentMethod('card');
        showToast?.('Switched payment to Credit Card', 'f10');
      }),
      registerShortcut('f11', 'POS', 'Reprint Last Bill', () => {
        if (latestInvoice) {
          handlePrintInvoice(latestInvoice);
          showToast?.(`Reprinting invoice ${latestInvoice.invoiceNo}`, 'f11');
        } else {
          showToast?.('No recent invoice to print', 'f11');
        }
      }),
      registerShortcut('f12', 'POS', 'Generate Bill', () => {
        if (cart.length > 0 && !isGeneratingBill) {
          const submitBtn = document.getElementById('pos-submit-sale');
          if (submitBtn) {
            submitBtn.click();
          }
        } else if (cart.length === 0) {
          showToast?.('Cannot generate bill: Checkout basket is empty', 'f12');
        }
      }),
      registerShortcut('ctrl++', 'POS', 'Increase Highlighted Item Qty', () => {
        if (cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          const item = cart[selectedCartIndex];
          updateQty(item.product.id, item.quantity + 1);
        }
      }),
      registerShortcut('ctrl+-', 'POS', 'Decrease Highlighted Item Qty', () => {
        if (cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          const item = cart[selectedCartIndex];
          updateQty(item.product.id, item.quantity - 1);
        }
      }),
      registerShortcut('delete', 'POS', 'Remove Highlighted Cart Item', () => {
        if (cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          const item = cart[selectedCartIndex];
          if (window.confirm(`Remove ${item.product.name} from checkout basket?`)) {
            removeFromCart(item.product.id);
          }
        }
      }),
      registerShortcut('ctrl+backspace', 'POS', 'Clear Checkout Basket', () => {
        if (cart.length > 0) {
          if (window.confirm('Clear entire shopping basket? This cannot be undone.')) {
            setCart([]);
            setSelectedCartIndex(-1);
            showToast?.('Shopping basket cleared', 'ctrl+backspace');
          }
        }
      }),
      registerShortcut('escape', 'POS', 'Close Modals / Cancel Holds', () => {
        if (isResumeModalOpen) {
          setIsResumeModalOpen(false);
        }
      }),
    ];

    return () => {
      unregisterList.forEach((un) => un());
    };
  }, [
    cart,
    selectedCartIndex,
    heldBills,
    phone,
    custName,
    isNewCust,
    discountCardNo,
    activeDiscountCard,
    discountCardFeedback,
    couponCode,
    couponFeedback,
    paymentMethod,
    isGeneratingBill,
    latestInvoice,
    registerShortcut,
  ]);

  // Filter products for catalog selector (Memoized for high performance)
  const catalogProducts = useMemo(() => {
    const term = (debouncedSearchTerm || '').toLowerCase().trim();
    return products.filter((p) => {
      if (p.status !== 'active') return false;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (!term) return true;

      return (
        (p.name || '').toLowerCase().includes(term) ||
        (p.sku || '').includes(term) ||
        (p.brand || '').toLowerCase().includes(term)
      );
    });
  }, [products, debouncedSearchTerm, selectedCategory]);

  // Unique categories for catalog
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map((p) => p.category)))];
  }, [products]);

  // Helper to find active product by SKU or Barcode
  const findProductByBarcode = (inputVal: string): Product | undefined => {
    const target = inputVal.trim().toUpperCase().replace(/\s+/g, '');
    if (!target) return undefined;
    return products.find((p) => {
      if (p.status !== 'active') return false;
      const skuClean = (p.sku || '').trim().toUpperCase().replace(/\s+/g, '');
      const idClean = (p.id || '').trim().toUpperCase().replace(/\s+/g, '');
      const barcodeClean = ((p as any).barcode || '').trim().toUpperCase().replace(/\s+/g, '');
      return skuClean === target || idClean === target || (barcodeClean && barcodeClean === target);
    });
  };

  // Core automatic barcode processor
  const processBarcodeScan = (rawInput: string) => {
    const input = rawInput.trim();
    if (!input) return;

    // Clear any pending timer
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    // Prevent duplicate processing of the exact same code within 150ms
    const now = Date.now();
    if (
      lastProcessedRef.current &&
      lastProcessedRef.current.code === input &&
      now - lastProcessedRef.current.timestamp < 150
    ) {
      setSkuInput('');
      return;
    }
    lastProcessedRef.current = { code: input, timestamp: now };

    const matchedProduct = findProductByBarcode(input);

    if (matchedProduct) {
      setScanError('');

      const existing = cart.find((item) => item.product.id === matchedProduct.id);
      const nextQty = existing ? Math.min(existing.quantity + 1, matchedProduct.currentStock) : 1;

      addToCart(matchedProduct);

      if (matchedProduct.currentStock > 0) {
        showToast?.(`Auto-Scanned: ${matchedProduct.name} (Qty: ${nextQty})`, 'SCAN');
      }
      setSkuInput('');
    } else {
      setScanError(`Product not found for barcode: "${input}"`);
      showToast?.(`Product not found for barcode: "${input}"`, 'error');
      setSkuInput('');
    }
  };

  // Real-time automatic barcode scan on input change
  const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSkuInput(val);
    if (scanError) setScanError('');

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    const target = val.trim();
    if (!target) return;

    // Check 1: Instant match if barcode matches a known product in catalog
    const matched = findProductByBarcode(target);
    if (matched) {
      processBarcodeScan(target);
      return;
    }

    // Check 2: For scanners that do NOT send Enter/Tab key or completed typed input,
    // evaluate after a 350ms pause in typing
    scanTimeoutRef.current = setTimeout(() => {
      processBarcodeScan(target);
    }, 350);
  };

  // Keyboard event handler for Enter and Tab keys from USB/Bluetooth scanners
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (skuInput.trim()) {
        processBarcodeScan(skuInput);
      }
    }
  };

  // Form submit for Barcode Scanner (manual Scan click or submit)
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (skuInput.trim()) {
      processBarcodeScan(skuInput);
    }
  };

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      alert('Garment is currently out of stock!');
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          alert(`In-store stock limit (${product.currentStock}) reached.`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            customDiscount: product.discount,
            customDiscountType: product.discountType,
          },
        ];
      }
    });
  };

  const updateQty = (prodId: string, quantity: number) => {
    const matched = products.find((p) => p.id === prodId);
    if (!matched) return;

    if (quantity <= 0) {
      removeFromCart(prodId);
      return;
    }

    if (quantity > matched.currentStock) {
      alert(`In-store stock limit (${matched.currentStock}) reached.`);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => (item.product.id === prodId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (prodId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== prodId));
  };

  const updateItemDiscount = (prodId: string, value: number, type: 'percentage' | 'flat') => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === prodId ? { ...item, customDiscount: value, customDiscountType: type } : item
      )
    );
  };

  // Customer Phone lookup
  const handlePhoneLookup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pVal = e.target.value.replace(/\D/g, ''); // keep only digits
    setPhone(pVal);

    if (pVal.length >= 7) {
      const cust = findCustomerByPhone(pVal);
      if (cust) {
        setCustName(cust.name);
        setIsNewCust(false);
      } else {
        setIsNewCust(true);
        setCustName('');
      }
    } else {
      setCustName('');
      setIsNewCust(false);
    }
  };

  const handleOpenExistingPosCustomer = (cust: Customer) => {
    setPhone(cust.phone);
    setCustName(cust.name);
    setIsNewCust(false);
    setPosDuplicateModal({ isOpen: false, existingCustomer: null });
  };

  const handleCardLookup = (cardNoVal: string) => {
    setDiscountCardNo(cardNoVal);
    setDiscountCardFeedback('');
    if (!cardNoVal.trim()) {
      setActiveDiscountCard(null);
      return;
    }

    const card = discountCards.find((c) => {
      const target = cardNoVal.trim().toUpperCase().replace(/\s+/g, '');
      const numMatch = c.cardNumber.toUpperCase().replace(/\s+/g, '') === target;
      const barcodeMatch = c.barcodeText ? c.barcodeText.toUpperCase().replace(/\s+/g, '') === target : false;
      return numMatch || barcodeMatch;
    });
    if (card) {
      // Find matching membership type and check status
      const tier = membershipTypes.find(t => t.id?.toLowerCase() === card.cardType?.toLowerCase());
      if (tier && tier.status === 'inactive') {
        setDiscountCardFeedback(`Card Tier is INACTIVE. Contact admin to activate ${tier.name}.`);
        setActiveDiscountCard(null);
        return;
      }

      if (card.status === 'blocked') {
        setDiscountCardFeedback('Card is BLOCKED. Requires manager review.');
        setActiveDiscountCard(null);
      } else if (card.status === 'expired') {
        setDiscountCardFeedback('Card is EXPIRED. Needs renewal.');
        setActiveDiscountCard(null);
      } else {
        setActiveDiscountCard(card);
        const res = calculateMembershipDiscount(card.cardType, subtotal, card.usageLogs || []);
        const discountPct = res.discountPercentage ?? 0;
        const tierName = tier ? tier.name : (card.cardType ? card.cardType.toUpperCase() : 'MEMBER');
        setDiscountCardFeedback(`Linked: ${formatMemberName(card.customerName)} (${tierName} - ${discountPct}% Discount Applied)`);
        // Auto detect and fill customer details
        if (card.mobileNumber) {
          setPhone(card.mobileNumber);
          setCustName(formatMemberName(card.customerName));
        }
      }
    } else {
      setActiveDiscountCard(null);
      if (cardNoVal.length >= 8) {
        setDiscountCardFeedback('Discount card not found.');
      }
    }
  };

  // Calculation Logic
  const getSubtotal = () => {
    return cart.reduce((sum, item) => {
      const originalPrice = item.product.sellingPrice;
      let finalPrice = originalPrice;

      if (item.customDiscount > 0) {
        if (item.customDiscountType === 'percentage') {
          finalPrice = originalPrice * (1 - item.customDiscount / 100);
        } else {
          finalPrice = Math.max(0, originalPrice - item.customDiscount);
        }
      }
      return sum + finalPrice * item.quantity;
    }, 0);
  };

  const subtotal = getSubtotal();

  const nextCouponTier = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Gather all candidate coupon offers:
    // 1. From active customer coupons
    const linkedOffers = activeCustomerCoupons
      .map(c => offers.find(o => o.id === c.offerId))
      .filter((o): o is NonNullable<typeof o> => !!o);
      
    // 2. From all active general store coupon offers
    const generalCouponOffers = offers.filter(o => 
      o.isActive && 
      (!o.expiryDate || o.expiryDate >= todayStr) && 
      (o.offerCategory === 'coupon' || o.code)
    );
    
    // Combine and deduplicate by code or id
    const allCoupons = [...linkedOffers, ...generalCouponOffers];
    const uniqueCoupons = Array.from(new Map(allCoupons.map(o => [o.id, o])).values());
    
    // Filter for coupons with minimum spend requirement that are currently LOCKED (subtotal < minBill)
    const lockedCoupons = uniqueCoupons
      .map(o => {
        const minBill = o.minBillAmount || o.minPurchaseAmount || 0;
        return { offer: o, minBill };
      })
      .filter(item => item.minBill > subtotal)
      .sort((a, b) => a.minBill - b.minBill);
      
    if (lockedCoupons.length === 0) return null;
    
    const next = lockedCoupons[0];
    const needed = next.minBill - subtotal;
    const pct = subtotal > 0 ? (subtotal / next.minBill) * 100 : 0;
    
    return {
      offer: next.offer,
      minBill: next.minBill,
      needed,
      pct: Math.min(100, Math.max(0, pct))
    };
  }, [activeCustomerCoupons, offers, subtotal]);

  // Call the robust offer evaluation engine!
  const evaluationResult = React.useMemo(() => {
    const activeOffersForPOS = offers.map((o) => {
      const isCoupon = !o.offerCategory || o.offerCategory === 'coupon';
      if (isCoupon) {
        return {
          ...o,
          isActive: o.isActive && couponCode.trim().toUpperCase() === o.code.toUpperCase(),
        };
      }
      return o;
    });

    return evaluateOffers(
      cart,
      activeOffersForPOS,
      products,
      phone ? { phone, name: custName } : null,
      invoices,
      gifts,
      activeDiscountCard,
      calculateMembershipDiscount
    );
  }, [cart, offers, products, phone, custName, invoices, couponCode, gifts, activeDiscountCard]);

  // Upgrade the POS offer recommendation engine!
  const bestRecommendation = React.useMemo(() => {
    if (evaluationResult.appliedOffers.length > 0) return null;
    return getBestAvailableOfferRecommendation(
      cart,
      offers,
      products,
      phone ? { phone, name: custName } : null,
      invoices,
      gifts
    );
  }, [cart, offers, products, phone, custName, invoices, evaluationResult, gifts]);

  const totalCartQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const sameProductFreeQty = evaluationResult.freeProducts
    .filter(fp => !fp.isGift)
    .reduce((sum, fp) => sum + fp.quantity, 0);
  const giftFreeQty = evaluationResult.freeProducts
    .filter(fp => fp.isGift)
    .reduce((sum, fp) => sum + fp.quantity, 0);

  const totalBillQuantity = totalCartQty + giftFreeQty;
  const totalFreeQuantity = sameProductFreeQty + giftFreeQty;
  const totalPaidQuantity = totalBillQuantity - totalFreeQuantity;

  // Find active BOGO offer for a product and get lock/unlock warnings
  const getBogoUnlockMessage = (item: CartItem) => {
    const eligibleBogoOffers = offers.filter(o => {
      if (!o.isActive) return false;
      const type = String(o.type).toLowerCase();
      if (type !== 'bogo' && type !== 'buy x get y free') return false;
      return isProductInOfferScope(item.product, o);
    });

    if (eligibleBogoOffers.length === 0) return null;

    const offer = eligibleBogoOffers.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    const buyQty = offer.buyQty || 1;
    const freeQty = offer.freeQty || 1;
    const isSame = offer.freeProductSelectionType !== 'different';

    if (!isSame) return null;

    const totalQty = item.quantity;
    const groupSize = buyQty + freeQty;
    const freeCount = Math.floor(totalQty / groupSize) * freeQty;

    if (freeCount === 0) {
      const needed = groupSize - totalQty;
      if (needed > 0) {
        return `Add ${needed} more item${needed > 1 ? 's' : ''} to unlock FREE product.`;
      }
    }
    return null;
  };

  // Coupon verification
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponFeedback('');
    if (!couponCode.trim()) return;

    const offer = offers.find((o) => o.code === couponCode.trim().toUpperCase());
    if (!offer) {
      setCouponFeedback('Invalid Coupon Code.');
      return;
    }
    if (!offer.isActive) {
      setCouponFeedback('This coupon is currently inactive.');
      return;
    }
    if (subtotal < offer.minPurchaseAmount) {
      setCouponFeedback(`Minimum purchase of ₹${offer.minPurchaseAmount} required.`);
      return;
    }

    // Check if the evaluator actually applies this offer
    const isCouponApplied = evaluationResult.appliedOffers.some(ap => ap.offer.code === offer.code);
    if (isCouponApplied) {
      setCouponFeedback(`Applied: ${offer.name}`);
    } else {
      setCouponFeedback(`Not eligible or overwritten by a better offer.`);
    }
  };

  const getCardAppliedPercentage = () => {
    if (activeDiscountCard) {
      const res = calculateMembershipDiscount(activeDiscountCard.cardType, subtotal, activeDiscountCard.usageLogs || []);
      return res.discountPercentage ?? 0;
    }
    return 0;
  };

  const getCardDiscount = () => {
    if (activeDiscountCard) {
      const res = calculateMembershipDiscount(activeDiscountCard.cardType, subtotal, activeDiscountCard.usageLogs || []);
      return res.discountAmount;
    }
    return 0;
  };

  const giftSavings = evaluationResult.freeProducts
    .filter(fp => fp.isGift)
    .reduce((sum, fp) => sum + (fp.product.sellingPrice - fp.price) * fp.quantity, 0);

  const giftPromoPrice = evaluationResult.freeProducts
    .filter(fp => fp.isGift)
    .reduce((sum, fp) => sum + fp.price * fp.quantity, 0);

  const cardDiscount = evaluationResult.appliedOffers.find(ao => ao.offer.id === 'membership-card')?.savings ?? 0;
  const couponDiscountWithoutGiftSavings = Math.max(0, evaluationResult.totalSavings - giftSavings - cardDiscount);
  const checkoutAmount = evaluationResult.checkoutAmount;

  const effectivePayableAmount = (collectPreviousDue && previousOutstandingAmount > 0)
    ? checkoutAmount + previousOutstandingAmount
    : checkoutAmount;

  // overall GST included estimation
  const gstRate = settings.storeProfile.defaultGstRate;
  const baseCostPrice = checkoutAmount / (1 + gstRate / 100);
  const gstAmount = checkoutAmount - baseCostPrice;

  const executeProductsCheckout = () => {
    // Synchronous blank popup MUST happen immediately in the user click event handler before any async work
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      showToast?.(
        'Pop-up blocked. Please allow pop-ups for Smart Fashion Manager and click GENERATE BILL again.',
        'error'
      );
      return;
    }

    // Show temporary loading indicator in the new tab while invoice is saved
    try {
      printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Preparing Bill...</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(251, 191, 36, 0.25);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 14px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 14px; font-weight: 500; letter-spacing: 0.02em; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Preparing invoice for printing...</p>
</body>
</html>`);
      printWindow.document.close();
    } catch (e) {
      console.warn('Initial write to printWindow:', e);
    }

    const isCollectingPrevDue = Boolean(collectPreviousDue && previousOutstandingAmount > 0);

    let amountPaidForSale: number | undefined;
    if (paymentMethod === 'credit') {
      amountPaidForSale = creditAmountPaid !== '' ? Number(creditAmountPaid) : 0;
    } else if (paymentMethod === 'cash') {
      amountPaidForSale = cashTendered !== '' ? Number(cashTendered) : (isCollectingPrevDue ? effectivePayableAmount : checkoutAmount);
    } else {
      amountPaidForSale = isCollectingPrevDue ? effectivePayableAmount : checkoutAmount;
    }

    setIsGeneratingBill(true);

    try {
      // Process checkout atomically via completeSale (creates invoice exactly once)
      const invoice = completeSale(
        phone,
        phone ? (custName || 'Loyal Client') : '',
        cart.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          discount: item.customDiscount,
          discountType: item.customDiscountType,
        })),
        paymentMethod,
        couponCode.trim().toUpperCase() || undefined,
        activeDiscountCard ? activeDiscountCard.cardNumber : undefined,
        amountPaidForSale,
        paymentMethod === 'credit' || isCollectingPrevDue
          ? {
              dueDate: creditDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              reason: creditReason.trim() || undefined,
              remarks: creditRemarks.trim() || undefined,
            }
          : undefined,
        {
          collectPreviousDue: isCollectingPrevDue,
        }
      );

      setLatestInvoice(invoice);
      setCollectPreviousDue(false);

      // Reset fields
      setCart([]);
      setPhone('');
      setCustName('');
      setIsNewCust(false);
      setCouponCode('');
      setCouponFeedback('');
      setDiscountCardNo('');
      setActiveDiscountCard(null);
      setDiscountCardFeedback('');
      setCashTendered('');
      setCreditAmountPaid('0');
      setCreditReason('');
      setCreditRemarks('');

      // Build complete standalone printable HTML and inject into the synchronous tab
      const printableHtml = buildCompletePrintPageHtml(invoice, settings, invoices);

      printWindow.document.open();
      printWindow.document.write(printableHtml);
      printWindow.document.close();

      showToast?.(`Bill generated for invoice #${invoice.invoiceNo}`, 'success');
    } catch (err: any) {
      console.error('Failed to generate bill:', err);
      if (printWindow && !printWindow.closed) {
        try {
          printWindow.document.open();
          printWindow.document.write(`<!DOCTYPE html>
<html>
<head><title>Unable to prepare invoice</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="font-family:'Poppins',sans-serif;padding:24px;color:#dc2626;">
  <h3>Unable to prepare invoice</h3>
  <p>Please return to Smart Fashion Manager.</p>
</body>
</html>`);
          printWindow.document.close();
        } catch (wErr) {
          console.error('Failed to write error to print window:', wErr);
        }
      }
      showToast?.('Error generating bill. Please try again.', 'error');
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeneratingBill) return;

    if (cart.length === 0) {
      showToast?.('Cart is empty.', 'error');
      return;
    }

    if (paymentMethod === 'credit') {
      if (!phone || phone.trim().length < 7) {
        showToast?.('Customer selection is mandatory for Credit Sales (Udhar).', 'error');
        const phoneInput = document.getElementById('pos-cust-phone');
        if (phoneInput) phoneInput.focus();
        return;
      }
      if (!creditDueDate) {
        showToast?.('Due Date is required for Credit Sales.', 'error');
        const dueDateInput = document.getElementById('pos-credit-due-date');
        if (dueDateInput) dueDateInput.focus();
        return;
      }
    }

    if (paymentMethod === 'upi') {
      const provInvoiceNo = generateProvisionalInvoiceNo('SF');
      handleOpenUpiModal('products', effectivePayableAmount, provInvoiceNo, () => {
        executeProductsCheckout();
      });
      return;
    }

    executeProductsCheckout();
  };

  const getInvoiceCardDetails = (cardNumber?: string) => {
    if (!cardNumber) return null;
    const card = discountCards.find(c => c.cardNumber === cardNumber);
    if (!card) return null;
    const tier = membershipTypes.find(t => t.id === card.cardType);
    return {
      tierName: tier?.name || card.cardType?.toUpperCase() || 'MEMBER',
      cardNumber: card.cardNumber,
    };
  };

  const cleanPhoneForWhatsApp = (phoneStr: string) => {
    const digits = (phoneStr || '').replace(/\D/g, '');
    if (digits.length === 10) {
      return '91' + digits;
    }
    return digits;
  };

  // ==========================================
  // FABRICS POS BILLING HELPERS & STATE MANAGEMENT
  // ==========================================

  const fabricCategories = useMemo(() => {
    const set = new Set<string>();
    fabrics.forEach(f => {
      const cat = f.category || f.categoryName;
      if (cat) set.add(cat);
    });
    return ['All', ...Array.from(set)];
  }, [fabrics]);

  const catalogFabrics = useMemo(() => {
    return fabrics.filter(f => {
      const cat = f.category || f.categoryName || 'General';
      const matchesCategory = fabricSelectedCategory === 'All' || cat === fabricSelectedCategory;
      const term = debouncedFabricSearchTerm.toLowerCase().trim();
      const matchesSearch = !term || (
        (f.name || '').toLowerCase().includes(term) ||
        (f.sku || '').toLowerCase().includes(term) ||
        (f.category || f.categoryName || '').toLowerCase().includes(term) ||
        (f.brand || f.brandName || '').toLowerCase().includes(term) ||
        (f.color || f.colorName || '').toLowerCase().includes(term)
      );
      return matchesCategory && matchesSearch;
    });
  }, [fabrics, fabricSelectedCategory, debouncedFabricSearchTerm]);

  const addFabricToCart = (f: Fabric, metersToAdd: number = 1.0) => {
    if (f.stockMeters <= 0) {
      showToast?.(`${f.name} is out of stock.`, 'warning');
      return;
    }
    const existingIndex = fabricCart.findIndex(item => item.fabric.id === f.id);
    if (existingIndex >= 0) {
      const updated = [...fabricCart];
      const newM = Number((updated[existingIndex].meters + metersToAdd).toFixed(2));
      updated[existingIndex].meters = newM;
      setFabricCart(updated);
      setSelectedFabricCartIndex(existingIndex);
      showToast?.(`Updated ${f.name} to ${newM} M in basket.`, 'info');
    } else {
      const newCart = [...fabricCart, {
        fabric: f,
        meters: metersToAdd,
        ratePerMeter: f.retailRate || 0,
        customDiscount: 0,
        customDiscountType: 'percentage' as const
      }];
      setFabricCart(newCart);
      setSelectedFabricCartIndex(fabricCart.length);
      showToast?.(`Added ${f.name} (${metersToAdd} M) to basket.`, 'success');
    }
  };

  const updateFabricMeters = (idx: number, meters: number) => {
    if (meters <= 0) {
      handleRemoveFabricFromCart(idx);
      return;
    }
    const updated = [...fabricCart];
    if (updated[idx]) {
      updated[idx].meters = Number(meters.toFixed(2));
      setFabricCart(updated);
    }
  };

  const updateFabricItemDiscount = (idx: number, discount: number, type: 'percentage' | 'flat') => {
    const updated = [...fabricCart];
    if (updated[idx]) {
      updated[idx].customDiscount = Math.max(0, discount);
      updated[idx].customDiscountType = type;
      setFabricCart(updated);
    }
  };

  const handleRemoveFabricFromCart = (index: number) => {
    const updated = [...fabricCart];
    updated.splice(index, 1);
    setFabricCart(updated);
    if (selectedFabricCartIndex === index) {
      setSelectedFabricCartIndex(null);
    } else if (selectedFabricCartIndex !== null && selectedFabricCartIndex > index) {
      setSelectedFabricCartIndex(selectedFabricCartIndex - 1);
    }
  };

  const handleFabricBarcodeScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = fabricSkuInput.trim();
    if (!code) return;

    const found = fabrics.find(f => 
      f.sku.toLowerCase() === code.toLowerCase() || 
      f.id.toLowerCase() === code.toLowerCase() ||
      f.name.toLowerCase() === code.toLowerCase()
    );

    if (found) {
      addFabricToCart(found, 1.0);
      setFabricSkuInput('');
      setFabricScanError('');
    } else {
      setFabricScanError(`No fabric found with barcode / SKU "${code}".`);
    }
  };

  const handleFabricPhoneLookup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFabricPhone(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 10) {
      const match = findCustomerByPhone(clean);
      if (match) {
        setFabricCustName(match.name);
        setIsFabricNewCust(false);
      } else {
        setIsFabricNewCust(true);
      }
    } else {
      setIsFabricNewCust(false);
    }
  };

  const fabricTotalMeters = useMemo(() => {
    return fabricCart.reduce((sum, item) => sum + (item.meters || 0), 0);
  }, [fabricCart]);

  const fabricSubtotal = useMemo(() => {
    return fabricCart.reduce((sum, item) => {
      const itemPrice = item.ratePerMeter;
      let checkoutPrice = itemPrice;
      if (item.customDiscount && item.customDiscount > 0) {
        if (item.customDiscountType === 'percentage') {
          checkoutPrice = itemPrice * (1 - item.customDiscount / 100);
        } else {
          checkoutPrice = Math.max(0, itemPrice - item.customDiscount / Math.max(1, item.meters));
        }
      }
      return sum + (item.meters * checkoutPrice);
    }, 0);
  }, [fabricCart]);

  const fabricDiscountAmount = Number(fabricDiscount) || 0;
  const fabricCheckoutAmount = Math.max(0, fabricSubtotal - fabricDiscountAmount);
  const fabricGstRate = settings?.storeProfile?.defaultGstRate || 0;
  const fabricGstAmount = fabricCheckoutAmount - (fabricCheckoutAmount / (1 + fabricGstRate / 100));

  // Customer Ledger status for Fabric
  const fabricCustomerCleanPhone = useMemo(() => {
    return (fabricPhone || '').replace(/\D/g, '');
  }, [fabricPhone]);

  const fabricPriorCreditInvoices = useMemo(() => {
    if (!fabricCustomerCleanPhone || fabricCustomerCleanPhone.length < 5) return [];
    return invoices.filter((inv) => {
      if (!inv.customerPhone) return false;
      const invPhone = inv.customerPhone.replace(/\D/g, '');
      if (invPhone !== fabricCustomerCleanPhone) return false;
      if (inv.paymentMethod !== 'credit') return false;
      const summary = calculateCreditSummary(inv);
      return summary.balanceDue > 0.01;
    });
  }, [fabricCustomerCleanPhone, invoices]);

  const fabricPreviousOutstandingAmount = useMemo(() => {
    return fabricPriorCreditInvoices.reduce((sum, inv) => {
      const summary = calculateCreditSummary(inv);
      return sum + summary.balanceDue;
    }, 0);
  }, [fabricPriorCreditInvoices]);

  const fabricOldestDueDate = useMemo(() => {
    if (fabricPriorCreditInvoices.length === 0) return null;
    const sorted = [...fabricPriorCreditInvoices].sort((a, b) => {
      const d1 = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const d2 = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return d1 - d2;
    });
    return sorted[0]?.dueDate || null;
  }, [fabricPriorCreditInvoices]);

  const fabricIsAnyOverdue = useMemo(() => {
    return fabricPriorCreditInvoices.some((inv) => {
      const summary = calculateCreditSummary(inv);
      return summary.isOverdue;
    });
  }, [fabricPriorCreditInvoices]);

  const fabricEffectivePayableAmount = fabricCollectPreviousDue && fabricPreviousOutstandingAmount > 0
    ? fabricCheckoutAmount + fabricPreviousOutstandingAmount
    : fabricCheckoutAmount;

  const executeFabricsCheckout = () => {
    let cleanMobile = fabricPhone.replace(/\D/g, '');
    if (cleanMobile.length === 10 && isFabricNewCust) {
      addCustomer(fabricCustName || 'Walk-in Client', cleanMobile);
    }

    setIsGeneratingFabricBill(true);

    try {
      const billItems = fabricCart.map(item => {
        const itemPrice = item.ratePerMeter;
        let finalRate = itemPrice;
        if (item.customDiscount && item.customDiscount > 0) {
          if (item.customDiscountType === 'percentage') {
            finalRate = itemPrice * (1 - item.customDiscount / 100);
          } else {
            finalRate = Math.max(0, itemPrice - item.customDiscount / Math.max(1, item.meters));
          }
        }
        return {
          fabricId: item.fabric.id,
          meters: item.meters,
          ratePerMeter: finalRate,
        };
      });

      const amountPaidToday = fabricPaymentMethod === 'credit'
        ? (fabricCreditAmountPaid !== '' ? Number(fabricCreditAmountPaid) : 0)
        : (fabricPaymentMethod === 'cash' && fabricCashTendered !== '' ? Number(fabricCashTendered) : fabricEffectivePayableAmount);

      const finalBill = createFabricBill({
        customerName: fabricCustName || 'Walk-in Client',
        customerPhone: cleanMobile || undefined,
        items: billItems,
        paymentMethod: fabricPaymentMethod,
        discountAmount: fabricDiscountAmount,
        amountPaid: amountPaidToday,
        notes: fabricNotes || (fabricCreditReason || fabricCreditRemarks ? `Reason: ${fabricCreditReason || '-'} | Remarks: ${fabricCreditRemarks || '-'}` : undefined),
      });

      setFabricLatestInvoice(finalBill);
      showToast?.(`Fabric Bill #${finalBill.billNo} finalized successfully!`, 'success');

      // Open printable receipt in popup window
      const printHtml = buildCompleteFabricPrintPageHtml(finalBill, settings);
      const printWindow = window.open('', '_blank', 'width=450,height=600');
      if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
      } else {
        showToast?.('Pop-up blocked. Please allow popups to print receipt.', 'warning');
      }

      // Reset Fabric cart and forms
      setFabricCart([]);
      setSelectedFabricCartIndex(null);
      setFabricSearchTerm('');
      setFabricSkuInput('');
      setFabricScanError('');
      setFabricPhone('');
      setFabricCustName('');
      setFabricDiscount('');
      setFabricCashTendered('');
      setFabricCreditAmountPaid('');
      setFabricCreditDueDate('');
      setFabricCreditReason('');
      setFabricCreditRemarks('');
      setFabricCollectPreviousDue(false);
      setFabricNotes('');
    } catch (error: any) {
      console.error('Error completing fabric sale:', error);
      showToast?.('Error completing fabric sale: ' + error.message, 'error');
    } finally {
      setIsGeneratingFabricBill(false);
    }
  };

  const handleCompleteFabricSale = async () => {
    if (fabricCart.length === 0) {
      showToast?.('Your fabric checkout basket is empty.', 'error');
      return;
    }

    if (fabricPaymentMethod === 'credit') {
      if (!fabricPhone || fabricPhone.trim().length < 7) {
        showToast?.('Customer mobile number is required for Credit (Udhar) sales.', 'error');
        return;
      }
      if (!fabricCustName || fabricCustName.trim().length === 0) {
        showToast?.('Customer name is required for Credit (Udhar) sales.', 'error');
        return;
      }
    }

    if (fabricPaymentMethod === 'upi') {
      const provBillNo = generateProvisionalInvoiceNo('FB');
      handleOpenUpiModal('fabrics', fabricEffectivePayableAmount, provBillNo, () => {
        executeFabricsCheckout();
      });
      return;
    }

    executeFabricsCheckout();
  };

  return (
    <div className="space-y-6">
      {/* Dual Tab Navigation */}
      <div className="flex border-b border-slate-800" id="pos-tab-navigation">
        <button
          onClick={() => setBillingTab('products')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 transition-all ${
            billingTab === 'products'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shirt className="w-4 h-4" />
          <span>PRODUCTS BILL</span>
        </button>
        <button
          onClick={() => setBillingTab('fabrics')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 transition-all ${
            billingTab === 'fabrics'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>FABRICS BILL</span>
        </button>
      </div>

      {billingTab === 'products' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="pos-billing-layout">
      {/* Catalog & Barcode Scanner Panel */}
      <div className="xl:col-span-2 space-y-4">
        {/* Barcode scan simulator bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <form onSubmit={handleBarcodeScan} className="flex gap-2 text-xs">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-500/60">
                <Barcode className="w-5 h-5" />
              </span>
              <input
                id="barcode-scanner-simulator"
                type="text"
                value={skuInput}
                onChange={handleBarcodeInputChange}
                onKeyDown={handleBarcodeKeyDown}
                autoComplete="off"
                placeholder="Auto-Scan Active (Enter / Laser Scan Product Barcode / SKU e.g., 890123456001)..."
                className={`w-full bg-slate-950 border rounded-lg py-3 pl-11 pr-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                  scanError ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-amber-500'
                }`}
              />
            </div>
            <button
              id="simulate-scan-btn"
              type="submit"
              className="gold-gradient text-slate-950 px-5 rounded-lg font-extrabold uppercase tracking-widest text-[10px] cursor-pointer"
            >
              Scan
            </button>
          </form>

          {scanError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="font-semibold">{scanError}</span>
            </div>
          )}
        </div>

        {/* Catalog Selector Panel */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-serif text-sm font-bold text-amber-100">Apparel Catalog Shelf</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              {/* Search catalog */}
              <div className="relative flex-1 sm:w-48">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  id="catalog-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter garments..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-slate-200 focus:outline-none"
                />
              </div>

              {/* Category selector */}
              <select
                id="catalog-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-[11px] text-slate-300 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog grid */}
          <div className="grid grid-cols-2 tablet:grid-cols-4 laptop:grid-cols-6 desktop1600:grid-cols-8 desktop1920:grid-cols-10 gap-1.5 overflow-y-auto xl:max-h-[calc(100vh-var(--header-height)-155px)] max-h-[460px] pr-1">
            {catalogProducts.map((p) => {
              const isLow = p.currentStock <= p.minStockAlert;
              const isOut = p.currentStock === 0;

              return (
                <button
                  key={p.id}
                  id={`catalog-item-${p.id}`}
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className={`bg-slate-950/40 hover:bg-slate-900/60 border rounded-lg p-2 text-left transition-all duration-150 relative flex gap-2 items-center h-[82px] select-none hover:border-amber-500/80 hover:shadow-md hover:shadow-amber-500/5 group text-xs ${
                    isOut ? 'opacity-40 border-slate-850 cursor-not-allowed' : 'border-slate-800/80'
                  }`}
                >
                  {/* Info Panel Left */}
                  <div className="flex-1 min-w-0 h-full flex flex-col justify-between py-0.5">
                    <div>
                      {/* Name - Bold */}
                      <h4 className="font-sans font-bold text-slate-200 text-xs truncate group-hover:text-amber-300 transition" title={p.name}>
                        {p.name}
                      </h4>
                      {/* Brand */}
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        Brand: {p.brand}
                      </p>
                    </div>

                    {/* Specs & Stock row */}
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      Size: {p.size} | Stock: <span className={isOut ? 'text-red-500 font-semibold' : isLow ? 'text-amber-500 font-semibold' : ''}>{p.currentStock}</span>
                    </p>

                    {/* Price row */}
                    <div className="pt-0.5 border-t border-slate-900/40">
                      <span className="text-[11px] font-mono font-bold text-amber-200">
                        {formatINR(p.sellingPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Right side: [+] quick add button */}
                  <div className="flex-shrink-0 flex items-center justify-center pl-1 h-full">
                    <div className="bg-amber-500/10 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-400 w-6 h-6 rounded flex items-center justify-center transition duration-150 shrink-0">
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* POS Cart Summary & Customer Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between xl:h-[calc(100vh-var(--header-height)-64px)] h-auto min-h-[500px] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <h3 className="font-serif text-sm font-bold text-amber-100 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-500" />
              Checkout Basket
            </h3>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono font-semibold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items
            </span>
          </div>

          {/* Transaction Holding / Resuming Actions Row */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <button
              type="button"
              id="hold-bill-btn"
              onClick={handleHoldBill}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 rounded-lg text-amber-200 hover:text-amber-400 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Place the current cart items on hold (F5)"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Hold Bill (F5)
            </button>
            <button
              type="button"
              id="resume-bill-btn"
              onClick={handleF6Resume}
              className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 rounded-lg text-slate-300 hover:text-white font-medium transition relative"
              title="Restore a transaction that was placed on hold (F6)"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Resume ({heldBills.length}) (F6)
              {heldBills.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 text-[8px] font-bold text-slate-950 flex items-center justify-center rounded-full animate-bounce">
                  {heldBills.length}
                </span>
              )}
            </button>
          </div>

          {/* Cart item listing */}
          <div className="overflow-y-auto xl:max-h-[calc(100vh-var(--header-height)-475px)] max-h-[220px] min-h-[120px] space-y-2 pr-1 text-xs">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ShoppingCart className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                Checkout basket is empty. Select garments above to build order.
              </div>
            ) : (
              cart.map((item, idx) => {
                const itemPrice = item.product.sellingPrice;
                let checkoutPrice = itemPrice;
                if (item.customDiscount > 0) {
                  if (item.customDiscountType === 'percentage') {
                    checkoutPrice = itemPrice * (1 - item.customDiscount / 100);
                  } else {
                    checkoutPrice = Math.max(0, itemPrice - item.customDiscount);
                  }
                }

                const isHighlighted = idx === selectedCartIndex;

                return (
                  <div 
                    key={item.product.id} 
                    onClick={() => setSelectedCartIndex(idx)}
                    className={`p-2.5 rounded-lg flex flex-col gap-2 relative cursor-pointer border transition-all duration-300 ${
                      isHighlighted 
                        ? 'bg-amber-500/[0.03] border-amber-500 shadow-[0_0_12px_rgba(212,175,55,0.06)]' 
                        : 'bg-slate-950/60 border-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="max-w-[75%]">
                        <h4 className="font-bold text-slate-200 truncate flex items-center gap-1.5">
                          {item.product.name}
                          {isHighlighted && (
                            <span className="text-[7px] bg-amber-500/15 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase font-mono font-bold tracking-wider">Focused</span>
                          )}
                        </h4>
                        <p className="text-[9px] text-slate-500 mt-0.5">SIZE: {item.product.size} | SKU: {item.product.sku}</p>
                        {(() => {
                          const bogoUnlockMsg = getBogoUnlockMessage(item);
                          if (bogoUnlockMsg) {
                            return (
                              <span className="mt-1 text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md block leading-tight w-fit animate-pulse animate-duration-1000">
                                Add 1 more item to unlock FREE product.
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <button
                        id={`btn-cart-remove-${item.product.id}`}
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quantity controls & item level discounts */}
                    <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded-md border border-slate-900">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQty(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-amber-400"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-slate-200 px-1">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-amber-400"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Disc setup */}
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-slate-500">Disc:</span>
                        <input
                          id={`cart-disc-${item.product.id}`}
                          type="number"
                          value={item.customDiscount || ''}
                          onChange={(e) => updateItemDiscount(item.product.id, Number(e.target.value), item.customDiscountType)}
                          placeholder="0"
                          className="w-8 bg-slate-900 border border-slate-850 rounded text-center font-mono py-0.5 text-amber-200 focus:outline-none"
                          min="0"
                        />
                        <select
                          id={`cart-disc-type-${item.product.id}`}
                          value={item.customDiscountType}
                          onChange={(e) => updateItemDiscount(item.product.id, item.customDiscount, e.target.value as any)}
                          className="bg-slate-900 text-slate-400 rounded text-[9px] focus:outline-none py-0.5 border-transparent"
                        >
                          <option value="percentage">%</option>
                          <option value="flat">₹</option>
                        </select>
                      </div>

                      <span className="font-mono font-bold text-amber-200">
                        {formatINR(checkoutPrice * item.quantity, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer actions / Customer linking / Coupons / Checkout sum */}
        <div className="space-y-4 border-t border-slate-850 pt-4 text-xs">
          {/* Customer Attachment */}
          <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-amber-500" /> Link Customer Profile</span>
              {phone && isNewCust && <span className="text-amber-500 text-[8px] animate-pulse">New Profile</span>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                id="pos-cust-phone"
                type="text"
                value={phone}
                onChange={handlePhoneLookup}
                placeholder="Client Mobile Phone..."
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 font-mono text-slate-200 focus:outline-none placeholder-slate-600"
              />
              <input
                id="pos-cust-name"
                type="text"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder={isNewCust ? "Add New Client Name..." : "Walk-in Client"}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none placeholder-slate-600"
                disabled={phone.length < 7 && !isNewCust}
              />
            </div>
            {phone.length >= 7 && !isNewCust && custName && (
              <p className="text-[9px] text-amber-500/70">
                Connected Patron Profile.
              </p>
            )}
            {phone.length >= 7 && (
              <div className="flex items-center gap-1.5 mt-2 p-1.5 rounded bg-slate-900/60 border border-slate-850 text-[10px] animate-fade-in">
                {isScanningCoupons ? (
                  <>
                    <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
                    <span className="text-slate-400 font-mono text-[9px] animate-pulse">{scanMessage}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-medium text-[9px]">{scanMessage}</span>
                    {activeCustomerCoupons.length > 0 && (
                      <span className="ml-auto font-mono text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded font-extrabold uppercase tracking-wider animate-bounce shrink-0">
                        Best Applied!
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Discount Card Attachment & Barcode Scanner */}
          <div className="bg-gradient-to-br from-amber-500/5 to-yellow-600/5 border border-amber-500/20 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-amber-400 uppercase tracking-wider font-bold">
              <span className="flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-amber-500" />
                Scan Discount Card
              </span>
              <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono font-medium">Auto-Detect</span>
            </div>

            <div className="flex gap-1">
              <input
                id="pos-card-input"
                type="text"
                value={discountCardNo}
                onChange={(e) => handleCardLookup(e.target.value)}
                placeholder="Scan Card / Enter Card Number (SFD-xxxx-xxxx)"
                className="flex-1 bg-slate-950 border border-amber-500/20 rounded px-2 py-1 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-500/50 placeholder-slate-650"
              />
              {discountCardNo && (
                <button
                  id="btn-clear-pos-card"
                  type="button"
                  onClick={() => {
                    setDiscountCardNo('');
                    setActiveDiscountCard(null);
                    setDiscountCardFeedback('');
                  }}
                  className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 px-2 rounded text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {discountCardFeedback && (
              <p className={`text-[10px] font-medium leading-none ${activeDiscountCard ? 'text-amber-400 animate-pulse' : 'text-red-400'}`}>
                {discountCardFeedback}
              </p>
            )}

            {/* Quick simulator trigger links */}
            <div className="pt-1.5 border-t border-slate-900">
              <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Simulate Handheld Scanner Gun Beep:</p>
              <div className="flex flex-wrap gap-1">
                {discountCards.slice(0, 3).map((card) => (
                  <button
                    key={card.id}
                    id={`btn-scan-simulate-${card.id}`}
                    type="button"
                    onClick={() => handleCardLookup(card.cardNumber)}
                    className="text-[9px] bg-slate-950 border border-slate-850 hover:border-amber-500/40 text-slate-400 hover:text-amber-400 px-2 py-0.5 rounded font-mono transition"
                  >
                    📟 Beep {card.cardNumber.slice(-4)} ({card.cardType ? card.cardType.toUpperCase() : 'MEMBER'})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Best Available Coupon Auto-Apply Banner */}
          {bestCouponResult && bestCouponResult.savings > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 font-sans">
                    Auto-Applied Best Coupon
                  </span>
                </div>
                {!manuallySelectedCouponCode ? (
                  <span className="text-[8px] uppercase px-1.5 py-0.5 bg-amber-500 text-slate-950 font-extrabold rounded">
                    Auto-Best
                  </span>
                ) : (
                  <span className="text-[8px] uppercase px-1.5 py-0.5 bg-emerald-500 text-slate-950 font-extrabold rounded">
                    Cashier Override
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-850">
                <div>
                  <p className="text-xs font-mono font-bold text-slate-100 tracking-wider">
                    {couponCode || bestCouponResult.code}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Est. Coupon Savings: <span className="text-emerald-400 font-bold">{formatINR(bestCouponResult.savings, { keepDecimals: true })}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  {activeCustomerCoupons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('active-coupons-panel');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                        showToast?.('Choose any other coupon from the list below to override!', 'info');
                      }}
                      className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[9px] px-2 py-1 rounded font-bold uppercase cursor-pointer"
                    >
                      Change Coupon
                    </button>
                  )}
                  {manuallySelectedCouponCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setManuallySelectedCouponCode(null);
                        setCouponFeedback('Restored automatically determined best coupon.');
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] px-2 py-1 rounded font-bold uppercase cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Coupon Input */}
          {!settings?.couponAutomation?.enabled && (
            <form onSubmit={handleApplyCoupon} className="flex gap-1">
              <input
                id="pos-coupon-input"
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Coupon Offer (e.g. GOLDEN15)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono focus:outline-none placeholder-slate-600 uppercase"
              />
              <button
                id="pos-coupon-apply"
                type="submit"
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded text-[10px] uppercase font-bold"
              >
                Apply
              </button>
            </form>
          )}
          {couponFeedback && !settings?.couponAutomation?.enabled && (
            <p className={`text-[9px] ${couponFeedback.includes('Applied') || couponFeedback.includes('selected') ? 'text-emerald-400' : 'text-red-400'}`}>
              {couponFeedback}
            </p>
          )}

          {/* Progress Bar for Next Coupon Tier */}
          {!settings?.couponAutomation?.enabled && nextCouponTier && (
            <div id="next-coupon-tier-progress" className="bg-slate-950/40 border border-slate-850/60 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider font-sans">
                <span className="text-slate-400">Unlock Next Tier Coupon</span>
                <span className="text-amber-500 font-mono font-extrabold">{nextCouponTier.offer.code}</span>
              </div>
              
              <div className="space-y-1">
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${nextCouponTier.pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>Current: {formatINR(subtotal, { keepDecimals: false })}</span>
                  <span>Target: {formatINR(nextCouponTier.minBill, { keepDecimals: false })}</span>
                </div>
              </div>
              
              <p className="text-[10px] text-slate-300">
                Spend <span className="text-amber-400 font-mono font-bold">{formatINR(nextCouponTier.needed, { keepDecimals: true })}</span> more to unlock <span className="font-semibold text-slate-100">{nextCouponTier.offer.name}</span>!
              </p>
            </div>
          )}

          {/* Active Customer Coupons Panel */}
          {activeCustomerCoupons.length > 0 && (
            <div id="active-coupons-panel" className="bg-slate-950/50 border border-slate-850 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 block font-sans">
                  🎫 Linked Active Coupons ({activeCustomerCoupons.length})
                </span>
                {manuallySelectedCouponCode && (
                  <button
                    type="button"
                    onClick={() => setManuallySelectedCouponCode(null)}
                    className="text-[9px] text-amber-500 hover:text-amber-400 underline font-mono cursor-pointer bg-transparent border-none p-0"
                  >
                    Reset Auto-Best
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeCustomerCoupons.map((coupon) => {
                  const offer = offers.find((o) => o.id === coupon.offerId) || (
                    (coupon.offerId === 'auto_automation_offer' || coupon.discountType) ? {
                      id: coupon.offerId || 'auto_automation_offer',
                      name: coupon.discountType === 'percentage' 
                        ? `${coupon.discountValue}% OFF` 
                        : `₹${coupon.discountValue} OFF`,
                      code: coupon.code,
                      type: coupon.discountType === 'percentage' ? 'percentage' : 'flat',
                      value: coupon.discountValue ?? 0,
                      offerCategory: 'coupon',
                      requireCoupon: true,
                      isActive: true,
                      minPurchaseAmount: coupon.minPurchaseAmount ?? 0,
                      minBillAmount: coupon.minPurchaseAmount ?? 0,
                      alwaysActive: true,
                    } : null
                  );
                  const isApplied = couponCode.toUpperCase() === coupon.code.toUpperCase();
                  const isBest = bestCouponResult?.code === coupon.code;
                  
                  return (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => {
                        setManuallySelectedCouponCode(coupon.code);
                        setCouponFeedback(`Selected: ${coupon.code}`);
                      }}
                      className={`w-full text-left p-2 rounded border text-xs transition relative group cursor-pointer ${
                        isApplied
                          ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                          : 'bg-slate-900/40 border-slate-850 hover:border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-slate-200 tracking-wider">
                          {coupon.code}
                          {isBest && (
                            <span className="ml-1 px-1 py-0.5 text-[8px] bg-amber-500 text-slate-950 font-sans font-extrabold rounded animate-pulse">
                              BEST VALUE
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Exp: {coupon.expiryDate}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {offer ? offer.name : 'Loyalty Reward Coupon'}
                      </div>
                      {isApplied && (
                        <div className="absolute right-2 top-2 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Highlight Applied Offers / Recommendations */}
          {evaluationResult.appliedOffers.length > 0 ? (
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block font-sans">✓ ACTIVATED BEST OFFER</span>
              <div className="space-y-1">
                {evaluationResult.appliedOffers.map((ap, idx) => (
                  <div key={idx} className="flex flex-col text-[11px] font-sans pl-1.5 border-l border-emerald-500/30">
                    <span className="font-bold text-slate-100 text-xs">{ap.offer.name}</span>
                    <span className="text-[9px] text-slate-400 block leading-tight mb-1">{ap.description}</span>
                    <span className="text-emerald-400 font-bold text-[11px] font-mono">Savings {formatINR(ap.savings, { keepDecimals: false })}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            bestRecommendation && (
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block font-sans">⭐ BEST AVAILABLE OFFER</span>
                <div className="space-y-1 text-slate-200">
                  <div className="font-sans font-bold text-slate-100 text-xs">{bestRecommendation.offer.name}</div>
                  <div className="text-[10px] text-slate-300 font-sans mt-0.5">{bestRecommendation.message}</div>
                  {bestRecommendation.potentialSavings > 0 && (
                    <div className="text-[10px] font-bold text-emerald-400 font-mono mt-1">
                      Potential Saving {formatINR(bestRecommendation.potentialSavings, { keepDecimals: false })}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Free Products Added Automatically */}
          {evaluationResult.freeProducts.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5 space-y-1.5">
              <span className="text-[9px] uppercase font-bold tracking-wider text-amber-400 block">🎁 Complimentary Add-ons & Gifts:</span>
              <div className="space-y-1.5">
                {evaluationResult.freeProducts.map((fp, idx) => {
                  const label = fp.isGift 
                    ? (fp.price === 0 ? '🎁 Complimentary Gift' : '🎁 Promotional Gift')
                    : 'BOGO Reward';
                  return (
                    <div key={idx} className="flex justify-between items-center text-[11px] font-mono text-slate-200 pl-2 border-l border-amber-500/30">
                      <div>
                        <span className="font-sans font-semibold text-amber-200 block leading-tight">{fp.product.name}</span>
                        <span className="text-[9px] text-slate-400 font-sans block">{label} | Qty: {fp.quantity} ({fp.offerCode})</span>
                      </div>
                      <span className="text-amber-400 font-bold whitespace-nowrap">{fp.price > 0 ? `₹${fp.price * fp.quantity}` : 'FREE'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Out of Stock Gifts Warnings */}
          {evaluationResult.unavailableGifts && evaluationResult.unavailableGifts.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-2.5 space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider text-rose-400 block">⚠️ Gift Currently Unavailable:</span>
              <div className="space-y-1.5">
                {evaluationResult.unavailableGifts.map((ug, idx) => (
                  <div key={idx} className="text-[11px] font-mono text-rose-300 pl-2 border-l border-rose-500/30">
                    <span className="font-sans font-semibold text-rose-200 block leading-tight">{ug.offerName}</span>
                    <span className="text-[9px] text-slate-400 font-sans block">Gift "{ug.giftName}" currently unavailable (Out of stock)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Ledger Status (Only if Previous Due Exists & customer identified) */}
          {previousOutstandingAmount > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-200 font-sans flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  🧾 CUSTOMER LEDGER STATUS
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border font-mono ${
                  isAnyOverdue
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {isAnyOverdue ? 'OVERDUE' : 'PENDING DUE'}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span className="font-sans text-slate-400">Previous Outstanding:</span>
                  <span className={`font-bold ${isAnyOverdue ? 'text-rose-400' : 'text-amber-400'}`}>
                    {formatINR(previousOutstandingAmount, { keepDecimals: true })}
                  </span>
                </div>

                {oldestDueDate && (
                  <div className="flex justify-between text-slate-300">
                    <span className="font-sans text-slate-400">Oldest Due Date:</span>
                    <span className="text-slate-200">{formatDateDisplay(oldestDueDate)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-300">
                  <span className="font-sans text-slate-400">Pending Invoices:</span>
                  <span className="font-bold text-slate-200">{priorCreditInvoices.length}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-850/80">
                <label className="flex items-center gap-2 text-[11px] text-amber-300 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={collectPreviousDue}
                    onChange={(e) => setCollectPreviousDue(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500 bg-slate-950 border-slate-700 rounded"
                  />
                  <span>Collect Previous Due with Current Bill</span>
                </label>
              </div>
            </div>
          )}

          {/* Checkout Totals */}
          <div className="space-y-1.5 font-mono text-xs border-b border-dashed border-slate-850 pb-2">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>{formatINR(subtotal, { keepDecimals: true })}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Paid Quantity:</span>
              <span>{totalPaidQuantity} {totalPaidQuantity === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Free Quantity:</span>
              <span>{totalFreeQuantity} {totalFreeQuantity === 1 ? 'item' : 'items'}</span>
            </div>
             <div className={`flex justify-between ${couponDiscountWithoutGiftSavings > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
               <span>Offer Savings:</span>
               <span>{couponDiscountWithoutGiftSavings > 0 ? `-${formatINR(couponDiscountWithoutGiftSavings, { keepDecimals: true })}` : `₹0.00`}</span>
             </div>
             {giftPromoPrice > 0 && (
               <div className="flex justify-between text-amber-300 font-semibold">
                 <span>Promotional Gift Price:</span>
                 <span>+{formatINR(giftPromoPrice, { keepDecimals: true })}</span>
               </div>
             )}
            {cardDiscount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Card Discount ({getCardAppliedPercentage()}%):</span>
                <span>-{formatINR(cardDiscount, { keepDecimals: true })}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400 text-[10px]">
              <span>Tax (GST {settings.storeProfile.defaultGstRate}% Inclusive):</span>
              <span>{formatINR(gstAmount, { keepDecimals: true })}</span>
            </div>
            {collectPreviousDue && previousOutstandingAmount > 0 && (
              <>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-850/40">
                  <span>Current Invoice:</span>
                  <span>{formatINR(checkoutAmount, { keepDecimals: true })}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span>Previous Outstanding:</span>
                  <span>+{formatINR(previousOutstandingAmount, { keepDecimals: true })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-amber-200 font-bold text-sm border-t border-slate-850/60 pt-1.5">
              <span>{collectPreviousDue && previousOutstandingAmount > 0 ? 'Total Amount Payable:' : 'Final Amount:'}</span>
              <span>{formatINR(effectivePayableAmount, { keepDecimals: true })}</span>
            </div>
          </div>

          {/* Live Settlement Breakdown when collecting previous due */}
          {collectPreviousDue && previousOutstandingAmount > 0 && (() => {
            const currentRec = paymentMethod === 'cash'
              ? (cashTendered !== '' ? Number(cashTendered) : effectivePayableAmount)
              : paymentMethod === 'credit'
              ? (creditAmountPaid !== '' ? Number(creditAmountPaid) : 0)
              : effectivePayableAmount;

            const livePrevPaid = Math.min(previousOutstandingAmount, currentRec);
            const liveCurrentApplied = Math.max(0, currentRec - livePrevPaid);
            const liveCurrentBal = Math.max(0, checkoutAmount - liveCurrentApplied);
            const liveTotalRem = Math.max(0, effectivePayableAmount - currentRec);

            return (
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-2.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center text-[10px] uppercase text-amber-400 font-sans font-bold border-b border-slate-850 pb-1">
                  <span>⚡ Ledger Settlement Live Preview</span>
                  <span className="text-slate-400 font-normal">Priority: Previous Due First</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-sans text-slate-400">1. Clear Previous Outstanding:</span>
                  <span className="font-bold text-emerald-400">+{formatINR(livePrevPaid, { keepDecimals: true })}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-sans text-slate-400">2. Apply to Current Invoice:</span>
                  <span className="font-bold text-slate-200">+{formatINR(liveCurrentApplied, { keepDecimals: true })}</span>
                </div>
                {liveCurrentBal > 0 && (
                  <div className="flex justify-between text-slate-400 text-[10px]">
                    <span className="font-sans text-slate-500">Current Invoice Remaining:</span>
                    <span className="text-rose-400 font-bold">{formatINR(liveCurrentBal, { keepDecimals: true })}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-200 font-bold text-xs pt-1 border-t border-slate-800">
                  <span>Remaining Total Outstanding:</span>
                  <span className={liveTotalRem > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    {liveTotalRem > 0 ? formatINR(liveTotalRem, { keepDecimals: true }) : '₹0.00 (PAID IN FULL)'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Payment Authorization</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'cash', label: 'Cash Payment', icon: IndianRupee },
                { id: 'upi', label: 'UPI G-Pay / QR', icon: Smartphone },
                { id: 'card', label: 'Card Payment', icon: CreditCard },
                { id: 'credit', label: 'Credit (Udhar)', icon: BookOpen },
              ].map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    id={`payment-${m.id}`}
                    type="button"
                    onClick={() => {
                      if (m.id === 'upi') {
                        if (cart.length === 0) {
                          showToast?.('Cart is empty. Please add items before initiating UPI payment.', 'error');
                          return;
                        }
                        const upiId = settings.storeProfile.upiId;
                        if (!upiId || upiId.trim() === '') {
                          showToast?.('Please configure the store UPI ID in Payment Settings.', 'error');
                          return;
                        }
                        setPaymentMethod('upi');
                        const provInvoiceNo = generateProvisionalInvoiceNo('SF');
                        handleOpenUpiModal('products', effectivePayableAmount, provInvoiceNo, () => {
                          executeProductsCheckout();
                        });
                      } else {
                        setPaymentMethod(m.id as any);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition ${
                      active
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-bold'
                        : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[8px] font-bold uppercase">{m.id === 'card' ? 'Card' : m.id === 'credit' ? 'Credit' : m.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
            {paymentMethod === 'cash' && (
              <div className="space-y-1 bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg mt-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="uppercase font-bold tracking-wider text-slate-400">Cash Tendered</span>
                  {cashTendered && Number(cashTendered) > effectivePayableAmount && (
                    <span className="text-emerald-400 font-bold font-mono">
                      Change: {formatINR(Number(cashTendered) - effectivePayableAmount, { keepDecimals: true })}
                    </span>
                  )}
                </div>
                <input
                  id="pos-cash-tendered-input"
                  type="number"
                  step="any"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={`Min ₹${effectivePayableAmount.toFixed(2)}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none placeholder-slate-600"
                />
              </div>
            )}

            {paymentMethod === 'credit' && (
              <div className="space-y-2.5 bg-slate-950/70 border border-amber-500/30 p-3 rounded-lg mt-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Credit Sale (Udhar) Panel
                  </span>
                  <span className="text-[9px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                    Deferred Payment
                  </span>
                </div>

                {(!phone || phone.length < 7) && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    Customer selection is MANDATORY for Credit Sales.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                    <span className="text-slate-400 block text-[9px] uppercase">Invoice Total</span>
                    <span className="text-amber-200 font-mono font-bold text-xs">{formatINR(checkoutAmount)}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                    <span className="text-slate-400 block text-[9px] uppercase">Balance Due</span>
                    <span className="text-rose-400 font-mono font-bold text-xs">
                      {formatINR(Math.max(0, checkoutAmount - (Number(creditAmountPaid) || 0)))}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-medium flex justify-between">
                    <span>Down Payment / Amount Paid (₹)</span>
                    <span className="text-slate-500 text-[9px]">Default 0 if unpaid</span>
                  </label>
                  <input
                    id="pos-credit-amount-paid"
                    type="number"
                    step="any"
                    min="0"
                    max={checkoutAmount}
                    value={creditAmountPaid}
                    onChange={(e) => setCreditAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" /> Due Date <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative premium-date-container group">
                    <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                    <input
                      id="pos-credit-due-date"
                      type="date"
                      value={creditDueDate}
                      onChange={(e) => setCreditDueDate(e.target.value)}
                      required
                      className="peer w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500/50 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400">Reason (Optional)</label>
                    <input
                      id="pos-credit-reason"
                      type="text"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      placeholder="e.g. Wedding order..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500/50 placeholder-slate-650"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400">Remarks (Optional)</label>
                    <input
                      id="pos-credit-remarks"
                      type="text"
                      value={creditRemarks}
                      onChange={(e) => setCreditRemarks(e.target.value)}
                      placeholder="e.g. Promised on pickup..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500/50 placeholder-slate-650"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Checkout Submit Trigger */}
          <button
            id="pos-submit-sale"
            onClick={handleCheckoutSubmit}
            disabled={cart.length === 0 || isGeneratingBill}
            className="w-full gold-gradient text-slate-950 font-bold tracking-widest uppercase py-3 rounded-lg text-xs shadow-lg hover:opacity-90 transition active:scale-98 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGeneratingBill ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>GENERATING BILL...</span>
              </>
            ) : (
              <span>GENERATE BILL</span>
            )}
          </button>
        </div>
      </div>
      </div>
      ) : (
        /* ======================== FABRICS POS BILLING INTERFACE (EXACT CLONE OF PRODUCTS BILL) ======================== */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="fabric-billing-layout">
          {/* Catalog & Barcode Scanner Panel */}
          <div className="xl:col-span-2 space-y-4">
            {/* Barcode scan simulator bar */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <form onSubmit={handleFabricBarcodeScan} className="flex gap-2 text-xs">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-500/60">
                    <Barcode className="w-5 h-5" />
                  </span>
                  <input
                    id="fabric-barcode-scanner-simulator"
                    type="text"
                    value={fabricSkuInput}
                    onChange={(e) => {
                      setFabricSkuInput(e.target.value);
                      if (fabricScanError) setFabricScanError('');
                    }}
                    autoComplete="off"
                    placeholder="Auto-Scan Active (Enter / Laser Scan Fabric Barcode / SKU e.g., FAB-RAY-001)..."
                    className={`w-full bg-slate-950 border rounded-lg py-3 pl-11 pr-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                      fabricScanError ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-amber-500'
                    }`}
                  />
                </div>
                <button
                  id="simulate-fabric-scan-btn"
                  type="submit"
                  className="gold-gradient text-slate-950 px-5 rounded-lg font-extrabold uppercase tracking-widest text-[10px] cursor-pointer"
                >
                  Scan
                </button>
              </form>

              {fabricScanError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="font-semibold">{fabricScanError}</span>
                </div>
              )}
            </div>

            {/* Catalog Selector Panel */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h3 className="font-serif text-sm font-bold text-amber-100">Fabric Catalog Shelf</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  {/* Search catalog */}
                  <div className="relative flex-1 sm:w-48">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      id="fabric-catalog-search"
                      type="text"
                      value={fabricSearchTerm}
                      onChange={(e) => setFabricSearchTerm(e.target.value)}
                      placeholder="Filter fabrics..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-slate-200 focus:outline-none"
                    />
                  </div>

                  {/* Category selector */}
                  <select
                    id="fabric-catalog-category"
                    value={fabricSelectedCategory}
                    onChange={(e) => setFabricSelectedCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-[11px] text-slate-300 focus:outline-none"
                  >
                    {fabricCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Catalog grid */}
              <div className="grid grid-cols-2 tablet:grid-cols-4 laptop:grid-cols-6 desktop1600:grid-cols-8 desktop1920:grid-cols-10 gap-1.5 overflow-y-auto xl:max-h-[calc(100vh-var(--header-height)-155px)] max-h-[460px] pr-1">
                {catalogFabrics.map((f) => {
                  const isLow = f.stockMeters <= 5;
                  const isOut = f.stockMeters <= 0;

                  return (
                    <button
                      key={f.id}
                      id={`fabric-catalog-item-${f.id}`}
                      onClick={() => addFabricToCart(f, 1.0)}
                      disabled={isOut}
                      className={`bg-slate-950/40 hover:bg-slate-900/60 border rounded-lg p-2 text-left transition-all duration-150 relative flex gap-2 items-center h-[82px] select-none hover:border-amber-500/80 hover:shadow-md hover:shadow-amber-500/5 group text-xs ${
                        isOut ? 'opacity-40 border-slate-850 cursor-not-allowed' : 'border-slate-800/80'
                      }`}
                    >
                      {/* Info Panel Left */}
                      <div className="flex-1 min-w-0 h-full flex flex-col justify-between py-0.5">
                        <div>
                          {/* Name - Bold */}
                          <h4 className="font-sans font-bold text-slate-200 text-xs truncate group-hover:text-amber-300 transition" title={f.name}>
                            {f.name}
                          </h4>
                          {/* Brand */}
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            Brand: {f.brand || '-'}
                          </p>
                        </div>

                        {/* Specs & Stock row */}
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {f.color ? `Color: ${f.color} | ` : ''}Stock: <span className={isOut ? 'text-red-500 font-semibold' : isLow ? 'text-amber-500 font-semibold' : ''}>{f.stockMeters.toFixed(2)}M</span>
                        </p>

                        {/* Price row */}
                        <div className="pt-0.5 border-t border-slate-900/40">
                          <span className="text-[11px] font-mono font-bold text-amber-200">
                            ₹{f.retailRate}/M
                          </span>
                        </div>
                      </div>

                      {/* Right side: [+] quick add button */}
                      <div className="flex-shrink-0 flex items-center justify-center pl-1 h-full">
                        <div className="bg-amber-500/10 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-400 w-6 h-6 rounded flex items-center justify-center transition duration-150 shrink-0">
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* POS Cart Summary & Customer Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between xl:h-[calc(100vh-var(--header-height)-64px)] h-auto min-h-[500px] overflow-y-auto scrollbar-thin">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <h3 className="font-serif text-sm font-bold text-amber-100 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  Checkout Basket
                </h3>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono font-semibold">
                  {fabricTotalMeters.toFixed(2)} M ({fabricCart.length} {fabricCart.length === 1 ? 'item' : 'items'})
                </span>
              </div>

              {/* Cart item listing */}
              <div className="overflow-y-auto xl:max-h-[calc(100vh-var(--header-height)-475px)] max-h-[220px] min-h-[120px] space-y-2 pr-1 text-xs">
                {fabricCart.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <ShoppingCart className="w-10 h-10 text-slate-800 mx-auto mb-2" />
                    Checkout basket is empty. Select fabrics above to build order.
                  </div>
                ) : (
                  fabricCart.map((item, idx) => {
                    const itemRate = item.ratePerMeter;
                    let checkoutPrice = itemRate;
                    if (item.customDiscount && item.customDiscount > 0) {
                      if (item.customDiscountType === 'percentage') {
                        checkoutPrice = itemRate * (1 - item.customDiscount / 100);
                      } else {
                        checkoutPrice = Math.max(0, itemRate - item.customDiscount / Math.max(0.1, item.meters));
                      }
                    }

                    const isHighlighted = idx === selectedFabricCartIndex;

                    return (
                      <div
                        key={item.fabric.id + '-' + idx}
                        onClick={() => setSelectedFabricCartIndex(idx)}
                        className={`p-2.5 rounded-lg flex flex-col gap-2 relative cursor-pointer border transition-all duration-300 ${
                          isHighlighted
                            ? 'bg-amber-500/[0.03] border-amber-500 shadow-[0_0_12px_rgba(212,175,55,0.06)]'
                            : 'bg-slate-950/60 border-slate-850 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="max-w-[75%]">
                            <h4 className="font-bold text-slate-200 truncate flex items-center gap-1.5">
                              {item.fabric.name}
                              {isHighlighted && (
                                <span className="text-[7px] bg-amber-500/15 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase font-mono font-bold tracking-wider">Focused</span>
                              )}
                            </h4>
                            <p className="text-[9px] text-slate-500 mt-0.5">BRAND: {item.fabric.brand} | COLOR: {item.fabric.color || '-'} | SKU: {item.fabric.sku}</p>
                          </div>
                          <button
                            id={`btn-fabric-cart-remove-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFabricFromCart(idx);
                            }}
                            className="text-slate-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Meter controls & item level discounts */}
                        <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded-md border border-slate-900">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateFabricMeters(idx, Math.max(0.1, Number((item.meters - 0.5).toFixed(2))));
                              }}
                              className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-amber-400"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={item.meters}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  updateFabricMeters(idx, val);
                                }
                              }}
                              className="w-12 bg-slate-900 border border-slate-850 rounded text-center font-mono py-0.5 text-slate-200 text-xs focus:outline-none"
                            />
                            <span className="font-mono text-[10px] text-slate-400">M</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateFabricMeters(idx, Number((item.meters + 0.5).toFixed(2)));
                              }}
                              className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-amber-400"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Disc setup */}
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-slate-500">Disc:</span>
                            <input
                              id={`fabric-cart-disc-${idx}`}
                              type="number"
                              value={item.customDiscount || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateFabricItemDiscount(idx, Number(e.target.value), item.customDiscountType || 'percentage')}
                              placeholder="0"
                              className="w-8 bg-slate-900 border border-slate-850 rounded text-center font-mono py-0.5 text-amber-200 focus:outline-none"
                              min="0"
                            />
                            <select
                              id={`fabric-cart-disc-type-${idx}`}
                              value={item.customDiscountType || 'percentage'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateFabricItemDiscount(idx, item.customDiscount || 0, e.target.value as any)}
                              className="bg-slate-900 text-slate-400 rounded text-[9px] focus:outline-none py-0.5 border-transparent"
                            >
                              <option value="percentage">%</option>
                              <option value="flat">₹</option>
                            </select>
                          </div>

                          <span className="font-mono font-bold text-amber-200">
                            {formatINR(checkoutPrice * item.meters, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer actions / Customer linking / Discounts / Checkout sum */}
            <div className="space-y-4 border-t border-slate-850 pt-4 text-xs">
              {/* Customer Attachment */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-amber-500" /> Link Customer Profile</span>
                  {fabricPhone && isFabricNewCust && <span className="text-amber-500 text-[8px] animate-pulse">New Profile</span>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="pos-fabric-cust-phone"
                    type="text"
                    value={fabricPhone}
                    onChange={handleFabricPhoneLookup}
                    placeholder="Client Mobile Phone..."
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 font-mono text-slate-200 focus:outline-none placeholder-slate-600"
                  />
                  <input
                    id="pos-fabric-cust-name"
                    type="text"
                    value={fabricCustName}
                    onChange={(e) => setFabricCustName(e.target.value)}
                    placeholder={isFabricNewCust ? "Add New Client Name..." : "Walk-in Client"}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none placeholder-slate-600"
                    disabled={fabricPhone.length < 7 && !isFabricNewCust}
                  />
                </div>
                {fabricPhone.length >= 7 && !isFabricNewCust && fabricCustName && (
                  <p className="text-[9px] text-amber-500/70">
                    Connected Patron Profile.
                  </p>
                )}
              </div>

              {/* Flat Discount / Bill Level Discount */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2.5 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-500" /> Bill Discount (₹)
                </span>
                <input
                  id="fabric-bill-discount-input"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={fabricDiscount}
                  onChange={(e) => setFabricDiscount(e.target.value)}
                  className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right font-mono text-xs text-amber-200 focus:outline-none focus:border-amber-500/50 placeholder-slate-600"
                />
              </div>

              {/* Customer Ledger Status (Only if Previous Due Exists & customer identified) */}
              {fabricPreviousOutstandingAmount > 0 && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-200 font-sans flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      🧾 CUSTOMER LEDGER STATUS
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border font-mono ${
                      fabricIsAnyOverdue
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {fabricIsAnyOverdue ? 'OVERDUE' : 'PENDING DUE'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span className="font-sans text-slate-400">Previous Outstanding:</span>
                      <span className={`font-bold ${fabricIsAnyOverdue ? 'text-rose-400' : 'text-amber-400'}`}>
                        {formatINR(fabricPreviousOutstandingAmount, { keepDecimals: true })}
                      </span>
                    </div>

                    {fabricOldestDueDate && (
                      <div className="flex justify-between text-slate-300">
                        <span className="font-sans text-slate-400">Oldest Due Date:</span>
                        <span className="text-slate-200">{formatDateDisplay(fabricOldestDueDate)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-300">
                      <span className="font-sans text-slate-400">Pending Invoices:</span>
                      <span className="font-bold text-slate-200">{fabricPriorCreditInvoices.length}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-850/80">
                    <label className="flex items-center gap-2 text-[11px] text-amber-300 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fabricCollectPreviousDue}
                        onChange={(e) => setFabricCollectPreviousDue(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 bg-slate-950 border-slate-700 rounded"
                      />
                      <span>Collect Previous Due with Current Bill</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Checkout Totals */}
              <div className="space-y-1.5 font-mono text-xs border-b border-dashed border-slate-850 pb-2">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>{formatINR(fabricSubtotal, { keepDecimals: true })}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Cut Meters:</span>
                  <span>{fabricTotalMeters.toFixed(2)} M ({fabricCart.length} {fabricCart.length === 1 ? 'item' : 'items'})</span>
                </div>
                {fabricDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Discount Savings:</span>
                    <span>-{formatINR(fabricDiscountAmount, { keepDecimals: true })}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Tax (GST {settings.storeProfile.defaultGstRate}% Inclusive):</span>
                  <span>{formatINR(fabricGstAmount, { keepDecimals: true })}</span>
                </div>
                {fabricCollectPreviousDue && fabricPreviousOutstandingAmount > 0 && (
                  <>
                    <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-850/40">
                      <span>Current Invoice:</span>
                      <span>{formatINR(fabricCheckoutAmount, { keepDecimals: true })}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Previous Outstanding:</span>
                      <span>+{formatINR(fabricPreviousOutstandingAmount, { keepDecimals: true })}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-amber-200 font-bold text-sm border-t border-slate-850/60 pt-1.5">
                  <span>{fabricCollectPreviousDue && fabricPreviousOutstandingAmount > 0 ? 'Total Amount Payable:' : 'Final Amount:'}</span>
                  <span>{formatINR(fabricEffectivePayableAmount, { keepDecimals: true })}</span>
                </div>
              </div>

              {/* Live Settlement Breakdown when collecting previous due */}
              {fabricCollectPreviousDue && fabricPreviousOutstandingAmount > 0 && (() => {
                const currentRec = fabricPaymentMethod === 'cash'
                  ? (fabricCashTendered !== '' ? Number(fabricCashTendered) : fabricEffectivePayableAmount)
                  : fabricPaymentMethod === 'credit'
                  ? (fabricCreditAmountPaid !== '' ? Number(fabricCreditAmountPaid) : 0)
                  : fabricEffectivePayableAmount;

                const livePrevPaid = Math.min(fabricPreviousOutstandingAmount, currentRec);
                const liveCurrentApplied = Math.max(0, currentRec - livePrevPaid);
                const liveCurrentBal = Math.max(0, fabricCheckoutAmount - liveCurrentApplied);
                const liveTotalRem = Math.max(0, fabricEffectivePayableAmount - currentRec);

                return (
                  <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-2.5 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center text-[10px] uppercase text-amber-400 font-sans font-bold border-b border-slate-850 pb-1">
                      <span>⚡ Ledger Settlement Live Preview</span>
                      <span className="text-slate-400 font-normal">Priority: Previous Due First</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="font-sans text-slate-400">1. Clear Previous Outstanding:</span>
                      <span className="font-bold text-emerald-400">+{formatINR(livePrevPaid, { keepDecimals: true })}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="font-sans text-slate-400">2. Apply to Current Invoice:</span>
                      <span className="font-bold text-slate-200">+{formatINR(liveCurrentApplied, { keepDecimals: true })}</span>
                    </div>
                    {liveCurrentBal > 0 && (
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span className="font-sans text-slate-500">Current Invoice Remaining:</span>
                        <span className="text-rose-400 font-bold">{formatINR(liveCurrentBal, { keepDecimals: true })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-200 font-bold text-xs pt-1 border-t border-slate-800">
                      <span>Remaining Total Outstanding:</span>
                      <span className={liveTotalRem > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {liveTotalRem > 0 ? formatINR(liveTotalRem, { keepDecimals: true }) : '₹0.00 (PAID IN FULL)'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Payment Authorization</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash Payment', icon: IndianRupee },
                    { id: 'upi', label: 'UPI G-Pay / QR', icon: Smartphone },
                    { id: 'card', label: 'Card Payment', icon: CreditCard },
                    { id: 'credit', label: 'Credit (Udhar)', icon: BookOpen },
                  ].map((m) => {
                    const Icon = m.icon;
                    const active = fabricPaymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        id={`fabric-payment-${m.id}`}
                        type="button"
                        onClick={() => {
                          if (m.id === 'upi') {
                            if (fabricCart.length === 0) {
                              showToast?.('Your fabric checkout basket is empty.', 'error');
                              return;
                            }
                            const upiId = settings.storeProfile.upiId;
                            if (!upiId || upiId.trim() === '') {
                              showToast?.('Please configure the store UPI ID in Payment Settings.', 'error');
                              return;
                            }
                            setFabricPaymentMethod('upi');
                            const provBillNo = generateProvisionalInvoiceNo('FB');
                            handleOpenUpiModal('fabrics', fabricEffectivePayableAmount, provBillNo, () => {
                              executeFabricsCheckout();
                            });
                          } else {
                            setFabricPaymentMethod(m.id as any);
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition ${
                          active
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-bold'
                            : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span className="text-[8px] font-bold uppercase">{m.id === 'card' ? 'Card' : m.id === 'credit' ? 'Credit' : m.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
                {fabricPaymentMethod === 'cash' && (
                  <div className="space-y-1 bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg mt-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="uppercase font-bold tracking-wider text-slate-400">Cash Tendered</span>
                      {fabricCashTendered && Number(fabricCashTendered) > fabricEffectivePayableAmount && (
                        <span className="text-emerald-400 font-bold font-mono">
                          Change: {formatINR(Number(fabricCashTendered) - fabricEffectivePayableAmount, { keepDecimals: true })}
                        </span>
                      )}
                    </div>
                    <input
                      id="fabric-cash-tendered-input"
                      type="number"
                      step="any"
                      value={fabricCashTendered}
                      onChange={(e) => setFabricCashTendered(e.target.value)}
                      placeholder={`Min ₹${fabricEffectivePayableAmount.toFixed(2)}`}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none placeholder-slate-600"
                    />
                  </div>
                )}

                {fabricPaymentMethod === 'credit' && (
                  <div className="space-y-2.5 bg-slate-950/70 border border-amber-500/30 p-3 rounded-lg mt-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Credit Sale (Udhar) Panel
                      </span>
                      <span className="text-[9px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                        Deferred Payment
                      </span>
                    </div>

                    {(!fabricPhone || fabricPhone.length < 7) && (
                      <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        Customer selection is MANDATORY for Credit Sales.
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                        <span className="text-slate-400 block text-[9px] uppercase">Invoice Total</span>
                        <span className="text-amber-200 font-mono font-bold text-xs">{formatINR(fabricCheckoutAmount)}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                        <span className="text-slate-400 block text-[9px] uppercase">Balance Due</span>
                        <span className="text-rose-400 font-mono font-bold text-xs">
                          {formatINR(Math.max(0, fabricCheckoutAmount - (Number(fabricCreditAmountPaid) || 0)))}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-300 font-medium flex justify-between">
                        <span>Down Payment / Amount Paid (₹)</span>
                        <span className="text-slate-500 text-[9px]">Default 0 if unpaid</span>
                      </label>
                      <input
                        id="fabric-credit-amount-paid"
                        type="number"
                        step="any"
                        min="0"
                        max={fabricCheckoutAmount}
                        value={fabricCreditAmountPaid}
                        onChange={(e) => setFabricCreditAmountPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-300 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-500" /> Due Date <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative premium-date-container group">
                        <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                        <input
                          id="fabric-credit-due-date"
                          type="date"
                          value={fabricCreditDueDate}
                          onChange={(e) => setFabricCreditDueDate(e.target.value)}
                          required
                          className="peer w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-amber-500/50 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400">Reason (Optional)</label>
                        <input
                          id="fabric-credit-reason"
                          type="text"
                          value={fabricCreditReason}
                          onChange={(e) => setFabricCreditReason(e.target.value)}
                          placeholder="e.g. Custom tailoring..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500/50 placeholder-slate-650"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400">Remarks (Optional)</label>
                        <input
                          id="fabric-credit-remarks"
                          type="text"
                          value={fabricCreditRemarks}
                          onChange={(e) => setFabricCreditRemarks(e.target.value)}
                          placeholder="e.g. Pickup on Saturday..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500/50 placeholder-slate-650"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Checkout Submit Trigger */}
              <button
                id="pos-submit-fabric-sale"
                onClick={handleCompleteFabricSale}
                disabled={fabricCart.length === 0 || isGeneratingFabricBill}
                className="w-full gold-gradient text-slate-950 font-bold tracking-widest uppercase py-3 rounded-lg text-xs shadow-lg hover:opacity-90 transition active:scale-98 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingFabricBill ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>GENERATING BILL...</span>
                  </>
                ) : (
                  <span>GENERATE BILL</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-Only Dedicated Invoice Element (Mounted in DOM, hidden on screen, isolated for window.print()) */}
      {latestInvoice && (
        <div id="invoice-print-area" className="print-only print-only-invoice" style={{ width: '75mm', maxWidth: '75mm', minWidth: '75mm', marginLeft: 'auto', marginRight: 'auto', margin: '0 auto', padding: '1.5mm 0 1.5mm 0', color: '#000000', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: '10.5px', lineHeight: '1.25', letterSpacing: '0px', boxSizing: 'border-box' }}>
          {/* Header */}
          <div className="text-center border-b border-dashed border-black flex flex-col items-center" style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px', marginBottom: '2px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
            <h4 className="font-bold text-black uppercase" style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.15, margin: '0 0 1px 0', textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              {settings.storeProfile.name || 'SMART FASHION'}
            </h4>
            <p className="text-[10px] text-black uppercase font-medium leading-tight" style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.2, margin: '0.5px 0', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              {settings.storeProfile.address}
            </p>
            <p className="text-[10px] text-black font-semibold" style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1.2, margin: '0.5px 0 0 0', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              MOB: {settings.storeProfile.phone || '+91 XXXXX XXXXX'}{settings.storeProfile.gstin ? ` | GSTIN: ${settings.storeProfile.gstin}` : ''}
            </p>
          </div>

          {/* Bill Details */}
          <div className="border-b border-dashed border-black text-[10.5px] leading-tight text-black" style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px', marginBottom: '2px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
            <div className="flex justify-between items-start" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', gap: '4px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>INVOICE: <span className="font-bold text-black" style={{ fontWeight: 600 }}>{latestInvoice.invoiceNo}</span></div>
              <div className="text-right" style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>DATE: {new Date(latestInvoice.date).toLocaleDateString()}</div>
            </div>
            <div className="flex justify-between items-start" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', gap: '4px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>CUSTOMER: <span className="font-bold text-black" style={{ fontWeight: 600 }}>{formatMemberName(latestInvoice.customerName)}</span></div>
              {latestInvoice.customerPhone && (
                <div className="text-right" style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>MOB: {latestInvoice.customerPhone}</div>
              )}
            </div>
          </div>

          {/* Ledger Items Table */}
          <div className="border-b border-dashed border-black" style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px', marginBottom: '2px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
            <table className="w-full table-fixed border-collapse" style={{ width: '75mm', maxWidth: '75mm', minWidth: '75mm', tableLayout: 'fixed', borderCollapse: 'collapse', marginLeft: 'auto', marginRight: 'auto', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <colgroup>
                <col style={{ width: '44%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-dashed border-black text-[10.5px]" style={{ borderBottom: '1px dashed #000000', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                  <th className="text-left font-bold text-black pb-0.5" style={{ textAlign: 'left', fontWeight: 600, padding: '2px 1px 2px 0', fontSize: '10.5px', textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>Item Description</th>
                  <th className="text-center font-bold text-black pb-0.5" style={{ textAlign: 'center', fontWeight: 600, padding: '2px 1px', fontSize: '10.5px', textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>Qty</th>
                  <th className="text-right font-bold text-black pb-0.5" style={{ textAlign: 'right', fontWeight: 600, padding: '2px 1px', fontSize: '10.5px', textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>Rate</th>
                  <th className="text-right font-bold text-black pb-0.5" style={{ textAlign: 'right', fontWeight: 600, padding: '2px 0 2px 1px', fontSize: '10.5px', textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>Total</th>
                </tr>
              </thead>
              <tbody className="text-[10.5px] text-black" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                {latestInvoice.items.map((it: any, idx) => {
                  const isFree = it.sellingPrice === 0 || it.total === 0;
                  return (
                    <tr key={idx} className="align-top item-row" style={{ borderBottom: 'none', verticalAlign: 'top', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                      <td className="item-desc-col pr-1 py-0.5" style={{ width: '44%', maxWidth: '33mm', overflow: 'hidden', whiteSpace: 'nowrap', padding: '2px 2px 2px 0', verticalAlign: 'top', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                        <div className="item-name text-black font-bold truncate" title={it.name} style={{ fontWeight: 600, fontSize: '10.5px', lineHeight: '1.25', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%', maxWidth: '100%', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                          {it.isGift ? '🎁 ' : ''}{it.name}
                        </div>
                        <div className="item-meta text-[9px] text-black font-medium truncate mt-0.5" style={{ fontSize: '9px', fontWeight: 400, lineHeight: '1.15', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%', maxWidth: '100%', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                          SZ: {it.size || 'STD'} | CLR: {it.color || 'OS'}
                        </div>
                      </td>
                      <td className="text-center text-black font-semibold py-0.5" style={{ textAlign: 'center', padding: '2px 1px', verticalAlign: 'top', fontWeight: 500, fontSize: '10.5px', whiteSpace: 'nowrap', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{it.quantity}</td>
                      <td className="text-right text-black font-semibold py-0.5 whitespace-nowrap" style={{ textAlign: 'right', padding: '2px 1px', verticalAlign: 'top', fontWeight: 500, fontSize: '10.5px', whiteSpace: 'nowrap', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                        {isFree ? (
                          <span className="font-bold text-black px-0.5 py-0.5 rounded border border-black text-[8.5px] uppercase" style={{ fontSize: '8.5px', fontWeight: 700, border: '1px solid #000000', padding: '0.5px 3px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                            FREE
                          </span>
                        ) : (
                          formatINR(it.sellingPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        )}
                      </td>
                      <td className="text-right font-bold text-black py-0.5 whitespace-nowrap" style={{ textAlign: 'right', padding: '2px 0 2px 1px', verticalAlign: 'top', fontWeight: 600, fontSize: '10.5px', whiteSpace: 'nowrap', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                        {isFree ? (
                          <span className="text-[9.5px] text-black font-bold" style={{ fontSize: '9.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                            Val {formatINR(it.originalSellingPrice || it.sellingPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          formatINR(it.total, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total calculations */}
          <div className="py-0.5 text-black" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
            <div className="flex justify-between text-black font-bold" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <span>Gross Subtotal:</span>
              <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(latestInvoice.subtotal, { keepDecimals: true })}</span>
            </div>

            {/* Savings Summary inside Total calculations */}
            {(() => {
              const memberSavings = latestInvoice.discountCardDiscount || 0;
              const giftSavings = latestInvoice.items
                ?.filter((it: any) => it.isGift)
                ?.reduce((sum: number, it: any) => sum + (it.originalSellingPrice - it.sellingPrice) * it.quantity, 0) || 0;

              let offerSavings = 0;
              let couponSavings = 0;

              if (Array.isArray(latestInvoice.appliedOffers)) {
                latestInvoice.appliedOffers.forEach((ao: any) => {
                  if (ao.offer.id === 'membership-card') {
                    // handled under memberSavings
                  } else if (ao.offer.offerCategory === 'coupon' || ao.offer.type === 'coupon' || (ao.offer.code && ao.offer.code !== 'bogo' && ao.offer.code !== 'buy3get1')) {
                    couponSavings += ao.savings;
                  } else {
                    offerSavings += ao.savings;
                  }
                });
              } else {
                couponSavings = latestInvoice.discountAmount || 0;
              }

              const combinedCouponAndOffer = couponSavings + offerSavings;
              const totalSavings = memberSavings + combinedCouponAndOffer + giftSavings;

              if (totalSavings === 0) return null;

              return (
                <div className="border-y border-dashed border-black text-black" style={{ borderTop: '1px dashed #000000', borderBottom: '1px dashed #000000', padding: '2px 0', margin: '2px 0', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                  <div className="font-bold text-black text-left text-[10.5px] uppercase" style={{ fontWeight: 600, fontSize: '10.5px', textTransform: 'uppercase', marginBottom: '1.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>SAVINGS SUMMARY</div>
                  {memberSavings > 0 && (
                    <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                      <span>Member Savings:</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(memberSavings, { keepDecimals: true })}</span>
                    </div>
                  )}
                  {combinedCouponAndOffer > 0 && (
                    <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                      <span>Coupon Savings:</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(combinedCouponAndOffer, { keepDecimals: true })}</span>
                    </div>
                  )}
                  {giftSavings > 0 && (
                    <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                      <span>Gift Savings:</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(giftSavings, { keepDecimals: true })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-black border-t border-dashed border-black" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px dashed #000000', paddingTop: '1.5px', marginTop: '1.5px', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                    <span>TOTAL SAVINGS:</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(totalSavings, { keepDecimals: true })}</span>
                  </div>
                </div>
              );
            })()}

            {/* GST Details */}
            <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <span>Taxable Amount:</span>
              <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(latestInvoice.grandTotal - latestInvoice.gstAmount, { keepDecimals: true })}</span>
            </div>
            <div className="flex justify-between text-black text-[10.5px]" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', margin: '0.5px 0', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <span>GST Included ({latestInvoice.gstRate}%):</span>
              <span style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(latestInvoice.gstAmount, { keepDecimals: true })}</span>
            </div>
            
            {/* Grand Total */}
            <div className="flex justify-between text-black font-black uppercase" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '15px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', padding: '2.5px 0', margin: '2.5px 0 2px 0', textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
              <span>GRAND TOTAL:</span>
              <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>{formatINR(latestInvoice.grandTotal, { keepDecimals: true })}</span>
            </div>
          </div>

          {/* Payment Details Section */}
          {(() => {
            const prevOutstanding = latestInvoice.previousOutstanding !== undefined
              ? latestInvoice.previousOutstanding
              : getPreviousOutstandingForCustomer(
                  latestInvoice.customerPhone,
                  latestInvoice.id,
                  invoices,
                  latestInvoice.date
                );

            const hasPrevOutstanding = prevOutstanding > 0;
            const isCreditSale = latestInvoice.paymentMethod === 'credit';
            const currentInvoiceAmount = latestInvoice.grandTotal;

            const totalOutstanding = hasPrevOutstanding
              ? prevOutstanding + currentInvoiceAmount
              : currentInvoiceAmount;

            const amountPaidToday = latestInvoice.collectedPreviousDue
              ? (latestInvoice.totalPaidToday ?? latestInvoice.amountPaid ?? 0)
              : (latestInvoice.amountPaid !== undefined
                  ? latestInvoice.amountPaid
                  : (isCreditSale ? 0 : currentInvoiceAmount));

            const netRemainingDue = Math.max(0, Number((totalOutstanding - amountPaidToday).toFixed(2)));
            const isPaidInFull = netRemainingDue <= 0.01;

            let paymentModeStr = String(latestInvoice.paymentMethod || 'CASH').toUpperCase();
            if (paymentModeStr === 'CREDIT') {
              paymentModeStr = 'CREDIT (UDHAR)';
            }

            let remainingLabel = 'Balance Due:';
            if (hasPrevOutstanding) {
              if (amountPaidToday >= currentInvoiceAmount && netRemainingDue > 0) {
                remainingLabel = 'Remaining Previous Due:';
              } else if (netRemainingDue > 0) {
                remainingLabel = 'Remaining Due:';
              }
            }

            return (
              <div className="border-b border-dashed border-black text-black payment-container" style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px', marginBottom: '2px', marginTop: '2px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                  <span className="font-bold" style={{ fontWeight: 600 }}>Payment Mode:</span>
                  <span className="font-bold uppercase text-black" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0px' }}>
                    {paymentModeStr}
                  </span>
                </div>

                {hasPrevOutstanding && (
                  <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                    <span>Previous Outstanding:</span>
                    <span className="font-bold text-black" style={{ fontWeight: 600, letterSpacing: '0px' }}>{formatINR(prevOutstanding, { keepDecimals: true })}</span>
                  </div>
                )}

                <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                  <span>Current Invoice:</span>
                  <span className="font-bold text-black" style={{ fontWeight: 600, letterSpacing: '0px' }}>{formatINR(currentInvoiceAmount, { keepDecimals: true })}</span>
                </div>

                {hasPrevOutstanding && (
                  <div className="flex justify-between font-bold text-black" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                    <span>TOTAL OUTSTANDING:</span>
                    <span style={{ letterSpacing: '0px' }}>{formatINR(totalOutstanding, { keepDecimals: true })}</span>
                  </div>
                )}

                <div className="flex justify-between text-black font-bold" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                  <span>{hasPrevOutstanding ? 'Amount Paid Today:' : 'Amount Paid:'}</span>
                  <span className="font-bold text-black" style={{ fontWeight: 600, letterSpacing: '0px' }}>
                    {formatINR(amountPaidToday, { keepDecimals: true })}
                  </span>
                </div>

                {isPaidInFull ? (
                  <div className="flex justify-between items-center font-bold text-black payment-status-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                    <span>Payment Status:</span>
                    <span className="text-black px-1 py-0.5 rounded border border-black text-[9.5px] font-black uppercase" style={{ border: '1.5px solid #000000', padding: '1px 4px', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px', lineHeight: 1 }}>
                      PAID
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between font-bold text-black payment-status-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                      <span>{remainingLabel}</span>
                      <span style={{ letterSpacing: '0px' }}>{formatINR(netRemainingDue, { keepDecimals: true })}</span>
                    </div>
                    {latestInvoice.dueDate && (
                      <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                        <span>Due Date:</span>
                        <span className="font-bold text-black" style={{ fontWeight: 600, letterSpacing: '0px' }}>{latestInvoice.dueDate}</span>
                      </div>
                    )}
                  </>
                )}

                {latestInvoice.changeReturned !== undefined && latestInvoice.changeReturned > 0 && (
                  <div className="flex justify-between text-black" style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5px 0', fontSize: '10.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '0px' }}>
                    <span>Change Returned:</span>
                    <span className="font-bold text-black" style={{ fontWeight: 600, letterSpacing: '0px' }}>
                      {formatINR(latestInvoice.changeReturned, { keepDecimals: true })}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Only display UPI QR if a real QR image/URL or merchant QR is configured in settings */}
          {latestInvoice.paymentMethod === 'upi' && Boolean((settings.storeProfile as any)?.upiQrCode || (settings.storeProfile as any)?.merchantQrCode) && (
            <div className="flex flex-col items-center justify-center border-b border-dashed border-black" style={{ borderBottom: '1px dashed #000000', padding: '2px 0', marginBottom: '2px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              <img
                src={(settings.storeProfile as any).upiQrCode || (settings.storeProfile as any).merchantQrCode}
                alt="UPI Merchant QR"
                className="w-12 h-12 object-contain"
                style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '2px auto', display: 'block' }}
              />
            </div>
          )}

          {/* Footer */}
          <div className="receipt-footer text-center text-[9px] text-black w-full" style={{ textAlign: 'center', paddingTop: '2px', fontSize: '9px', lineHeight: '1.2', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", width: '100%' }}>
            <p className="thank-you-title font-bold text-black text-[9.5px] truncate" style={{ textAlign: 'center', fontWeight: 600, fontSize: '9.5px', lineHeight: 1.2, marginTop: '2px', marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block', letterSpacing: '0px' }}>Thank You For Shopping With {settings.storeProfile.name || 'SMART FASHION'}</p>
            {settings.exchangePolicy?.enabled ? (
              (() => {
                const policyText = settings.exchangePolicy?.productsPolicyText !== undefined
                  ? settings.exchangePolicy.productsPolicyText
                  : (settings.exchangePolicy?.customPolicyText || '');
                const trimmed = (policyText || '').trim();
                const lines = trimmed ? trimmed.split('\n').filter((l) => l.trim().length > 0) : [];
                const hasValidUntil = Boolean(latestInvoice.exchangeValidUntil);

                if (!lines.length && !hasValidUntil) return null;

                return (
                  <div className="exchange-policy-box leading-tight text-black text-center" style={{ textAlign: 'center', margin: '1px 0', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>
                    {lines.map((line: string, idx: number) => (
                      <p key={idx} className="policy-line text-center" style={{ textAlign: 'center', margin: '0.5px 0', wordBreak: 'break-word', overflowWrap: 'break-word', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block', fontWeight: 400 }}>{line}</p>
                    ))}
                    {latestInvoice.exchangeValidUntil && (
                      <p className="exchange-valid-until font-bold text-black text-[9.5px] text-center" style={{ textAlign: 'center', fontWeight: 600, fontSize: '9.5px', marginTop: '0.5px', marginBottom: '0.5px', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>
                        Exchange Valid Until: {(() => {
                          const d = new Date(latestInvoice.exchangeValidUntil);
                          if (isNaN(d.getTime())) return '';
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          return `${day}/${month}/${year}`;
                        })()}
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="exchange-policy-box leading-tight text-black text-center" style={{ textAlign: 'center', margin: '1px 0', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>
                <p className="exchange-valid-until font-bold text-black text-center" style={{ textAlign: 'center', fontWeight: 600, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>No Exchange Allowed</p>
              </div>
            )}
            <div className="customer-care-box text-[9px] text-black border-t border-dashed border-black text-center" style={{ textAlign: 'center', borderTop: '1px dashed #000000', paddingTop: '1.5px', marginTop: '1.5px', fontSize: '9px', lineHeight: '1.2', fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>
              <p className="care-header font-bold uppercase text-black text-center" style={{ textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', fontSize: '9px', margin: '0', lineHeight: 1.15, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>CUSTOMER CARE</p>
              <p className="care-phone text-black font-bold text-center" style={{ textAlign: 'center', fontWeight: 600, fontSize: '9.5px', margin: '0.5px 0 0 0', lineHeight: 1.15, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>{settings.storeProfile.phone || '+91 XXXXX XXXXX'}</p>
              <p className="care-website text-black font-medium text-center" style={{ textAlign: 'center', fontWeight: 400, fontSize: '9px', margin: '0.5px 0 0 0', lineHeight: 1.15, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: 'block' }}>{settings.storeProfile.website || 'www.smartfashion.in'}</p>
            </div>
            {/* Bill Lookup Barcode (Code 128) */}
            <div className="barcode-wrapper flex flex-col items-center justify-center text-center w-full" style={{ marginTop: '1.5px', marginBottom: '0', textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <InvoiceBarcode invoiceNo={latestInvoice.invoiceNo} height={40} maxWidth="54mm" />
            </div>
          </div>
        </div>
      )}

      {/* Resume Held Transactions Modal */}
      {isResumeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/15 p-6 rounded-2xl max-w-lg w-full shadow-2xl relative">
            <button
              id="close-resume-modal"
              onClick={() => setIsResumeModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
              Held Showroom Transactions
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 font-mono">Select a transaction to restore to the active POS checkout workspace.</p>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {heldBills.map((held) => {
                const totalItems = held.cart?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
                return (
                  <div
                    key={held.id}
                    className="p-3 bg-slate-950/80 hover:bg-slate-950 border border-slate-850 hover:border-amber-500/20 rounded-xl transition flex flex-col gap-2 relative group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-amber-200">
                          {held.phone ? `${held.custName || 'Loyal Client'} (${held.phone})` : 'Walk-in Showroom Client'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Held on {new Date(held.heldAt).toLocaleTimeString()} ({totalItems} items)
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleResumeBill(held)}
                        className="bg-amber-500 hover:gold-gradient text-slate-950 text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider transition"
                      >
                        Restore
                      </button>
                    </div>

                    <div className="border-t border-slate-900/60 pt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-400">
                      {held.cart?.map((item: any) => (
                        <span key={item.product.id} className="bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded font-mono">
                          {item.product.name} (x{item.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-850 text-center">
              <button
                onClick={() => setIsResumeModalOpen(false)}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition"
              >
                Dismiss Dialog (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Duplicate Customer Modal */}
      <DuplicateCustomerModal
        isOpen={posDuplicateModal.isOpen}
        existingCustomer={posDuplicateModal.existingCustomer}
        onOpenExisting={handleOpenExistingPosCustomer}
        onCancel={() => setPosDuplicateModal({ isOpen: false, existingCustomer: null })}
        moduleContext="POS Billing Checkout"
      />

      {/* ====================================================
          BASIC DYNAMIC UPI QR PAYMENT MODAL
          ==================================================== */}
      {showUpiModal && upiModalConfig && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="upi-qr-payment-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-6 shadow-2xl relative animate-fade-in text-center">
            {/* Header */}
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
                <Smartphone className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm uppercase font-extrabold text-slate-200 tracking-widest">
                UPI QR Payment
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Invoice Reference: {upiModalConfig.invoiceNo}
              </p>
            </div>

            {/* Amount */}
            <div className="bg-slate-950/60 border border-slate-850 rounded-xl py-3.5 px-4 font-mono">
              <span className="text-[10px] text-slate-500 uppercase font-sans tracking-wider block mb-1">
                Amount to Scan & Pay
              </span>
              <span className="text-3xl font-extrabold text-amber-200 block tracking-tight">
                {formatINR(upiModalConfig.amount, { keepDecimals: true })}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-3.5 rounded-xl shadow-lg border border-slate-200 inline-block transition duration-200 hover:scale-102">
                {upiQrCodeDataUrl ? (
                  <img
                    src={upiQrCodeDataUrl}
                    alt="UPI Payment QR Code"
                    className="w-[200px] h-[200px]"
                    id="upi-payment-qr-image"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400 font-medium">
                    Generating QR...
                  </div>
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-300 mt-3 flex items-center gap-1.5 justify-center">
                <QrCode className="w-3.5 h-3.5 text-amber-500" /> Scan & Pay with any UPI App
              </p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wide">
                PhonePe • Google Pay • Paytm • BHIM • Other UPI Apps
              </p>
            </div>

            {/* UPI ID Info */}
            <div className="bg-slate-950/30 border border-slate-850/50 rounded-lg p-2.5 text-left text-xs font-mono space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[10px]">UPI ID:</span>
                <span className="text-slate-300 font-bold">{settings.storeProfile.upiId}</span>
              </div>
              {settings.storeProfile.upiDisplayName && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-[10px]">Display Name:</span>
                  <span className="text-slate-400 font-bold">{settings.storeProfile.upiDisplayName}</span>
                </div>
              )}
            </div>

            {/* Open UPI App Button (Optional Enhancement) */}
            <button
              type="button"
              onClick={() => {
                window.location.href = upiUriString;
              }}
              className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-500" />
              Open UPI App
            </button>

            {/* Primary Action Row */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUpiModal(false);
                  setUpiModalConfig(null);
                }}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setShowUpiConfirmDialog(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-2.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-98"
                id="upi-payment-received-button"
              >
                Payment Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          UPI CONFIRMATION PROMPT DIALOG
          ==================================================== */}
      {showUpiConfirmDialog && upiModalConfig && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="upi-confirm-payment-dialog">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xs p-5 space-y-4 shadow-2xl relative text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle className="w-5 h-5 animate-bounce" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xs uppercase font-extrabold text-slate-200 tracking-wider">
                Confirm UPI Receipt
              </h4>
              <p className="text-[11px] text-slate-400">
                Have you received the UPI payment of <strong className="text-amber-200">{formatINR(upiModalConfig.amount, { keepDecimals: true })}</strong> in your account/UPI app?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowUpiConfirmDialog(false)}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpiConfirmDialog(false);
                  setShowUpiModal(false);
                  const confirmCb = upiModalConfig.onConfirm;
                  setUpiModalConfig(null);
                  confirmCb();
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2 rounded-lg text-[10px] uppercase tracking-widest transition shadow-md active:scale-98"
                id="upi-confirm-payment-button"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
