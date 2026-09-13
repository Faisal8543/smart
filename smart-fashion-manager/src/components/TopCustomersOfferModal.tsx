/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import {
  Trophy,
  X,
  Calendar,
  CheckSquare,
  Square,
  Gift,
  Tag,
  Percent,
  DollarSign,
  Send,
  Smartphone,
  Check,
  Award,
  ChevronRight,
  Search,
  Users,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { getLocalYYYYMMDD, formatNiceDateRange } from '../utils/dateFilter';

interface TopCustomersOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type PeriodPreset =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-1-year'
  | 'custom';

export type TopGroupPreset = 'top-10' | 'top-25' | 'top-50' | 'top-100' | 'custom-range';

export type VipOfferType =
  | 'flat'
  | 'percentage'
  | 'buy_x_get_y'
  | 'free_gift'
  | 'voucher'
  | 'cashback'
  | 'custom';

export interface RankedCustomerItem {
  rank: number;
  phone: string;
  name: string;
  totalShopping: number;
  totalBills: number;
  lastPurchaseDate: string;
}

export const TopCustomersOfferModal: React.FC<TopCustomersOfferModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { invoices, customers, settings, addCustomerCoupon, customerCoupons, setCouponDeliveryLogs } =
    useAppState();

  // Wizard Step: 1 = Period, 2 = Group, 3 = Configure, 4 = Generate
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Period Selection State
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this-month');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return getLocalYYYYMMDD(d);
  });
  const [toDate, setToDate] = useState<string>(() => getLocalYYYYMMDD(new Date()));

  // Step 2: Customer Group Selection State
  const [groupPreset, setGroupPreset] = useState<TopGroupPreset>('top-25');
  const [customRankFrom, setCustomRankFrom] = useState<number>(1);
  const [customRankTo, setCustomRankTo] = useState<number>(20);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Step 3: Offer Configuration State
  const [campaignTitle, setCampaignTitle] = useState<string>('Exclusive VIP Top Customer Reward');
  const [offerType, setOfferType] = useState<VipOfferType>('percentage');
  const [offerValue, setOfferValue] = useState<string>('25');
  const [minPurchase, setMinPurchase] = useState<number>(2000);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [customExpiryDate, setCustomExpiryDate] = useState<string>(() => {
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    return getLocalYYYYMMDD(exp);
  });
  const [isStackable, setIsStackable] = useState<boolean>(false);
  const [isOneTimeUse, setIsOneTimeUse] = useState<boolean>(true);

  // Step 4: Generated Coupons State
  const [generatedCoupons, setGeneratedCoupons] = useState<
    Array<{ phone: string; name: string; code: string; offerText: string; isDuplicate?: boolean }>
  >([]);
  const [sentIndexes, setSentIndexes] = useState<Set<number>>(new Set());
  const [whatsappBlockedUrl, setWhatsappBlockedUrl] = useState<string | null>(null);

  // Helper to handle period preset changes
  const handleSelectPeriodPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const today = new Date();

    if (preset === 'this-month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(getLocalYYYYMMDD(start));
      setToDate(getLocalYYYYMMDD(today));
    } else if (preset === 'last-month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(getLocalYYYYMMDD(start));
      setToDate(getLocalYYYYMMDD(end));
    } else if (preset === 'last-3-months') {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 3);
      setFromDate(getLocalYYYYMMDD(start));
      setToDate(getLocalYYYYMMDD(today));
    } else if (preset === 'last-6-months') {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 6);
      setFromDate(getLocalYYYYMMDD(start));
      setToDate(getLocalYYYYMMDD(today));
    } else if (preset === 'last-1-year') {
      const start = new Date(today);
      start.setFullYear(start.getFullYear() - 1);
      setFromDate(getLocalYYYYMMDD(start));
      setToDate(getLocalYYYYMMDD(today));
    }
  };

  // Compute customer ranking for selected period
  const rankedPeriodCustomers = useMemo(() => {
    const validInvoices = invoices.filter(
      (inv) => inv.status !== 'Cancelled' && inv.status !== 'Returned'
    );

    const customerMap = new Map<string, { name: string; phone: string }>();
    customers.forEach((c) => {
      if (c.phone) {
        customerMap.set(c.phone.trim(), { name: c.name, phone: c.phone.trim() });
      }
    });

    const statsMap = new Map<
      string,
      {
        phone: string;
        name: string;
        totalShopping: number;
        totalBills: number;
        lastPurchaseDate: string;
      }
    >();

    validInvoices.forEach((inv) => {
      const phone = (inv.customerPhone || '').replace(/\D/g, '');
      if (!phone) return;

      const invDateStr = inv.date
        ? inv.date.includes('T')
          ? inv.date.split('T')[0]
          : inv.date.split(' ')[0]
        : '';

      if (invDateStr >= fromDate && invDateStr <= toDate) {
        let entry = statsMap.get(phone);
        if (!entry) {
          const knownCust = customerMap.get(phone);
          entry = {
            phone,
            name: knownCust ? knownCust.name : inv.customerName || 'VIP Customer',
            totalShopping: 0,
            totalBills: 0,
            lastPurchaseDate: invDateStr,
          };
          statsMap.set(phone, entry);
        }

        entry.totalShopping += inv.grandTotal || 0;
        entry.totalBills += 1;
        if (invDateStr > entry.lastPurchaseDate) {
          entry.lastPurchaseDate = invDateStr;
        }
      }
    });

    // Also include registered customers if needed
    customers.forEach((c) => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanPhone && !statsMap.has(cleanPhone)) {
        statsMap.set(cleanPhone, {
          phone: cleanPhone,
          name: c.name,
          totalShopping: 0,
          totalBills: 0,
          lastPurchaseDate: 'No purchases in period',
        });
      }
    });

    const list = Array.from(statsMap.values());
    list.sort((a, b) => b.totalShopping - a.totalShopping);

    return list.map((item, idx) => ({
      rank: idx + 1,
      phone: item.phone,
      name: formatMemberName(item.name),
      totalShopping: item.totalShopping,
      totalBills: item.totalBills,
      lastPurchaseDate: item.lastPurchaseDate,
    }));
  }, [invoices, customers, fromDate, toDate]);

  // Handle auto selecting group preset
  const handleApplyGroupPreset = (preset: TopGroupPreset) => {
    setGroupPreset(preset);
    let topCount = 25;
    if (preset === 'top-10') topCount = 10;
    else if (preset === 'top-25') topCount = 25;
    else if (preset === 'top-50') topCount = 50;
    else if (preset === 'top-100') topCount = 100;

    if (preset !== 'custom-range') {
      const topPhones = rankedPeriodCustomers.slice(0, topCount).map((c) => c.phone);
      setSelectedPhones(new Set(topPhones));
    } else {
      const rangePhones = rankedPeriodCustomers
        .slice(Math.max(0, customRankFrom - 1), Math.max(customRankFrom, customRankTo))
        .map((c) => c.phone);
      setSelectedPhones(new Set(rangePhones));
    }
  };

  const handleApplyCustomRange = (fromR: number, toR: number) => {
    setCustomRankFrom(fromR);
    setCustomRankTo(toR);
    const rangePhones = rankedPeriodCustomers
      .slice(Math.max(0, fromR - 1), Math.max(fromR, toR))
      .map((c) => c.phone);
    setSelectedPhones(new Set(rangePhones));
  };

  // Filtered customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return rankedPeriodCustomers;
    const term = (customerSearch || '').toLowerCase().trim();
    return rankedPeriodCustomers.filter(
      (c) => (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)
    );
  }, [rankedPeriodCustomers, customerSearch]);

  const toggleCustomerSelection = (phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  };

  // Validity days change helper
  const handleValidityDaysChange = (days: number) => {
    setValidityDays(days);
    const exp = new Date();
    exp.setDate(exp.getDate() + days);
    setCustomExpiryDate(getLocalYYYYMMDD(exp));
  };

  // Unique Code Generator
  const generateVipCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'VIP-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Helper for cleaning phone for WhatsApp
  const cleanPhoneForWhatsApp = (phoneStr: string) => {
    const digits = (phoneStr || '').replace(/\D/g, '');
    if (digits.length === 10) return '91' + digits;
    return digits;
  };

  // Step 3 -> Step 4: Generate Offers
  const handleGenerateOffers = () => {
    if (selectedPhones.size === 0) return;

    const issueDateStr = getLocalYYYYMMDD(new Date());

    let formattedDiscountType: 'percentage' | 'flat' = 'percentage';
    let discountValNum = parseFloat(offerValue) || 10;
    let benefitText = `${offerValue}% OFF`;

    if (offerType === 'flat') {
      formattedDiscountType = 'flat';
      benefitText = `Flat ₹${offerValue} OFF`;
    } else if (offerType === 'voucher') {
      formattedDiscountType = 'flat';
      benefitText = `₹${offerValue} Gift Voucher`;
    } else if (offerType === 'free_gift') {
      formattedDiscountType = 'flat';
      discountValNum = 0;
      benefitText = `Free Gift: ${offerValue}`;
    } else if (offerType === 'buy_x_get_y') {
      formattedDiscountType = 'percentage';
      benefitText = `Buy X Get Y Special (${offerValue})`;
    } else if (offerType === 'cashback') {
      formattedDiscountType = 'flat';
      benefitText = `₹${offerValue} Cashback Coupon`;
    } else if (offerType === 'custom') {
      formattedDiscountType = 'flat';
      benefitText = offerValue;
    }

    const createdList: Array<{
      phone: string;
      name: string;
      code: string;
      offerText: string;
      isDuplicate?: boolean;
    }> = [];

    const selectedList = rankedPeriodCustomers.filter((c) => selectedPhones.has(c.phone));

    selectedList.forEach((cust) => {
      // Duplicate check for active coupon with same customerPhone and offer title prefix
      const existing = customerCoupons.find(
        (cp) =>
          cp.customerPhone === cust.phone &&
          cp.status === 'active' &&
          cp.offerId === 'top_customers_vip_campaign'
      );

      if (existing) {
        createdList.push({
          phone: cust.phone,
          name: cust.name,
          code: existing.code,
          offerText: benefitText,
          isDuplicate: true,
        });
      } else {
        const code = generateVipCode();

        addCustomerCoupon({
          code,
          customerPhone: cust.phone,
          customerName: cust.name,
          offerId: 'top_customers_vip_campaign',
          issueDate: issueDateStr,
          expiryDate: customExpiryDate,
          status: 'active',
          discountType: formattedDiscountType,
          discountValue: discountValNum,
          minPurchaseAmount: minPurchase,
          autoApplyOnNextVisit: isOneTimeUse,
        });

        createdList.push({
          phone: cust.phone,
          name: cust.name,
          code,
          offerText: benefitText,
          isDuplicate: false,
        });
      }
    });

    setGeneratedCoupons(createdList);
    setStep(4);

    // If auto WhatsApp is enabled, auto send first message
    if (settings?.couponAutomation?.autoWhatsAppDelivery && createdList.length > 0) {
      sendWhatsAppMessage(createdList[0], 0);
    }
  };

  // Dispatch WhatsApp message
  const sendWhatsAppMessage = (
    item: { phone: string; name: string; code: string; offerText: string },
    index: number
  ) => {
    const storeName = settings?.storeProfile?.name || 'SMART FASHION';
    const storeLocation = settings?.storeProfile?.address || 'Milan Galleria, Manjheli, Purnia';

    const msg = `Dear *${formatMemberName(item.name)}*,

👑 *EXCLUSIVE TOP CUSTOMER REWARD!*
Thank you for being one of our highest-valued patrons at *${storeName}*.

We are delighted to present you with an exclusive VIP Offer Coupon:

🎫 Coupon Code: *${item.code}*
✨ Special Benefit: *${item.offerText}*
💰 Minimum Purchase: ₹${minPurchase}
🗓️ Valid Until: ${customExpiryDate}
🔒 ${isOneTimeUse ? 'One-Time Exclusive Use' : 'Reusable VIP Coupon'}

Visit us at ${storeLocation} to redeem your reward!
_Smart Fashion VIP Concierge_`;

    const formattedPhone = cleanPhoneForWhatsApp(item.phone);
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;

    try {
      const opened = window.open(url, 'SmartFashionWhatsApp');
      if (!opened) {
        setWhatsappBlockedUrl(url);
      } else {
        opened.focus();
        setWhatsappBlockedUrl(null);
      }
    } catch (err) {
      setWhatsappBlockedUrl(url);
    }

    setSentIndexes((prev) => new Set(prev).add(index));

    const nowStr =
      new Date().toLocaleDateString('en-IN') +
      ' ' +
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    setCouponDeliveryLogs((prev) => [
      {
        id: 'vip_log_' + Math.random().toString(36).substr(2, 9),
        customerName: item.name,
        customerPhone: item.phone,
        couponCode: item.code,
        invoiceNo: 'TOP_CUSTOMERS_CAMPAIGN',
        date: nowStr,
        status: 'Sent',
        sentTime: nowStr,
      },
      ...prev,
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-xs overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 rounded-xl shadow-lg shadow-amber-950/40">
              <Trophy className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl font-bold text-amber-100">
                  🏆 Top Customers Offer Generator
                </h2>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  VIP REWARD CAMPAIGN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generate exclusive rewards for your top spending patrons with WhatsApp dispatch.
              </p>
            </div>
          </div>

          <button
            id="close-top-customers-offer-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Step Indicator */}
        <div className="bg-slate-950 border-b border-slate-850 p-3 grid grid-cols-4 text-center gap-2 text-[11px] font-bold flex-shrink-0">
          {[
            { s: 1, label: 'Select Period' },
            { s: 2, label: 'Select Group' },
            { s: 3, label: 'Configure Offer' },
            { s: 4, label: 'Generate & Dispatch' },
          ].map((item) => (
            <div
              key={item.s}
              className={`p-2 rounded-xl flex items-center justify-center gap-2 transition ${
                step === item.s
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : step > item.s
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-900 text-slate-500 border border-slate-800'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
                  step === item.s ? 'bg-slate-950 text-amber-400 font-bold' : 'bg-slate-950/40'
                }`}
              >
                {step > item.s ? '✓' : item.s}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </div>

        {/* STEP 1: Select Ranking Period */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-900/60 max-w-3xl mx-auto w-full">
            <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl space-y-4">
              <h3 className="font-serif text-sm font-bold text-amber-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Step 1: Select Spending Ranking Period
              </h3>

              {/* Preset Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'this-month', label: 'This Month' },
                  { id: 'last-month', label: 'Last Month' },
                  { id: 'last-3-months', label: 'Last 3 Months' },
                  { id: 'last-6-months', label: 'Last 6 Months' },
                  { id: 'last-1-year', label: 'Last 1 Year' },
                  { id: 'custom', label: 'Custom Date Range' },
                ].map((p) => (
                  <button
                    key={p.id}
                    id={`btn-period-${p.id}`}
                    type="button"
                    onClick={() => handleSelectPeriodPreset(p.id as PeriodPreset)}
                    className={`p-3 rounded-xl border text-center transition font-bold text-xs cursor-pointer ${
                      periodPreset === p.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendar Date Inputs */}
              <div className="pt-2 border-t border-slate-850 space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-slate-300">
                    Selected Ranking Period:
                  </span>
                  <span className="text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {formatNiceDateRange(fromDate, toDate)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                      From Date:
                    </label>
                    <div className="relative premium-date-container group">
                      <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                      <input
                        id="ranking-from-date"
                        type="date"
                        value={fromDate}
                        onChange={(e) => {
                          setPeriodPreset('custom');
                          setFromDate(e.target.value);
                        }}
                        className="peer w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-3 text-slate-200 font-mono transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                      To Date:
                    </label>
                    <div className="relative premium-date-container group">
                      <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                      <input
                        id="ranking-to-date"
                        type="date"
                        value={toDate}
                        onChange={(e) => {
                          setPeriodPreset('custom');
                          setToDate(e.target.value);
                        }}
                        className="peer w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-3 text-slate-200 font-mono transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl text-slate-300 text-xs flex justify-between items-center">
                <span>Ranked Patrons Found in Period:</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {rankedPeriodCustomers.length} Customers
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Select Customer Group */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/60">
            {/* Quick Group Presets */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Step 2: Select Top Customer Group
                </span>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {selectedPhones.size} Patrons Selected
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'top-10', label: '🥇 Top 10' },
                  { id: 'top-25', label: '🥈 Top 25' },
                  { id: 'top-50', label: '🥉 Top 50' },
                  { id: 'top-100', label: '🏅 Top 100' },
                ].map((g) => (
                  <button
                    key={g.id}
                    id={`btn-group-${g.id}`}
                    type="button"
                    onClick={() => handleApplyGroupPreset(g.id as TopGroupPreset)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border ${
                      groupPreset === g.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
                  <span className="text-slate-400 font-bold px-1 text-[10px] uppercase">
                    Rank:
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={customRankFrom}
                    onChange={(e) => setCustomRankFrom(parseInt(e.target.value) || 1)}
                    className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-200 font-mono"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="number"
                    min="1"
                    value={customRankTo}
                    onChange={(e) => setCustomRankTo(parseInt(e.target.value) || 20)}
                    className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-slate-200 font-mono"
                  />
                  <button
                    id="btn-apply-custom-rank-range"
                    type="button"
                    onClick={() => {
                      setGroupPreset('custom-range');
                      handleApplyCustomRange(customRankFrom, customRankTo);
                    }}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30 cursor-pointer"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            </div>

            {/* Customer List Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex justify-between items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    id="search-top-offer-customers"
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search patrons by name or mobile..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-select-all-top-offer"
                    onClick={() => {
                      const all = rankedPeriodCustomers.map((c) => c.phone);
                      setSelectedPhones(new Set(all));
                    }}
                    className="text-[10px] text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    id="btn-clear-all-top-offer"
                    onClick={() => setSelectedPhones(new Set())}
                    className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="p-3 text-center w-12">Select</th>
                      <th className="p-3 text-center w-14">Rank</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Mobile Number</th>
                      <th className="p-3 text-center">Period Bills</th>
                      <th className="p-3 text-right">Total Shopping in Period</th>
                      <th className="p-3 text-center">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs">
                    {filteredCustomers.map((c) => {
                      const isSelected = selectedPhones.has(c.phone);
                      return (
                        <tr
                          key={c.phone}
                          onClick={() => toggleCustomerSelection(c.phone)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-500/10 hover:bg-amber-500/15'
                              : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <td className="p-3 text-center">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400 inline" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 inline" />
                            )}
                          </td>
                          <td className="p-3 text-center font-bold font-mono text-slate-400">
                            #{c.rank}
                          </td>
                          <td className="p-3 font-bold text-slate-200">{c.name}</td>
                          <td className="p-3 font-mono text-slate-400">{c.phone}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-300">
                            {c.totalBills}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-300">
                            {formatINR(c.totalShopping, { keepDecimals: true })}
                          </td>
                          <td className="p-3 text-center font-mono text-[10px] text-slate-400">
                            {c.lastPurchaseDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Configure Offer */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/60 max-w-2xl mx-auto w-full">
            <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl space-y-4">
              <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                Step 3: Configure Exclusive VIP Offer
              </h3>

              {/* Campaign Title */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Campaign Title *
                </label>
                <input
                  id="vip-campaign-title-input"
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="Exclusive VIP Top Customer Reward"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 text-xs font-bold"
                  required
                />
              </div>

              {/* Offer Type selector */}
              <div className="space-y-1.5">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Offer Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'flat', label: 'Flat Discount', icon: <Tag className="w-3.5 h-3.5" /> },
                    { id: 'percentage', label: 'Percentage Discount', icon: <Percent className="w-3.5 h-3.5" /> },
                    { id: 'buy_x_get_y', label: 'Buy X Get Y', icon: <Sparkles className="w-3.5 h-3.5" /> },
                    { id: 'free_gift', label: 'Free Gift', icon: <Gift className="w-3.5 h-3.5" /> },
                    { id: 'voucher', label: 'Gift Voucher', icon: <Award className="w-3.5 h-3.5" /> },
                    { id: 'cashback', label: 'Cashback Coupon', icon: <DollarSign className="w-3.5 h-3.5" /> },
                    { id: 'custom', label: 'Custom Offer', icon: <Sliders className="w-3.5 h-3.5" /> },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      id={`btn-vip-offer-type-${t.id}`}
                      onClick={() => setOfferType(t.id as VipOfferType)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                        offerType === t.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t.icon}
                      <span className="text-[11px]">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Offer Value input */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Offer Value / Benefit *
                </label>
                <input
                  id="vip-offer-value-input"
                  type="text"
                  value={offerValue}
                  onChange={(e) => setOfferValue(e.target.value)}
                  placeholder="e.g. 25 (for 25% OFF) or 1000 (for ₹1000 Voucher)"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 text-xs font-bold"
                  required
                />
              </div>

              {/* Minimum Purchase & Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Minimum Purchase Amount (₹)
                  </label>
                  <input
                    id="vip-min-purchase-input"
                    type="number"
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Offer Validity (Days)
                  </label>
                  <input
                    id="vip-validity-days-input"
                    type="number"
                    value={validityDays}
                    onChange={(e) => handleValidityDaysChange(parseInt(e.target.value) || 30)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Coupon Expiry Date
                </label>
                <div className="relative premium-date-container group">
                  <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                  <input
                    id="vip-expiry-date-input"
                    type="date"
                    value={customExpiryDate}
                    onChange={(e) => setCustomExpiryDate(e.target.value)}
                    className="peer w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-3 text-slate-200 font-mono text-xs transition"
                  />
                </div>
              </div>

              {/* Stackable & One-Time Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Combinability
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="stackable"
                        checked={!isStackable}
                        onChange={() => setIsStackable(false)}
                        className="text-amber-500 focus:ring-0"
                      />
                      Standalone
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="stackable"
                        checked={isStackable}
                        onChange={() => setIsStackable(true)}
                        className="text-amber-500 focus:ring-0"
                      />
                      Stackable
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Redemption Policy
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="oneTime"
                        checked={isOneTimeUse}
                        onChange={() => setIsOneTimeUse(true)}
                        className="text-amber-500 focus:ring-0"
                      />
                      One-Time Use
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="oneTime"
                        checked={!isOneTimeUse}
                        onChange={() => setIsOneTimeUse(false)}
                        className="text-amber-500 focus:ring-0"
                      />
                      Multiple Use
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Generate & Summary */}
        {step === 4 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/60">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-emerald-200">
                  VIP Top Customer Offers Created Successfully!
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Generated <span className="font-bold text-white">{generatedCoupons.length}</span> unique
                  VIP reward coupons in system ledger.
                </p>
              </div>
            </div>

            {/* Popup Blocked Warning if any */}
            {whatsappBlockedUrl && (
              <div className="bg-amber-950/60 border border-amber-500/40 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                <span className="text-xs text-amber-300 font-bold uppercase">
                  Browser Popup Blocked!
                </span>
                <button
                  id="btn-open-whatsapp-direct-top-customers"
                  onClick={(e) => {
                    e.preventDefault();
                    if (whatsappBlockedUrl) {
                      const opened = window.open(whatsappBlockedUrl, 'SmartFashionWhatsApp');
                      if (opened) opened.focus();
                    }
                    setWhatsappBlockedUrl(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-6 rounded-xl transition uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Smartphone className="w-4 h-4" />
                  Open WhatsApp Tab
                </button>
              </div>
            )}

            {/* List of Coupons Generated & WhatsApp Dispatch Status */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-200 text-xs">
                  Generated VIP Records ({generatedCoupons.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  WhatsApp Dispatched: {sentIndexes.size} / {generatedCoupons.length}
                </span>
              </div>

              <div className="divide-y divide-slate-850 max-h-72 overflow-y-auto">
                {generatedCoupons.map((item, idx) => {
                  const isSent = sentIndexes.has(idx);
                  return (
                    <div
                      key={item.code}
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/60"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{item.name}</span>
                          <span className="font-mono text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                            {item.code}
                          </span>
                          {item.isDuplicate && (
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              Existing Active Code
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          📱 {item.phone} • {item.offerText}
                        </p>
                      </div>

                      <button
                        id={`btn-send-whatsapp-vip-${idx}`}
                        onClick={() => sendWhatsAppMessage(item, idx)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                          isSent
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSent ? 'Resend WhatsApp' : 'Send WhatsApp'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center flex-shrink-0">
          {step > 1 && step < 4 ? (
            <button
              id="btn-top-offer-back"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              id="btn-next-to-group-select"
              onClick={() => {
                handleApplyGroupPreset(groupPreset);
                setStep(2);
              }}
              className="gold-gradient text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20"
            >
              <span>Next: Select Customer Group</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}

          {step === 2 && (
            <button
              id="btn-next-to-offer-config"
              disabled={selectedPhones.size === 0}
              onClick={() => setStep(3)}
              className="gold-gradient text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20"
            >
              <span>Configure VIP Offer ({selectedPhones.size} Patrons)</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}

          {step === 3 && (
            <button
              id="btn-generate-vip-offers-submit"
              onClick={handleGenerateOffers}
              className="gold-gradient text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-widest transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              Generate VIP Offers ({selectedPhones.size})
            </button>
          )}

          {step === 4 && (
            <button
              id="btn-top-offer-done"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Done & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
