/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import {
  Trophy,
  Search,
  X,
  FileText,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Award,
  Crown,
  Medal,
  ShoppingBag,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import {
  getLocalYYYYMMDD,
  calculatePresetDates,
  formatNiceDateRange,
} from '../utils/dateFilter';

interface TopCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAnniversaryCampaign?: () => void;
}

export type RankingFilterMode =
  | 'highest-spending'
  | 'most-visits'
  | 'highest-avg-bill'
  | 'recently-active'
  | 'no-purchase-since';

export interface CustomerRankItem {
  rank: number;
  phone: string;
  name: string;
  totalBills: number;
  totalShopping: number;
  averageBill: number;
  lastPurchaseDate: string;
  tier: string;
  tierColor: string;
  tierIcon: React.ReactNode;
  allTimeShopping: number;
  allTimeBills: number;
}

export const TopCustomersModal: React.FC<TopCustomersModalProps> = ({
  isOpen,
  onClose,
  onOpenAnniversaryCampaign,
}) => {
  const { invoices, customers, settings } = useAppState();

  // Date Range state
  const [datePreset, setDatePreset] = useState<string>('last-1-year');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return getLocalYYYYMMDD(d);
  });
  const [customToDate, setCustomToDate] = useState<string>(() =>
    getLocalYYYYMMDD(new Date())
  );

  // Quick Filter Mode
  const [sortMode, setSortMode] = useState<RankingFilterMode>('highest-spending');

  // Search in ranking
  const [rankingSearch, setRankingSearch] = useState<string>('');

  // Display Limit & Pagination
  const [displayLimit, setDisplayLimit] = useState<'10' | '25' | '50' | 'all'>('10');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Compute active Date Range (From/To)
  const activeDateRange = useMemo(() => {
    const today = new Date();
    const todayStr = getLocalYYYYMMDD(today);

    if (datePreset === 'today') {
      return { fromDate: todayStr, toDate: todayStr };
    } else if (datePreset === 'this-week') {
      return calculatePresetDates('this-week');
    } else if (datePreset === 'this-month') {
      return calculatePresetDates('this-month');
    } else if (datePreset === 'last-month') {
      return calculatePresetDates('last-month');
    } else if (datePreset === 'last-3-months') {
      const past = new Date(today);
      past.setDate(today.getDate() - 90);
      return { fromDate: getLocalYYYYMMDD(past), toDate: todayStr };
    } else if (datePreset === 'last-6-months') {
      const past = new Date(today);
      past.setDate(today.getDate() - 180);
      return { fromDate: getLocalYYYYMMDD(past), toDate: todayStr };
    } else if (datePreset === 'last-1-year') {
      const past = new Date(today);
      past.setFullYear(today.getFullYear() - 1);
      return { fromDate: getLocalYYYYMMDD(past), toDate: todayStr };
    } else {
      // custom
      return {
        fromDate: customFromDate || todayStr,
        toDate: customToDate || todayStr,
      };
    }
  }, [datePreset, customFromDate, customToDate]);

  // Compute Membership Tier helper
  const getTierInfo = (totalAmount: number) => {
    if (totalAmount >= 100000) {
      return {
        tier: 'Diamond',
        tierColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        tierIcon: <Crown className="w-3 h-3 text-cyan-400 inline mr-1" />,
      };
    } else if (totalAmount >= 50000) {
      return {
        tier: 'Platinum',
        tierColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
        tierIcon: <Award className="w-3 h-3 text-purple-300 inline mr-1" />,
      };
    } else if (totalAmount >= 25000) {
      return {
        tier: 'Gold',
        tierColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        tierIcon: <Trophy className="w-3 h-3 text-amber-400 inline mr-1" />,
      };
    } else if (totalAmount >= 10000) {
      return {
        tier: 'Silver',
        tierColor: 'bg-slate-400/10 text-slate-300 border-slate-400/30',
        tierIcon: <Medal className="w-3 h-3 text-slate-300 inline mr-1" />,
      };
    } else {
      return {
        tier: 'Bronze',
        tierColor: 'bg-amber-800/10 text-amber-600 border-amber-800/30',
        tierIcon: <Medal className="w-3 h-3 text-amber-600 inline mr-1" />,
      };
    }
  };

  // Rank calculation engine
  const rankedCustomers = useMemo(() => {
    // 1. Filter out cancelled and returned invoices
    const validInvoices = invoices.filter(
      (inv) => inv.status !== 'Cancelled' && inv.status !== 'Returned'
    );

    // Map customer profile details by phone for fast lookup
    const customerMap = new Map<string, { name: string; phone: string }>();
    customers.forEach((c) => {
      if (c.phone) {
        customerMap.set(c.phone.trim(), { name: c.name, phone: c.phone.trim() });
      }
    });

    // 2. Aggregate all-time stats and period stats per customer phone
    const statsByPhone = new Map<
      string,
      {
        phone: string;
        name: string;
        periodShopping: number;
        periodBills: number;
        allTimeShopping: number;
        allTimeBills: number;
        lastPurchaseDate: string;
      }
    >();

    const { fromDate, toDate } = activeDateRange;

    validInvoices.forEach((inv) => {
      const phone = (inv.customerPhone || '').replace(/\D/g, '');
      if (!phone) return;

      const invDateStr = inv.date
        ? inv.date.includes('T')
          ? inv.date.split('T')[0]
          : inv.date.split(' ')[0]
        : '';

      const isWithinPeriod = invDateStr >= fromDate && invDateStr <= toDate;

      let entry = statsByPhone.get(phone);
      if (!entry) {
        const knownCust = customerMap.get(phone);
        entry = {
          phone,
          name: knownCust ? knownCust.name : inv.customerName || 'Valued Patron',
          periodShopping: 0,
          periodBills: 0,
          allTimeShopping: 0,
          allTimeBills: 0,
          lastPurchaseDate: invDateStr,
        };
        statsByPhone.set(phone, entry);
      }

      // Update all-time stats
      entry.allTimeShopping += inv.grandTotal || 0;
      entry.allTimeBills += 1;
      if (invDateStr > entry.lastPurchaseDate) {
        entry.lastPurchaseDate = invDateStr;
      }

      // Update period stats
      if (isWithinPeriod) {
        entry.periodShopping += inv.grandTotal || 0;
        entry.periodBills += 1;
      }
    });

    // Also include registered customers with 0 purchases if necessary
    customers.forEach((c) => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanPhone && !statsByPhone.has(cleanPhone)) {
        statsByPhone.set(cleanPhone, {
          phone: cleanPhone,
          name: c.name,
          periodShopping: 0,
          periodBills: 0,
          allTimeShopping: 0,
          allTimeBills: 0,
          lastPurchaseDate: 'No purchases yet',
        });
      }
    });

    // Convert map to array
    const rawList = Array.from(statsByPhone.values());

    // 3. Sort list based on selected quick filter
    rawList.sort((a, b) => {
      if (sortMode === 'highest-spending') {
        return b.periodShopping - a.periodShopping || b.allTimeShopping - a.allTimeShopping;
      } else if (sortMode === 'most-visits') {
        return b.periodBills - a.periodBills || b.periodShopping - a.periodShopping;
      } else if (sortMode === 'highest-avg-bill') {
        const avgA = a.periodBills > 0 ? a.periodShopping / a.periodBills : 0;
        const avgB = b.periodBills > 0 ? b.periodShopping / b.periodBills : 0;
        return avgB - avgA;
      } else if (sortMode === 'recently-active') {
        return b.lastPurchaseDate.localeCompare(a.lastPurchaseDate);
      } else if (sortMode === 'no-purchase-since') {
        return a.lastPurchaseDate.localeCompare(b.lastPurchaseDate);
      }
      return b.periodShopping - a.periodShopping;
    });

    // 4. Map into CustomerRankItem array with ranks
    const listWithRanks: CustomerRankItem[] = rawList.map((item, idx) => {
      const averageBill =
        item.periodBills > 0 ? item.periodShopping / item.periodBills : 0;

      const tierObj = getTierInfo(item.allTimeShopping);

      return {
        rank: idx + 1,
        phone: item.phone,
        name: formatMemberName(item.name),
        totalBills: item.periodBills,
        totalShopping: item.periodShopping,
        averageBill,
        lastPurchaseDate: item.lastPurchaseDate,
        tier: tierObj.tier,
        tierColor: tierObj.tierColor,
        tierIcon: tierObj.tierIcon,
        allTimeShopping: item.allTimeShopping,
        allTimeBills: item.allTimeBills,
      };
    });

    return listWithRanks;
  }, [invoices, customers, activeDateRange, sortMode]);

  // Filter ranked list by search term
  const searchedRankings = useMemo(() => {
    if (!rankingSearch.trim()) return rankedCustomers;
    const term = (rankingSearch || '').toLowerCase().trim();
    return rankedCustomers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').includes(term) ||
        (c.tier || '').toLowerCase().includes(term)
    );
  }, [rankedCustomers, rankingSearch]);

  // Apply display limit ("Top 10", "Top 25", "Top 50", or "All")
  const limitedRankings = useMemo(() => {
    if (displayLimit === '10') return searchedRankings.slice(0, 10);
    if (displayLimit === '25') return searchedRankings.slice(0, 25);
    if (displayLimit === '50') return searchedRankings.slice(0, 50);
    return searchedRankings;
  }, [searchedRankings, displayLimit]);

  // Paginated rankings if displayLimit is 'all'
  const paginatedRankings = useMemo(() => {
    if (displayLimit !== 'all') return limitedRankings;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return limitedRankings.slice(startIndex, startIndex + itemsPerPage);
  }, [limitedRankings, displayLimit, currentPage]);

  const totalPages = Math.ceil(
    (displayLimit === 'all' ? searchedRankings.length : limitedRankings.length) /
      itemsPerPage
  );

  // Total summary metrics
  const totalAnalytics = useMemo(() => {
    const count = rankedCustomers.length;
    const totalRevenue = rankedCustomers.reduce(
      (sum, c) => sum + c.totalShopping,
      0
    );
    const totalBills = rankedCustomers.reduce(
      (sum, c) => sum + c.totalBills,
      0
    );
    const avgRevenuePerCust = count > 0 ? totalRevenue / count : 0;
    return { count, totalRevenue, totalBills, avgRevenuePerCust };
  }, [rankedCustomers]);

  // Print Ranking
  const handlePrintRanking = () => {
    const storeName = settings?.storeProfile?.name || 'SMART FASHION';
    const storeAddress = settings?.storeProfile?.address || 'Milan Galleria, Manjheli, Purnia';
    const dateRangeLabel = formatNiceDateRange(
      activeDateRange.fromDate,
      activeDateRange.toDate
    );

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;

    const rowsHtml = searchedRankings
      .slice(0, 100)
      .map(
        (c) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px; text-align: center; font-weight: bold;">#${c.rank}</td>
          <td style="padding: 8px; font-weight: bold;">${c.name}</td>
          <td style="padding: 8px; font-family: 'Poppins', sans-serif;">${c.phone}</td>
          <td style="padding: 8px; text-align: center;">${c.totalBills}</td>
          <td style="padding: 8px; text-align: right; font-family: 'Poppins', sans-serif; font-weight: bold;">₹${c.totalShopping.toLocaleString('en-IN')}</td>
          <td style="padding: 8px; text-align: right; font-family: 'Poppins', sans-serif;">₹${Math.round(c.averageBill).toLocaleString('en-IN')}</td>
          <td style="padding: 8px; text-align: center;">${c.lastPurchaseDate}</td>
          <td style="padding: 8px; text-align: center;">${c.tier}</td>
        </tr>
      `
      )
      .join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Top Customers Report - ${storeName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Poppins', sans-serif; padding: 20px; color: #0f172a; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Poppins', sans-serif; font-weight: 700; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #475569; }
            .meta { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 15px; color: #334155; }
            table { width: 100%; border-collapse: collapse; font-family: 'Poppins', sans-serif; }
            th { background: #0f172a; color: #ffffff; padding: 10px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏆 ${storeName} - TOP CUSTOMER ANALYTICS</h1>
            <p>${storeAddress}</p>
          </div>
          <div class="meta">
            <span>PERIOD: ${dateRangeLabel}</span>
            <span>SORT METRIC: ${sortMode.toUpperCase().replace(/-/g, ' ')}</span>
            <span>GENERATED: ${new Date().toLocaleDateString('en-IN')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th style="text-align: left;">Customer Name</th>
                <th style="text-align: left;">Mobile</th>
                <th>Bills</th>
                <th style="text-align: right;">Total Shopping</th>
                <th style="text-align: right;">Avg Bill</th>
                <th>Last Purchase</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">
            Generated by Smart Fashion Manager Concierge System
          </div>
        </body>
      </html>
    `);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-xs overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl font-bold text-amber-100">
                  Customer Ranking & Spending Analytics
                </h2>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  PRO ANALYTICS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Comprehensive customer spending benchmarks, visit frequency & loyalty ranking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {onOpenAnniversaryCampaign && (
              <button
                id="btn-open-anniversary-campaign-from-top"
                onClick={() => {
                  onClose();
                  onOpenAnniversaryCampaign();
                }}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-amber-950/30 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                🎉 Anniversary Campaign
              </button>
            )}
            <button
              id="close-top-customers-modal"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-400 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 space-y-3 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Range Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Date Range:
              </span>
              {[
                { id: 'today', label: 'Today' },
                { id: 'this-week', label: 'This Week' },
                { id: 'this-month', label: 'This Month' },
                { id: 'last-month', label: 'Last Month' },
                { id: 'last-3-months', label: 'Last 3M' },
                { id: 'last-6-months', label: 'Last 6M' },
                { id: 'last-1-year', label: 'Last 1 Yr' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  id={`btn-date-preset-${p.id}`}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Export Ranking Action */}
            <div className="flex items-center gap-2">
              <button
                id="btn-print-ranking"
                onClick={handlePrintRanking}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Export Report
              </button>
            </div>
          </div>

          {/* Custom Date Pickers if 'custom' date preset active */}
          {datePreset === 'custom' && (
            <div className="p-3 bg-slate-900 border border-amber-500/20 rounded-xl flex flex-wrap items-center gap-4 animate-fadeIn">
              <div className="flex items-center gap-2">
                <label className="text-slate-400 font-bold uppercase text-[10px] shrink-0">
                  From Date:
                </label>
                <div className="relative premium-date-container group">
                  <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                  <input
                    id="custom-from-date-input"
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="peer bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-2 text-slate-200 text-xs focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-slate-400 font-bold uppercase text-[10px] shrink-0">
                  To Date:
                </label>
                <div className="relative premium-date-container group">
                  <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                  <input
                    id="custom-to-date-input"
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="peer bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-2 text-slate-200 text-xs focus:outline-none transition"
                  />
                </div>
              </div>

              <span className="text-[10px] text-amber-300 font-mono font-semibold">
                📅 Period: {formatNiceDateRange(activeDateRange.fromDate, activeDateRange.toDate)}
              </span>
            </div>
          )}

          {/* Quick Filter Buttons & Internal Search */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                Quick Filter:
              </span>
              {[
                { id: 'highest-spending', label: 'Highest Spending' },
                { id: 'most-visits', label: 'Most Visits' },
                { id: 'highest-avg-bill', label: 'Highest Average Bill' },
                { id: 'recently-active', label: 'Recently Active' },
                { id: 'no-purchase-since', label: 'No Purchase Since' },
              ].map((f) => (
                <button
                  key={f.id}
                  id={`btn-sort-mode-${f.id}`}
                  onClick={() => {
                    setSortMode(f.id as RankingFilterMode);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    sortMode === f.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Display Limit & Search Box */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  id="top-customers-search-input"
                  type="text"
                  value={rankingSearch}
                  onChange={(e) => {
                    setRankingSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search in rankings..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                {(['10', '25', '50', 'all'] as const).map((limit) => (
                  <button
                    key={limit}
                    id={`btn-limit-${limit}`}
                    onClick={() => {
                      setDisplayLimit(limit);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                      displayLimit === limit
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {limit === 'all' ? 'All' : `Top ${limit}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Summary Header Strip */}
        <div className="bg-slate-950 p-3 border-b border-slate-850 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] flex-shrink-0">
          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <User className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase block">
                Patrons Ranked
              </span>
              <span className="font-mono font-bold text-slate-200 text-sm">
                {totalAnalytics.count}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase block">
                Period Revenue
              </span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {formatINR(totalAnalytics.totalRevenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase block">
                Total Bills
              </span>
              <span className="font-mono font-bold text-slate-200 text-sm">
                {totalAnalytics.totalBills} invoices
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-semibold uppercase block">
                Avg Patron Value
              </span>
              <span className="font-mono font-bold text-purple-300 text-sm">
                {formatINR(totalAnalytics.avgRevenuePerCust, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/60">
          {paginatedRankings.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Trophy className="w-10 h-10 text-slate-700 mx-auto" />
              <p className="text-xs font-bold text-slate-400">
                No customer transactions found for this date range or filter.
              </p>
              <p className="text-[10px] text-slate-500">
                Try expanding the date range or clearing the search query.
              </p>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="p-3 text-center w-16">🏆 Rank</th>
                      <th className="p-3">👤 Customer Name</th>
                      <th className="p-3">📱 Mobile Number</th>
                      <th className="p-3 text-center">🧾 Total Bills</th>
                      <th className="p-3 text-right">💰 Total Shopping</th>
                      <th className="p-3 text-right">📊 Avg Bill</th>
                      <th className="p-3 text-center">📅 Last Purchase</th>
                      <th className="p-3 text-center">⭐ Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 text-xs">
                    {paginatedRankings.map((c) => {
                      const isTop3 = c.rank <= 3;
                      return (
                        <tr
                          key={c.phone}
                          className={`hover:bg-slate-900/80 transition ${
                            c.rank === 1
                              ? 'bg-amber-500/5'
                              : c.rank === 2
                              ? 'bg-slate-400/5'
                              : c.rank === 3
                              ? 'bg-amber-800/5'
                              : ''
                          }`}
                        >
                          {/* Rank Badge */}
                          <td className="p-3 text-center font-bold">
                            {c.rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20">
                                🥇 1
                              </span>
                            ) : c.rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-950 font-black text-xs shadow-md">
                                🥈 2
                              </span>
                            ) : c.rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs shadow-md">
                                🥉 3
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">
                                #{c.rank}
                              </span>
                            )}
                          </td>

                          {/* Name */}
                          <td className="p-3 font-bold text-slate-200">
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              {isTop3 && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider border border-amber-500/30">
                                  TOP VIP
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Mobile */}
                          <td className="p-3 font-mono text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {c.phone}
                            </div>
                          </td>

                          {/* Bills */}
                          <td className="p-3 text-center font-mono font-bold text-slate-300">
                            {c.totalBills}
                          </td>

                          {/* Total Shopping */}
                          <td className="p-3 text-right font-mono font-bold text-amber-300 text-sm">
                            {formatINR(c.totalShopping, { keepDecimals: true })}
                          </td>

                          {/* Average Bill */}
                          <td className="p-3 text-right font-mono text-slate-400">
                            {formatINR(c.averageBill, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>

                          {/* Last Purchase Date */}
                          <td className="p-3 text-center text-[11px] font-mono text-slate-400">
                            {c.lastPurchaseDate}
                          </td>

                          {/* Tier */}
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${c.tierColor}`}
                            >
                              {c.tierIcon}
                              {c.tier}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2 flex-shrink-0 text-slate-400 text-[11px]">
          <div>
            Showing <span className="font-bold text-slate-200">{paginatedRankings.length}</span> of{' '}
            <span className="font-bold text-slate-200">{searchedRankings.length}</span> patrons
            {displayLimit !== 'all' && ` (Filtered to Top ${displayLimit})`}
          </div>

          {displayLimit === 'all' && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                id="btn-prev-ranking-page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <button
                id="btn-next-ranking-page"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
