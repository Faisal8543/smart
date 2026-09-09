/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import {
  Sparkles,
  X,
  Calendar,
  CheckSquare,
  Square,
  Gift,
  Tag,
  Percent,
  Send,
  Smartphone,
  Check,
  Award,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { getLocalYYYYMMDD, formatNiceDateRange } from '../utils/dateFilter';

interface AnniversaryCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type OfferType =
  | 'flat'
  | 'percentage'
  | 'voucher'
  | 'free_gift'
  | 'buy_x_get_y'
  | 'custom';

export interface CampaignCustomerRank {
  rank: number;
  phone: string;
  name: string;
  totalShopping: number;
  totalBills: number;
  lastPurchaseDate: string;
}

export const AnniversaryCampaignModal: React.FC<AnniversaryCampaignModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { invoices, customers, settings, addCustomerCoupon, setCouponDeliveryLogs } =
    useAppState();

  // Wizard Step: 1 = Select Customers, 2 = Configure Offer, 3 = Summary / WhatsApp Dispatch
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Campaign Period
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return getLocalYYYYMMDD(d);
  });
  const [toDate, setToDate] = useState<string>(() => getLocalYYYYMMDD(new Date()));

  // Customer selection map (phone -> boolean)
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Step 2: Offer Configuration
  const [offerType, setOfferType] = useState<OfferType>('percentage');
  const [offerValue, setOfferValue] = useState<string>('20');
  const [campaignTitle, setCampaignTitle] = useState<string>('Showroom Anniversary Special');
  const [minPurchase, setMinPurchase] = useState<number>(1000);
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [customExpiryDate, setCustomExpiryDate] = useState<string>(() => {
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    return getLocalYYYYMMDD(exp);
  });

  // Step 3: Generated Results
  const [generatedCoupons, setGeneratedCoupons] = useState<
    Array<{ phone: string; name: string; code: string; offerText: string }>
  >([]);
  const [sentIndexes, setSentIndexes] = useState<Set<number>>(new Set());
  const [whatsappBlockedUrl, setWhatsappBlockedUrl] = useState<string | null>(null);

  // Compute customer ranking for campaign period
  const rankedCampaignCustomers = useMemo(() => {
    // Filter valid invoices (ignore cancelled and returned)
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
            name: knownCust ? knownCust.name : inv.customerName || 'Valued Patron',
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

  // Filtered by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return rankedCampaignCustomers;
    const term = (customerSearch || '').toLowerCase().trim();
    return rankedCampaignCustomers.filter(
      (c) => (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)
    );
  }, [rankedCampaignCustomers, customerSearch]);

  // Bulk Tier Selectors
  const handleSelectPreset = (topCount: number) => {
    const topPhones = rankedCampaignCustomers
      .slice(0, topCount)
      .map((c) => c.phone);
    setSelectedPhones(new Set(topPhones));
  };

  const handleSelectAll = () => {
    const allPhones = rankedCampaignCustomers.map((c) => c.phone);
    setSelectedPhones(new Set(allPhones));
  };

  const handleClearSelection = () => {
    setSelectedPhones(new Set());
  };

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

  // Unique Code Generator
  const generateAnniversaryCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ANNIV-';
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

  // Step 2 -> Step 3: Generate Coupons!
  const handleGenerateCoupons = () => {
    if (selectedPhones.size === 0) return;

    const isAutoWhatsApp = settings?.couponAutomation?.autoWhatsAppDelivery;
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
    } else if (offerType === 'custom') {
      formattedDiscountType = 'flat';
      benefitText = offerValue;
    }

    const createdList: Array<{
      phone: string;
      name: string;
      code: string;
      offerText: string;
    }> = [];

    // Selected customer objects
    const selectedList = rankedCampaignCustomers.filter((c) =>
      selectedPhones.has(c.phone)
    );

    selectedList.forEach((cust) => {
      const code = generateAnniversaryCode();

      addCustomerCoupon({
        code,
        customerPhone: cust.phone,
        customerName: cust.name,
        offerId: 'anniversary_campaign_offer',
        issueDate: issueDateStr,
        expiryDate: customExpiryDate,
        status: 'active',
        discountType: formattedDiscountType,
        discountValue: discountValNum,
        minPurchaseAmount: minPurchase,
        autoApplyOnNextVisit: true,
      });

      createdList.push({
        phone: cust.phone,
        name: cust.name,
        code,
        offerText: benefitText,
      });
    });

    setGeneratedCoupons(createdList);
    setStep(3);

    // If auto WhatsApp is ON, trigger dispatch or prompt console
    if (isAutoWhatsApp && createdList.length > 0) {
      sendWhatsAppMessage(createdList[0], 0);
    }
  };

  // Dispatch individual WhatsApp message
  const sendWhatsAppMessage = (
    item: { phone: string; name: string; code: string; offerText: string },
    index: number
  ) => {
    const storeName = settings?.storeProfile?.name || 'SMART FASHION';
    const storeLocation = settings?.storeProfile?.address || 'Milan Galleria, Manjheli, Purnia';

    const msg = `Dear *${formatMemberName(item.name)}*,

🎉 *HAPPY ANNIVERSARY CELEBRATION!*
Thank you for being one of our most valued patrons at *${storeName}*.

To mark our Showroom Anniversary, we are delighted to present you with an exclusive Anniversary Coupon:

🎫 Coupon Code: *${item.code}*
✨ Special Reward: *${item.offerText}*
💰 Minimum Purchase: ₹${minPurchase}
🗓️ Valid Until: ${customExpiryDate}

We look forward to welcoming you back to ${storeLocation}!
_Smart Fashion Concierge_`;

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

    // Also update coupon delivery log
    const nowStr =
      new Date().toLocaleDateString('en-IN') +
      ' ' +
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    setCouponDeliveryLogs((prev) => [
      {
        id: 'anniv_log_' + Math.random().toString(36).substr(2, 9),
        customerName: item.name,
        customerPhone: item.phone,
        couponCode: item.code,
        invoiceNo: 'ANNIVERSARY_CAMPAIGN',
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
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl font-bold text-amber-100">
                  🎉 Anniversary Campaign Generator
                </h2>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  ANNUAL CAMPAIGN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generate tailored anniversary reward coupons & WhatsApp campaigns for top patrons.
              </p>
            </div>
          </div>

          <button
            id="close-anniversary-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-slate-950 border-b border-slate-850 p-3 grid grid-cols-3 text-center gap-2 text-[11px] font-bold flex-shrink-0">
          <div
            className={`p-2 rounded-xl flex items-center justify-center gap-2 transition ${
              step === 1
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950/30 flex items-center justify-center font-mono">
              1
            </span>
            <span>Select Top Customers</span>
          </div>

          <div
            className={`p-2 rounded-xl flex items-center justify-center gap-2 transition ${
              step === 2
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950/30 flex items-center justify-center font-mono">
              2
            </span>
            <span>Configure Offer</span>
          </div>

          <div
            className={`p-2 rounded-xl flex items-center justify-center gap-2 transition ${
              step === 3
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950/30 flex items-center justify-center font-mono">
              3
            </span>
            <span>Dispatch & Coupons</span>
          </div>
        </div>

        {/* STEP 1: Select Customers & Campaign Period */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/60">
            {/* Campaign Period Controls */}
            <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
                    Showroom Campaign Period:
                  </span>
                </div>
                <span className="text-amber-300 font-mono text-xs">
                  {formatNiceDateRange(fromDate, toDate)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                    Campaign Start Date:
                  </label>
                  <div className="relative premium-date-container group">
                    <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                    <input
                      id="campaign-from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="peer w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-10 pr-3 text-slate-200 font-mono transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">
                    Campaign End Date:
                  </label>
                  <div className="relative premium-date-container group">
                    <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                    <input
                      id="campaign-to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="peer w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-10 pr-3 text-slate-200 font-mono transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tier Selection Shortcuts */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Quick Selection Shortcuts:
                </span>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {selectedPhones.size} Patrons Selected
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="btn-select-top-10"
                  onClick={() => handleSelectPreset(10)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  🥇 Top 10 Customers
                </button>
                <button
                  id="btn-select-top-25"
                  onClick={() => handleSelectPreset(25)}
                  className="bg-slate-300/10 hover:bg-slate-300/20 border border-slate-300/30 text-slate-200 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  🥈 Top 25 Customers
                </button>
                <button
                  id="btn-select-top-50"
                  onClick={() => handleSelectPreset(50)}
                  className="bg-amber-800/10 hover:bg-amber-800/20 border border-amber-800/30 text-amber-500 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  🥉 Top 50 Customers
                </button>
                <button
                  id="btn-select-top-100"
                  onClick={() => handleSelectPreset(100)}
                  className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  🏅 Top 100 Customers
                </button>
                <button
                  id="btn-select-all-campaign"
                  onClick={handleSelectAll}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  Select All
                </button>
                <button
                  id="btn-clear-selection-campaign"
                  onClick={handleClearSelection}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Customer List Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex justify-between items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    id="search-campaign-customers"
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search patrons by name or mobile..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400">
                  Showing {filteredCustomers.length} ranked patrons
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="p-3 text-center w-12">Select</th>
                      <th className="p-3 text-center w-14">Rank</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Mobile Number</th>
                      <th className="p-3 text-center">Bills Billed</th>
                      <th className="p-3 text-right">Total Shopping in Period</th>
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
                          <td className="p-3 font-bold text-slate-200">
                            {c.name}
                          </td>
                          <td className="p-3 font-mono text-slate-400">
                            {c.phone}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-300">
                            {c.totalBills}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-300">
                            {formatINR(c.totalShopping, { keepDecimals: true })}
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

        {/* STEP 2: Configure Offer */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/60 max-w-2xl mx-auto w-full">
            <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl space-y-4">
              <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                Configure Anniversary Reward Offer
              </h3>

              {/* Offer Type selector */}
              <div className="space-y-1.5">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Offer Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'percentage', label: 'Percentage Discount', icon: <Percent className="w-3.5 h-3.5" /> },
                    { id: 'flat', label: 'Flat Discount', icon: <Tag className="w-3.5 h-3.5" /> },
                    { id: 'voucher', label: 'Gift Voucher', icon: <Gift className="w-3.5 h-3.5" /> },
                    { id: 'free_gift', label: 'Free Gift', icon: <Award className="w-3.5 h-3.5" /> },
                    { id: 'buy_x_get_y', label: 'Buy X Get Y', icon: <Sparkles className="w-3.5 h-3.5" /> },
                    { id: 'custom', label: 'Custom Offer', icon: <Award className="w-3.5 h-3.5" /> },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      id={`btn-offer-type-${t.id}`}
                      onClick={() => setOfferType(t.id as OfferType)}
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
                  id="offer-value-input"
                  type="text"
                  value={offerValue}
                  onChange={(e) => setOfferValue(e.target.value)}
                  placeholder={
                    offerType === 'percentage'
                      ? 'e.g. 25 (for 25% OFF)'
                      : offerType === 'flat'
                      ? 'e.g. 500 (for ₹500 OFF)'
                      : 'e.g. Complimentary Silk Pocket Square'
                  }
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 text-xs font-bold"
                  required
                />
              </div>

              {/* Campaign Title */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  Campaign Title
                </label>
                <input
                  id="campaign-title-input"
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="Showroom 1st Anniversary Celebration"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 text-xs"
                />
              </div>

              {/* Minimum Purchase & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Minimum Purchase (₹)
                  </label>
                  <input
                    id="min-purchase-input"
                    type="number"
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                    Coupon Expiry Date
                  </label>
                  <div className="relative premium-date-container group">
                    <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                    <input
                      id="coupon-expiry-date-input"
                      type="date"
                      value={customExpiryDate}
                      onChange={(e) => setCustomExpiryDate(e.target.value)}
                      className="peer w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-10 pr-3 text-slate-200 font-mono text-xs transition"
                    />
                  </div>
                </div>
              </div>

              {/* Auto WhatsApp Delivery Info */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-400 block">
                    Auto WhatsApp Coupon Delivery:
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {settings?.couponAutomation?.autoWhatsAppDelivery
                      ? 'Enabled in Store Settings — messages will prepare via SmartFashionWhatsApp tab.'
                      : 'Disabled in Store Settings — coupons will be created silently in database.'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    settings?.couponAutomation?.autoWhatsAppDelivery
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {settings?.couponAutomation?.autoWhatsAppDelivery ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Dispatch & Summary */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/60">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-emerald-200">
                  Anniversary Coupons Generated Successfully!
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Created <span className="font-bold text-white">{generatedCoupons.length}</span> unique
                  anniversary coupons in system database.
                </p>
              </div>
            </div>

            {/* WhatsApp Blocked Notice */}
            {whatsappBlockedUrl && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-xl flex flex-col items-center gap-2 text-center animate-pulse">
                <span className="text-xs text-emerald-300 font-bold uppercase">
                  Browser Popup Blocked!
                </span>
                <button
                  id="btn-open-whatsapp-direct-anniversary"
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

            {/* List of Coupons Generated & Dispatch status */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-200 text-xs">
                  Generated Coupon Records ({generatedCoupons.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Sent: {sentIndexes.size} / {generatedCoupons.length}
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
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          📱 {item.phone} • {item.offerText}
                        </p>
                      </div>

                      <button
                        id={`btn-send-whatsapp-coupon-${idx}`}
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
          {step > 1 && step < 3 ? (
            <button
              id="btn-anniversary-back"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              id="btn-next-to-offer-config"
              disabled={selectedPhones.size === 0}
              onClick={() => setStep(2)}
              className="gold-gradient text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20"
            >
              <span>Generate Anniversary Offer ({selectedPhones.size})</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}

          {step === 2 && (
            <button
              id="btn-generate-coupons-submit"
              onClick={handleGenerateCoupons}
              className="gold-gradient text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-widest transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              Generate Coupons ({selectedPhones.size})
            </button>
          )}

          {step === 3 && (
            <button
              id="btn-anniversary-done"
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
