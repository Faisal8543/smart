/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { useShortcuts } from '../context/ShortcutContext';
import { PermissionButton } from './common/PermissionGuard';
import {
  Tag,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  Award,
  Sliders,
  Send,
  RefreshCw,
  XCircle,
  MessageSquare,
  Share2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Trophy,
  Ticket,
} from 'lucide-react';
import { Offer } from '../types';
import { formatINR } from '../utils/currency';
import { CreateProductOfferPage } from './CreateProductOfferPage';
import { TopCustomersOfferModal } from './TopCustomersOfferModal';

export const PromotionsView: React.FC = () => {
  const {
    offers,
    addOffer,
    updateOffer,
    deleteOffer,
    products,
    gifts,
    customerCoupons,
    addCustomerCoupon,
    deleteCustomerCoupon,
    updateCustomerCoupon,
    generateUniqueCouponCode,
    settings,
    couponDeliveryLogs,
    updateCouponAutomationSettings,
    updateCouponDeliveryLogStatus,
    setCouponDeliveryLogs,
  } = useAppState();
  const { showToast } = useShortcuts();

  // Search and tabs states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'coupon' | 'product-specific' | 'customer-coupons' | 'coupon-automation'>('coupon');

  // Coupon manual issuance states
  const [issueCustomerPhone, setIssueCustomerPhone] = useState('');
  const [issueCustomerName, setIssueCustomerName] = useState('');
  const [issueCampaignId, setIssueCampaignId] = useState('');
  const [issueValidityDays, setIssueValidityDays] = useState(30);

  // Deletion state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');

  // Routing state
  const [subView, setSubView] = useState<'list' | 'create-product-offer' | 'edit-product-offer'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topCustomersOfferOpen, setTopCustomersOfferOpen] = useState(false);

  // Coupon Automation Local States
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoMinPurchase, setAutoMinPurchase] = useState(3000);
  const [autoDiscountType, setAutoDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [autoDiscountValue, setAutoDiscountValue] = useState(10);
  const [autoValidityDays, setAutoValidityDays] = useState(30);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [autoWhatsAppDelivery, setAutoWhatsAppDelivery] = useState(true);
  const [autoCouponDetection, setAutoCouponDetection] = useState(true);
  const [autoApplyOnNextVisit, setAutoApplyOnNextVisit] = useState(true);
  const [whatsappBlockedUrl, setWhatsappBlockedUrl] = useState<string | null>(null);

  // Delivery filter state and derived state
  const [deliveryFilter, setDeliveryFilter] = useState<'All' | 'Sent' | 'Pending' | 'Failed'>('All');
  const [deliverySortField, setDeliverySortField] = useState<'date' | 'status'>('date');
  const [deliverySortOrder, setDeliverySortOrder] = useState<'asc' | 'desc'>('desc');

  const handleToggleSort = (field: 'date' | 'status') => {
    if (deliverySortField === field) {
      setDeliverySortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDeliverySortField(field);
      setDeliverySortOrder('asc');
    }
  };

  const parseDeliveryDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    // ISO Format: YYYY-MM-DD
    if (dateStr.includes('-') && !dateStr.includes('/')) {
      return new Date(dateStr).getTime() || 0;
    }
    // Locale format: dd/mm/yyyy hh:mm AM/PM or similar
    try {
      const parts = dateStr.trim().split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        
        let hours = 0;
        let minutes = 0;
        
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          hours = parseInt(timeParts[0], 10);
          minutes = parseInt(timeParts[1], 10) || 0;
          
          if (parts[2] && parts[2].toUpperCase() === 'PM' && hours < 12) {
            hours += 12;
          } else if (parts[2] && parts[2].toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }
        }
        return new Date(year, month, day, hours, minutes).getTime();
      }
    } catch (e) {
      // Fallback
    }
    return new Date(dateStr).getTime() || 0;
  };

  const filteredDeliveryLogs = useMemo(() => {
    let result = couponDeliveryLogs;
    if (deliveryFilter !== 'All') {
      result = result.filter(log => log.status === deliveryFilter);
    }
    return result.slice().sort((a, b) => {
      let comparison = 0;
      if (deliverySortField === 'date') {
        const timeA = parseDeliveryDate(a.date || '');
        const timeB = parseDeliveryDate(b.date || '');
        comparison = timeA - timeB;
      } else if (deliverySortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      return deliverySortOrder === 'asc' ? comparison : -comparison;
    });
  }, [couponDeliveryLogs, deliveryFilter, deliverySortField, deliverySortOrder]);

  const handleReTriggerWhatsApp = (log: any) => {
    const coupon = customerCoupons.find(c => c.code === log.couponCode);
    const discountType = coupon?.discountType || settings?.couponAutomation?.discountType || 'percentage';
    const discountValue = coupon?.discountValue || settings?.couponAutomation?.discountValue || 10;
    const minPurchaseAmount = coupon?.minPurchaseAmount || settings?.couponAutomation?.minPurchaseAmount || 0;
    const expiryDate = coupon?.expiryDate || log.date;

    const details = discountType === 'percentage'
      ? `${discountValue}% OFF store-wide`
      : `Flat ₹${discountValue} OFF`;

    const cleanPhoneForWhatsApp = (phoneStr: string) => {
      const digits = (phoneStr || '').replace(/\D/g, '');
      if (digits.length === 10) {
        return '91' + digits;
      }
      return digits;
    };

    const formattedPhone = cleanPhoneForWhatsApp(log.customerPhone);
    const couponText = `Dear *${log.customerName || 'Valued Client'}*,\n\n` +
      `Thank you for shopping at *Smart Fashion* Milan Galleria! 🛍️\n\n` +
      `We are delighted to share your automated reward coupon details:\n` +
      `-----------------------------\n` +
      `🎫 *Coupon Code:* *${log.couponCode}*\n` +
      `✨ *Offer Details:* ${details}\n` +
      `💰 *Minimum Purchase:* ₹${minPurchaseAmount}\n` +
      `🗓️ *Expiry Date:* ${expiryDate}\n` +
      `-----------------------------\n\n` +
      `We look forward to your next visit to *Smart Fashion*! ✨\n` +
      `_Smart Fashion Concierge_`;

    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(couponText)}`;

    try {
      const wpWindow = window.open(url, "SmartFashionWhatsApp");
      if (!wpWindow || wpWindow.closed || typeof wpWindow.closed === 'undefined') {
        setWhatsappBlockedUrl(url);
        showToast?.('Popup blocked. Click "Open WhatsApp" modal.', 'warning');
      } else {
        wpWindow.focus();
        setWhatsappBlockedUrl(null);
      }
    } catch (e) {
      setWhatsappBlockedUrl(url);
      showToast?.('Popup blocked. Click "Open WhatsApp" modal.', 'warning');
    }

    const nowStr = new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setCouponDeliveryLogs((prev) => {
      const next = prev.map((l) => {
        if (l.id === log.id) {
          const isResend = l.status === 'Sent';
          return {
            ...l,
            status: 'Sent' as const,
            sentTime: l.sentTime || nowStr,
            resentTime: isResend ? nowStr : l.resentTime,
          };
        }
        return l;
      });
      try {
        localStorage.setItem('sf_coupon_delivery_logs', JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });

    showToast?.(`WhatsApp share re-triggered for ${log.customerName}!`, 'success');
  };

  // Sync settings when they are loaded or updated
  useEffect(() => {
    if (settings?.couponAutomation) {
      const config = settings.couponAutomation;
      setAutoEnabled(!!config.enabled);
      setAutoMinPurchase(config.minPurchaseAmount ?? 3000);
      setAutoDiscountType(config.discountType ?? 'percentage');
      setAutoDiscountValue(config.discountValue ?? 10);
      setAutoValidityDays(config.validityDays ?? 30);
      setAutoGenerate(config.autoGenerate ?? true);
      setAutoWhatsAppDelivery(config.autoWhatsAppDelivery ?? true);
      setAutoCouponDetection(config.autoCouponDetection ?? true);
      setAutoApplyOnNextVisit(config.autoApplyOnNextVisit ?? true);
    }
  }, [settings?.couponAutomation]);

  // Handle Hash Changes for deep-linking
  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.slice(1) || '';
      
      if (rawHash.startsWith('promotions/create-coupon')) {
        setSubView('create-product-offer');
        setEditingId(null);
      } else if (rawHash.startsWith('promotions/create-product-offer')) {
        setSubView('create-product-offer');
        setEditingId(null);
      } else if (rawHash.startsWith('promotions/edit-coupon')) {
        const query = rawHash.split('?')[1] || '';
        const params = new URLSearchParams(query);
        setEditingId(params.get('id'));
        setSubView('edit-product-offer');
      } else if (rawHash.startsWith('promotions/edit-product-offer')) {
        const query = rawHash.split('?')[1] || '';
        const params = new URLSearchParams(query);
        setEditingId(params.get('id'));
        setSubView('edit-product-offer');
      } else {
        setSubView('list');
        setEditingId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSaveAutomationSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateCouponAutomationSettings({
      enabled: autoEnabled,
      minPurchaseAmount: Number(autoMinPurchase),
      discountType: autoDiscountType,
      discountValue: Number(autoDiscountValue),
      validityDays: Number(autoValidityDays),
      autoGenerate,
      autoWhatsAppDelivery,
      autoCouponDetection,
      autoApplyOnNextVisit,
    });
    showToast?.('Coupon Automation settings updated successfully!', 'success');
  };

  const handleManualIssueCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueCustomerPhone || !issueCustomerName || !issueCampaignId) {
      showToast('Please fill in all details for manual coupon issuance.');
      return;
    }
    const offer = offers.find(o => o.id === issueCampaignId);
    if (!offer) return;

    const code = generateUniqueCouponCode(offer.couponPrefix || '');
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + issueValidityDays);

    addCustomerCoupon({
      code,
      customerPhone: issueCustomerPhone.replace(/\D/g, ''),
      customerName: issueCustomerName.trim(),
      offerId: offer.id,
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: expDate.toISOString().split('T')[0],
      status: 'active',
    });

    showToast(`Successfully issued coupon ${code} for ${issueCustomerName}!`);
    setIssueCustomerPhone('');
    setIssueCustomerName('');
    setIssueCampaignId('');
  };

  // Deletion logic
  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    try {
      deleteOffer(deleteConfirmId);
      showToast('Promotion deleted successfully.');
    } catch (e) {
      console.error(e);
      showToast('Unable to delete promotion. Please try again.');
    } finally {
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
    }
  };

  // Dashboard Stats Calculations
  const dashboardStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const active = offers.filter((o) => o.isActive);
    // Scheduled offers have start dates in the future
    const scheduled = offers.filter((o) => o.startDate && o.startDate > todayStr);
    // Expired offers have past end dates
    const expired = offers.filter((o) => (o.endDate && o.endDate < todayStr) || (o.expiryDate && o.expiryDate < todayStr));
    const productSpecific = offers.filter((o) => o.offerCategory === 'product-specific');
    const couponCount = offers.filter((o) => !o.offerCategory || o.offerCategory === 'coupon');
    
    const totalUsage = offers.reduce((sum, o) => sum + (o.usageCount || 0), 0);
    const totalRev = offers.reduce((sum, o) => sum + (o.revenueGenerated || 0), 0);

    return {
      totalActive: active.length,
      totalScheduled: scheduled.length,
      totalExpired: expired.length,
      totalProductOffers: productSpecific.length,
      totalCouponOffers: couponCount.length,
      usageCount: totalUsage,
      revenueGenerated: totalRev,
    };
  }, [offers]);

  // Filtered Offers with safe check on code / name to avoid type errors
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const matchSearch =
        (o.code || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (o.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
      
      const isProductSpecificType = o.offerCategory === 'product-specific';
      const isCouponType = !o.offerCategory || o.offerCategory === 'coupon';

      if (activeTab === 'coupon') {
        return matchSearch && isCouponType;
      } else {
        return matchSearch && isProductSpecificType;
      }
    });
  }, [offers, searchTerm, activeTab]);

  // Conditional rendering based on routing
  if (subView === 'create-product-offer' || subView === 'edit-product-offer') {
    return (
      <CreateProductOfferPage
        editingId={editingId}
        offers={offers}
        addOffer={addOffer}
        updateOffer={updateOffer}
        deleteOffer={deleteOffer}
        products={products}
        gifts={gifts}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="space-y-6" id="offers-management-system-root">
      {/* Upper header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100 flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" /> Retail Offer Management System
          </h1>
          <p className="text-xs text-slate-400">
            Design target-specific deals, automated volume ladders, happy hours, and dynamic BOGOs.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Button 1 (Primary) */}
          <button
            id="btn-add-product-offer"
            onClick={() => { window.location.hash = 'promotions/create-product-offer'; }}
            className="flex items-center justify-center gap-2 gold-gradient text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition hover:opacity-95 active:scale-95 shadow-lg shadow-amber-950/20 cursor-pointer h-10 shrink-0"
            title="Create product-specific offers, category offers, BOGO, volume discounts, free gifts, etc."
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>➕ NEW PRODUCT OFFER</span>
          </button>

          {/* Button 2 (Secondary) */}
          <button
            id="btn-create-coupon-voucher"
            onClick={() => { window.location.hash = 'promotions/create-coupon'; }}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer h-10 shrink-0"
            title="Create and manage standalone coupon vouchers"
          >
            <Ticket className="w-4 h-4 text-amber-400" />
            <span>🎫 COUPON VOUCHER</span>
          </button>

          {/* Button 3 (Premium) */}
          <button
            id="btn-top-customers-offer"
            onClick={() => setTopCustomersOfferOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-950/30 cursor-pointer ring-1 ring-amber-300/50 h-10 shrink-0"
            title="Create exclusive offers only for the highest spending customers"
          >
            <Trophy className="w-4 h-4 stroke-[2.5]" />
            <span>🏆 TOP CUSTOMERS OFFER</span>
          </button>
        </div>
      </div>

      {/* Analytics Bento Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5" id="offers-dashboard-grid">
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Active Offers</span>
          <span className="text-xl font-bold text-emerald-400 font-mono mt-1">{dashboardStats.totalActive}</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Scheduled</span>
          <span className="text-xl font-bold text-amber-400 font-mono mt-1">{dashboardStats.totalScheduled}</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Expired</span>
          <span className="text-xl font-bold text-red-400/80 font-mono mt-1">{dashboardStats.totalExpired}</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Product Specific</span>
          <span className="text-xl font-bold text-amber-200/80 font-mono mt-1">{dashboardStats.totalProductOffers}</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Coupon Vouchers</span>
          <span className="text-xl font-bold text-blue-400 font-mono mt-1">{dashboardStats.totalCouponOffers}</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between col-span-2 md:col-span-1 lg:col-span-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Offer Usages</span>
          <span className="text-xl font-bold text-slate-200 font-mono mt-1">{dashboardStats.usageCount} times</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex flex-col justify-between col-span-2 md:col-span-2 lg:col-span-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Savings Given</span>
          <span className="text-xl font-bold text-amber-400 font-mono mt-1">{formatINR(dashboardStats.revenueGenerated, { minimumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Tabs Selection and Search */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
          <button
            id="tab-coupon"
            onClick={() => setActiveTab('coupon')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 border-0 cursor-pointer ${
              activeTab === 'coupon'
                ? 'bg-slate-900 text-amber-400 shadow-sm border border-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Coupon Vouchers
          </button>
          <button
            id="tab-product"
            onClick={() => setActiveTab('product-specific')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 border-0 cursor-pointer ${
              activeTab === 'product-specific'
                ? 'bg-slate-900 text-amber-400 shadow-sm border border-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Product Offers
          </button>
          <button
            id="tab-customer-coupons"
            onClick={() => setActiveTab('customer-coupons')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 border-0 cursor-pointer ${
              activeTab === 'customer-coupons'
                ? 'bg-slate-900 text-amber-400 shadow-sm border border-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Redemption Ledger & Issue
          </button>
          <button
            id="tab-coupon-automation"
            onClick={() => setActiveTab('coupon-automation')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 border-0 cursor-pointer ${
              activeTab === 'coupon-automation'
                ? 'bg-slate-900 text-amber-400 shadow-sm border border-slate-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Coupon Automation
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            id="search-promotions"
            type="text"
            placeholder="Search campaigns by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Offers Cards Grid */}
      {activeTab === 'customer-coupons' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="customer-coupons-dashboard">
          {/* Column 1: Manual Issuance Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
            <h3 className="font-serif text-sm font-bold text-amber-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-500" /> Manual Coupon Issuance
            </h3>
            <p className="text-[11px] text-slate-400">
              Instantly issue a personalized reward coupon linked to a client's mobile number.
            </p>

            <form onSubmit={handleManualIssueCoupon} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">Customer Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={issueCustomerPhone}
                  onChange={(e) => setIssueCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Kumar"
                  value={issueCustomerName}
                  onChange={(e) => setIssueCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">Linked Campaign / Offer</label>
                <select
                  required
                  value={issueCampaignId}
                  onChange={(e) => setIssueCampaignId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Campaign --</option>
                  {offers.filter(o => !o.offerCategory || o.offerCategory === 'coupon').map((o) => (
                    <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-medium">Validity (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={issueValidityDays}
                  onChange={(e) => setIssueValidityDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded uppercase tracking-wider hover:bg-amber-400 transition cursor-pointer"
              >
                Issue Coupon Code
              </button>
            </form>
          </div>

          {/* Column 2 & 3: Ledger & Analytics */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="font-serif text-sm font-bold text-amber-100 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-500" /> Enterprise Customer Coupon Ledger
              </h3>
              <div className="text-[10px] text-slate-400 font-mono">
                Total: {customerCoupons.length} | Redeemed: {customerCoupons.filter(c => c.status === 'redeemed').length}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300 font-sans">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-850 font-mono text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Coupon</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Campaign</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {customerCoupons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No customer coupons have been generated yet.
                      </td>
                    </tr>
                  ) : (
                    customerCoupons.slice().reverse().map((coupon) => {
                      const offer = offers.find(o => o.id === coupon.offerId);
                      const isExpired = coupon.status === 'active' && new Date(coupon.expiryDate) < new Date(new Date().setHours(0,0,0,0));
                      
                      let statusBadge = (
                        <span className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                          Active
                        </span>
                      );
                      if (coupon.status === 'redeemed') {
                        statusBadge = (
                          <span className="bg-blue-500/15 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                            Redeemed
                          </span>
                        );
                      } else if (isExpired) {
                        statusBadge = (
                          <span className="bg-red-500/15 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                            Expired
                          </span>
                        );
                      }

                      return (
                        <tr key={coupon.id} className="hover:bg-slate-900/40 transition">
                          <td className="p-3 font-mono font-bold text-amber-100">{coupon.code}</td>
                          <td className="p-3">
                            <div className="font-semibold">{coupon.customerName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{coupon.customerPhone}</div>
                          </td>
                          <td className="p-3">
                            <div>{offer ? offer.name : 'Loyalty Reward'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">Issued: {coupon.issueDate}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-400">{coupon.expiryDate}</td>
                          <td className="p-3">{statusBadge}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                deleteCustomerCoupon(coupon.id);
                                showToast(`Deleted coupon code ${coupon.code}.`);
                              }}
                              className="p-1 bg-transparent hover:bg-slate-900 text-red-400 hover:text-red-300 rounded border-0 cursor-pointer"
                              title="Delete Coupon Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      ) : activeTab === 'coupon-automation' ? (
        <div className="flex flex-col gap-6 animate-fade-in" id="coupon-automation-container">
          {/* Global Configuration Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="font-serif text-base font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                Coupon Automation Engine
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Configure smart global rules for automated coupon generation and WhatsApp distribution after customer purchases.
              </p>
            </div>

            <form onSubmit={handleSaveAutomationSettings} className="space-y-6 text-xs">
              {/* 1. Enable Toggle */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-200 block text-sm">1. Enable Automatic Coupon Delivery</span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                    Toggle automatic generation and delivery after a customer checkout completes.
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-auto-toggle"
                  onClick={() => setAutoEnabled(!autoEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoEnabled ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {autoEnabled && (
                <div className="space-y-6">
                  {/* 2. Minimum Purchase Amount */}
                  <div className="space-y-2">
                    <label className="text-slate-300 block font-bold text-xs uppercase tracking-wider">
                      2. Minimum Purchase Amount (₹)
                    </label>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Only invoices greater than or equal to this amount qualify for automatic coupon generation.
                    </p>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">₹</span>
                      <input
                        type="number"
                        id="auto-min-purchase"
                        required
                        value={autoMinPurchase}
                        onChange={(e) => setAutoMinPurchase(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2.5 text-slate-200 font-mono font-bold focus:outline-none focus:border-amber-500"
                        placeholder="e.g. 3000"
                      />
                    </div>
                  </div>

                  {/* 3. Coupon Benefit */}
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-slate-300 block font-bold text-xs uppercase tracking-wider">
                      3. Coupon Benefit
                    </label>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Specify the benefit value and type (Percentage or Flat Amount) applied to the next bill.
                    </p>
                    <div className="flex items-center gap-3 max-w-md pt-1">
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          id="btn-benefit-percentage"
                          onClick={() => setAutoDiscountType('percentage')}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                            autoDiscountType === 'percentage'
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          % Discount
                        </button>
                        <button
                          type="button"
                          id="btn-benefit-flat"
                          onClick={() => setAutoDiscountType('flat')}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                            autoDiscountType === 'flat'
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ₹ Flat Off
                        </button>
                      </div>
                      <div className="relative flex-1">
                        <span className="absolute right-3 top-2.5 text-slate-500 font-mono font-bold">
                          {autoDiscountType === 'percentage' ? '%' : '₹'}
                        </span>
                        <input
                          type="number"
                          id="auto-discount-value"
                          required
                          value={autoDiscountValue}
                          onChange={(e) => setAutoDiscountValue(Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-amber-500"
                          placeholder={autoDiscountType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Coupon Validity */}
                  <div className="space-y-2">
                    <label className="text-slate-300 block font-bold text-xs uppercase tracking-wider">
                      4. Coupon Validity (Days)
                    </label>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Select how many days the generated coupon will remain active and usable from the date of issue.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[7, 15, 30, 45, 60, 90].map((days) => (
                        <button
                          key={days}
                          type="button"
                          id={`btn-validity-${days}`}
                          onClick={() => setAutoValidityDays(days)}
                          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition cursor-pointer border ${
                            autoValidityDays === days
                              ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-950/20'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {days} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5, 6, 7, 8. Toggles Block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Auto Generate */}
                    <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                          5. Auto Generate Coupon
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Always enabled. Automatically creates a unique 8-character code.
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full uppercase tracking-wider font-extrabold shrink-0">
                        Active
                      </span>
                    </div>

                    {/* Auto WhatsApp delivery toggle */}
                    <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                          6. Auto WhatsApp Delivery
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Automatically opens the official WhatsApp link right after checkout succeeds.
                        </span>
                      </div>
                      <button
                        type="button"
                        id="btn-auto-whatsapp"
                        onClick={() => setAutoWhatsAppDelivery(!autoWhatsAppDelivery)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoWhatsAppDelivery ? 'bg-amber-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            autoWhatsAppDelivery ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto Coupon Detection toggle */}
                    <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                          7. Auto Coupon Detection
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Subsequent customer lookup automatically queries and highlights active unused coupons.
                        </span>
                      </div>
                      <button
                        type="button"
                        id="btn-auto-coupon-detection"
                        onClick={() => setAutoCouponDetection(!autoCouponDetection)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoCouponDetection ? 'bg-amber-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            autoCouponDetection ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto Apply During Next Billing toggle */}
                    <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                          8. Auto Apply During Next Billing
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Automatically pre-applies the highest savings coupon upon customer selection.
                        </span>
                      </div>
                      <button
                        type="button"
                        id="btn-auto-apply-next"
                        onClick={() => setAutoApplyOnNextVisit(!autoApplyOnNextVisit)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoApplyOnNextVisit ? 'bg-amber-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            autoApplyOnNextVisit ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Configurations Button */}
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  id="btn-save-automation"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 hover:text-slate-900 font-bold rounded-lg text-xs uppercase tracking-wider transition active:scale-95 shadow-md shadow-amber-950/25 cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>

          {/* Coupon Delivery Logs Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-serif text-base font-bold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-amber-500" /> Coupon Delivery History Logs
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  A live, running audit log of all coupons generated and pushed to distribution channels.
                </p>
              </div>

              {/* Delivery Filter Selector */}
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850 gap-1 w-full md:w-auto">
                {(['All', 'Sent', 'Pending', 'Failed'] as const).map((filter) => {
                  const count = filter === 'All'
                    ? couponDeliveryLogs.length
                    : couponDeliveryLogs.filter(log => log.status === filter).length;
                  return (
                    <button
                      key={filter}
                      type="button"
                      id={`delivery-filter-${filter.toLowerCase()}`}
                      onClick={() => setDeliveryFilter(filter)}
                      className={`flex-1 md:flex-initial px-3 py-1.5 rounded text-[10px] font-bold uppercase transition cursor-pointer ${
                        deliveryFilter === filter
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                      }`}
                    >
                      {filter} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table layout */}
            <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300 font-sans">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-850 font-mono text-[10px] uppercase tracking-wider">
                  <tr>
                    <th 
                      className="p-3 cursor-pointer hover:bg-slate-900 select-none group"
                      onClick={() => handleToggleSort('date')}
                      id="th-delivery-date"
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        Date & Time
                        {deliverySortField === 'date' ? (
                          deliverySortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500 group-hover:text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Coupon Code</th>
                    <th 
                      className="p-3 cursor-pointer hover:bg-slate-900 select-none group"
                      onClick={() => handleToggleSort('status')}
                      id="th-delivery-status"
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        Status
                        {deliverySortField === 'status' ? (
                          deliverySortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500 group-hover:text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredDeliveryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No automated coupon logs found for "{deliveryFilter}".
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/30 transition text-[11px]">
                        <td className="p-3 font-mono text-slate-400">{log.date}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-200">{log.customerName}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{log.customerPhone}</div>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{log.invoiceNo}</td>
                        <td className="p-3">
                          <span className="font-extrabold text-amber-400 font-mono text-xs tracking-wider uppercase bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            {log.couponCode}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                log.status === 'Sent'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : log.status === 'Pending'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  : 'bg-red-500/10 border-red-500/20 text-red-400'
                              }`}
                            >
                              {log.status}
                            </span>
                            {log.sentTime && (
                              <span className="text-[9px] text-slate-500 font-mono" title="Originally Sent Time">
                                Sent: {log.sentTime}
                              </span>
                            )}
                            {log.resentTime && (
                              <span className="text-[9px] text-amber-500/80 font-mono" title="Last Resent Time">
                                Resend: {log.resentTime}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={log.status}
                              id={`select-status-${log.id}`}
                              onChange={(e) => updateCouponDeliveryLogStatus(log.id, e.target.value as any)}
                              className="bg-slate-950 border border-slate-800 rounded text-[9px] text-slate-300 font-mono focus:outline-none focus:border-amber-500 px-1.5 py-1 cursor-pointer"
                            >
                              <option value="Sent">Sent</option>
                              <option value="Pending">Pending</option>
                              <option value="Failed">Failed</option>
                            </select>

                            {log.status === 'Failed' ? (
                              <button
                                type="button"
                                id={`btn-retry-failed-${log.id}`}
                                onClick={() => handleReTriggerWhatsApp(log)}
                                className="flex items-center gap-1 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/15 hover:border-red-500/25 px-2 py-1 rounded text-[9px] font-bold transition cursor-pointer"
                                title="Retry WhatsApp Delivery"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                Retry
                              </button>
                            ) : (
                              <button
                                type="button"
                                id={`btn-retrigger-${log.id}`}
                                onClick={() => handleReTriggerWhatsApp(log)}
                                className="flex items-center gap-1 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/15 hover:border-emerald-500/25 px-2 py-1 rounded text-[9px] font-bold transition cursor-pointer"
                                title="Re-trigger WhatsApp Share"
                              >
                                <Share2 className="w-2.5 h-2.5" />
                                Share
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="offers-list-container">
          {filteredOffers.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 border border-slate-850 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-slate-600" />
              <p className="text-xs">No active campaign promotions found matching filter criteria.</p>
            </div>
          ) : (
            filteredOffers.map((o) => {
              const isLive = o.isActive;
              const hasDates = o.startDate || o.endDate;
              return (
                <div
                  key={o.id}
                  className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between hover:border-amber-500/20 transition relative overflow-hidden group ${
                    isLive ? 'border-slate-800' : 'border-slate-850 opacity-60'
                  }`}
                >
                  {/* Visual card header */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-950 bg-amber-500 px-2 py-0.5 rounded tracking-wider uppercase">
                            {o.code}
                          </span>
                          {o.isStackable && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold px-1.5 py-0.5 rounded uppercase">
                              Stackable
                            </span>
                          )}
                          {o.priority && o.priority > 1 && (
                            <span className="text-[8px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono px-1.5 py-0.5 rounded">
                              P-{o.priority}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif font-bold text-slate-200 mt-2.5 text-sm">{o.name}</h3>
                      </div>
                      <div>
                        <button
                          onClick={() => updateOffer(o.id, { isActive: !o.isActive })}
                          className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border transition cursor-pointer ${
                            isLive
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'text-slate-500 bg-slate-950 border-slate-850 hover:bg-slate-800'
                          }`}
                        >
                          {isLive ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {isLive ? 'Live' : 'Paused'}
                        </button>
                      </div>
                    </div>

                    {/* Summary parameters list */}
                    <div className="space-y-2 text-[11px] bg-slate-950/50 p-3 rounded-xl border border-slate-850/80 font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Offer Type:</span>
                        <span className="font-bold text-slate-200 font-mono capitalize">{String(o.type || '').replace(/-/g, ' ')}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400">Deduction Value:</span>
                        <span className="font-bold text-amber-200 font-mono">
                          {o.type === 'percentage' ? `${o.value}% Off` : o.type === 'flat' ? `Flat ₹${o.value} Off` : 'Promo-specific'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400">Scope Targeting:</span>
                        <span className="font-bold text-slate-300 capitalize">{o.scope ? String(o.scope).replace(/-/g, ' ') : 'Store-wide'}</span>
                      </div>

                      {hasDates && (
                        <div className="flex justify-between border-t border-slate-850 pt-1.5 mt-1.5 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Valid Dates:</span>
                          <span className="font-mono font-semibold text-slate-300 text-right">
                            {o.startDate || 'Anytime'} to {o.endDate || o.expiryDate || 'Forever'}
                          </span>
                        </div>
                      )}

                      {(o.startTime || o.endTime) && (
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Active Hours:</span>
                          <span className="font-mono font-semibold text-slate-300 text-right">
                            {o.startTime || '00:00'} - {o.endTime || '23:59'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dynamic tracking metrics */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/20 border border-slate-850 p-2.5 rounded-lg font-mono">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Times Applied:</span>
                        <span className="font-bold text-slate-300 text-xs">{o.usageCount || 0} usages</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Total Savings Given:</span>
                        <span className="font-bold text-amber-400 text-xs">{formatINR(o.revenueGenerated || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Operations links */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-850 mt-4 text-[10px]">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">ID: {(o.id || '').slice(-4)}</span>
                    <div className="flex gap-3">
                      <PermissionButton
                        id={`btn-offer-edit-${o.id}`}
                        module="promotions"
                        action="edit"
                        onClick={() => {
                          window.location.hash = `promotions/edit-product-offer?id=${o.id}`;
                        }}
                        className="text-[10px] font-bold text-amber-500 hover:text-amber-400 transition border-0 bg-transparent cursor-pointer"
                      >
                        Configure Deal
                      </PermissionButton>
                      <PermissionButton
                        id={`btn-offer-delete-${o.id}`}
                        module="promotions"
                        action="delete"
                        onClick={() => {
                          setDeleteConfirmId(o.id);
                          setDeleteConfirmName(o.name);
                        }}
                        className="text-[10px] font-bold text-red-400/80 hover:text-red-400 transition border-0 bg-transparent cursor-pointer"
                      >
                        Delete
                      </PermissionButton>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Beautiful custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold text-slate-100" id="dialog-title">Delete Record</h3>
                <p className="text-xs text-slate-400 leading-relaxed" id="dialog-message">
                  This action cannot be undone.
                  <br />
                  Are you sure you want to permanently delete this record?
                </p>
                {deleteConfirmName && (
                  <p className="text-[11px] font-mono text-red-400 bg-slate-950 px-2.5 py-1.5 rounded mt-3 border border-slate-850">
                    Target: {deleteConfirmName}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                id="btn-delete-cancel"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName('');
                }}
                className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 font-bold rounded-lg text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-delete-confirm"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition active:scale-95 shadow-md shadow-red-900/20 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {whatsappBlockedUrl && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl relative text-center">
            <button
              onClick={() => setWhatsappBlockedUrl(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1 animate-pulse">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-base font-bold text-slate-100">WhatsApp Popup Blocked</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your browser blocked the automatic WhatsApp tab. Please click the button below to send the message directly.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (whatsappBlockedUrl) {
                    try {
                      const opened = window.open(whatsappBlockedUrl, "SmartFashionWhatsApp");
                      if (opened) opened.focus();
                    } catch (err) {
                      console.error(err);
                    }
                  }
                  setWhatsappBlockedUrl(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest transition shadow-lg shadow-emerald-900/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Top Customers Offer Modal */}
      {topCustomersOfferOpen && (
        <TopCustomersOfferModal
          isOpen={topCustomersOfferOpen}
          onClose={() => setTopCustomersOfferOpen(false)}
        />
      )}
    </div>
  );
};
