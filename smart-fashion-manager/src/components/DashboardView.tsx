/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppState } from '../context/StateContext';
import {
  AlertTriangle,
  ShoppingBag,
  CreditCard,
  ArrowRight,
  IndianRupee,
  Percent,
  Gift,
  BookOpen,
} from 'lucide-react';
import { calculateCreditSummary } from '../utils/creditUtils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatINR } from '../utils/currency';
import { DateTimeFilterPanel } from './DateTimeFilterPanel';
import { isWithinDateTimeRange, formatNiceDateRange, DATE_PRESETS } from '../utils/dateFilter';

interface DashboardViewProps {
  setView: (view: string) => void;
  openAiAssistant: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setView, openAiAssistant }) => {
  const {
    products,
    invoices: allInvoices,
    expenses: allExpenses,
    discountCards: allDiscountCards,
    dateFilter,
  } = useAppState();

  const { fromDate, toDate, startTime, endTime } = dateFilter;

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return formatINR(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Filter invoices based on dateFilter
  const invoices = React.useMemo(() => {
    return allInvoices.filter((inv) =>
      isWithinDateTimeRange(inv.date, fromDate, toDate, startTime, endTime)
    );
  }, [allInvoices, fromDate, toDate, startTime, endTime]);

  // Filter expenses based on dateFilter
  const expenses = React.useMemo(() => {
    return allExpenses.filter((e) =>
      isWithinDateTimeRange(e.date, fromDate, toDate, startTime, endTime)
    );
  }, [allExpenses, fromDate, toDate, startTime, endTime]);

  // Filter discount cards (Membership) based on their issueDate
  const discountCards = React.useMemo(() => {
    return allDiscountCards.filter((card) => {
      if (card.issueDate) {
        return isWithinDateTimeRange(card.issueDate, fromDate, toDate, startTime, endTime);
      }
      return true;
    });
  }, [allDiscountCards, fromDate, toDate, startTime, endTime]);

  // Calculations based on filtered lists memoized for optimal performance
  const metrics = React.useMemo(() => {
    const revenueVal = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

    let grossProfit = 0;
    invoices.forEach((inv) => {
      let invProfit = 0;
      inv.items.forEach((item) => {
        const itemCost = item.purchasePrice * item.quantity;
        const itemRev = item.sellingPrice * item.quantity;
        invProfit += (itemRev - itemCost);
      });
      grossProfit += Math.max(0, invProfit - inv.discountAmount);
    });
    const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfitVal = grossProfit - expensesTotal;

    const totalGstVal = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0);

    const membershipSalesCount = discountCards.length;
    const membershipSalesRevenue = invoices
      .filter((inv) => !!inv.discountCardNumber)
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    const giftDistributionCount = invoices.reduce((sum, inv) => {
      return sum + inv.items.filter((item) => item.isGift).reduce((s, item) => s + item.quantity, 0);
    }, 0);

    const creditInvoices = invoices.filter((inv) => inv.paymentMethod === 'credit');
    const totalCreditOutstanding = creditInvoices.reduce((sum, inv) => {
      const summary = calculateCreditSummary(inv);
      return sum + summary.balanceDue;
    }, 0);
    const overdueCreditCount = creditInvoices.reduce((cnt, inv) => {
      const summary = calculateCreditSummary(inv);
      return cnt + (summary.status === 'Overdue' ? 1 : 0);
    }, 0);

    const lowStockItems = products.filter(p => p.currentStock <= p.minStockAlert && p.status === 'active');
    const alertCount = lowStockItems.length;

    const recentTransactions = invoices.slice(0, 4);

    return {
      revenueVal,
      grossProfit,
      expensesTotal,
      netProfitVal,
      totalGstVal,
      membershipSalesCount,
      membershipSalesRevenue,
      giftDistributionCount,
      creditInvoicesCount: creditInvoices.length,
      totalCreditOutstanding,
      overdueCreditCount,
      alertCount,
      recentTransactions,
      lowStockItems,
    };
  }, [invoices, expenses, discountCards, products]);

  const {
    revenueVal,
    expensesTotal,
    netProfitVal,
    totalGstVal,
    membershipSalesCount,
    membershipSalesRevenue,
    giftDistributionCount,
    creditInvoicesCount,
    totalCreditOutstanding,
    overdueCreditCount,
    alertCount,
    recentTransactions,
  } = metrics;

  // Ensure scroll position resets to the top when navigating to Dashboard
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Compile Dynamic Chart Data based on selected period
  const chartData = React.useMemo(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Fallback if dates are invalid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [];
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const data = [];

    if (diffDays <= 1) {
      // Hourly view for 1 day
      for (let hour = 9; hour <= 21; hour++) {
        const displayHour = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
        const hourInvoices = invoices.filter((inv) => {
          const invHour = new Date(inv.date).getHours();
          return invHour === hour;
        });
        const hourSales = hourInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
        data.push({
          name: displayHour,
          Sales: Number(hourSales.toFixed(0)),
        });
      }
    } else if (diffDays <= 31) {
      // Daily view for up to 31 days
      const current = new Date(start);
      while (current <= end) {
        const dayKey = current.toISOString().split('T')[0];
        const dayLabel = current.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        const dayInvs = invoices.filter((inv) => inv.date.startsWith(dayKey));
        const daySales = dayInvs.reduce((sum, inv) => sum + inv.grandTotal, 0);
        
        data.push({
          name: dayLabel,
          Sales: Number(daySales.toFixed(0)),
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Monthly view for larger ranges
      const current = new Date(start);
      const monthsMap: Record<string, number> = {};
      while (current <= end) {
        const monthLabel = current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        monthsMap[monthLabel] = 0;
        current.setMonth(current.getMonth() + 1);
      }
      
      invoices.forEach((inv) => {
        const mLabel = new Date(inv.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        if (monthsMap[mLabel] !== undefined) {
          monthsMap[mLabel] += inv.grandTotal;
        }
      });

      Object.entries(monthsMap).forEach(([name, Sales]) => {
        data.push({
          name,
          Sales: Number(Sales.toFixed(0)),
        });
      });
    }

    return data;
  }, [fromDate, toDate, invoices]);

  return (
    <div 
      className="space-y-6 w-full max-w-full min-w-0" 
      id="dashboard-view-container"
    >
      {/* Non-sticky Filter Panel */}
      <div className="mb-4">
        <DateTimeFilterPanel title="Showroom Operations Dashboard Control" />
      </div>

      {/* Selected Range Display Banner */}
      <div 
        className="bg-slate-950/95 py-2 border-b border-slate-800/80 shadow-sm selected-ledger-bar rounded-xl" 
        id="dashboard-period-badge-wrapper"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md" id="dashboard-period-badge">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-black text-amber-500">Selected Ledger View:</span>
            <span className="text-xs font-mono font-bold text-amber-100 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 shadow-inner">
              {formatNiceDateRange(fromDate, toDate)}
            </span>
            {(dateFilter.startTime || dateFilter.endTime) && (
              <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                🕒 {dateFilter.startTime || '00:00'} → {dateFilter.endTime || '23:59'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
            <span className="text-slate-500">Preset Range:</span>
            <span className="text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 font-bold">
              {DATE_PRESETS.find(p => p.id === dateFilter.preset)?.label || 'Custom Period'}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row (6-Card Layout with Credit Ledger) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" id="metrics-grid">
        {/* Card 1: Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs text-slate-400 font-semibold uppercase tracking-wider">Revenue</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-mono font-bold text-amber-200">
              {formatCurrency(revenueVal)}
            </h3>
            <p className="text-[9px] text-slate-500 mt-1">
              Logged {invoices.length} invoices
            </p>
          </div>
        </div>

        {/* Card 2: Profit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs text-slate-400 font-semibold uppercase tracking-wider">Net Profit</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className={`text-xl md:text-2xl font-mono font-bold ${netProfitVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(netProfitVal)}
            </h3>
            <p className="text-[9px] text-slate-500 mt-1">
              After {formatCurrency(expensesTotal)} expenses
            </p>
          </div>
        </div>

        {/* Card 3: GST */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs text-slate-400 font-semibold uppercase tracking-wider">GST Billed</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-mono font-bold text-slate-100">
              {formatCurrency(totalGstVal)}
            </h3>
            <p className="text-[9px] text-slate-500 mt-1">
              On dynamic sales
            </p>
          </div>
        </div>

        {/* Card 4: Udhar Outstanding */}
        <button
          onClick={() => setView('credit-ledger')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group transition text-left cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/5 rounded-bl-full pointer-events-none group-hover:bg-rose-500/10 transition" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs text-slate-400 font-semibold uppercase tracking-wider">Credit Udhar</span>
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-mono font-bold text-rose-400">
              {formatCurrency(totalCreditOutstanding)}
            </h3>
            <p className="text-[9px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{creditInvoicesCount} Bills</span>
              {overdueCreditCount > 0 && (
                <span className="text-rose-400 font-bold bg-rose-500/10 px-1 rounded border border-rose-500/20">
                  {overdueCreditCount} Overdue
                </span>
              )}
            </p>
          </div>
        </button>

        {/* Card 5: Membership Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs text-slate-400 font-semibold uppercase tracking-wider">Memberships</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-mono font-bold text-amber-100">
              {formatCurrency(membershipSalesRevenue)}
            </h3>
            <p className="text-[9px] text-slate-500 mt-1">
              Active {membershipSalesCount} cards
            </p>
          </div>
        </div>

        {/* Card 6: Gift Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition col-span-2 md:col-span-1">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs text-slate-400 font-semibold uppercase tracking-wider">Gift Promos</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-mono font-bold text-slate-100">
              {giftDistributionCount} Items
            </h3>
            <p className="text-[9px] text-slate-500 mt-1">
              Claimed gifts
            </p>
          </div>
        </div>
      </div>

      {/* Main Graph & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-recent">
        {/* Sales Graph Card */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 space-y-4 min-w-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-100">Weekly Revenue Flow</h3>
              <p className="text-[10px] text-slate-400">Day-by-day sales metrics in INR (₹)</p>
            </div>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded font-mono font-bold uppercase">7 Days</span>
          </div>

          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  width={75}
                  tickFormatter={(val: number) => `₹${Number(val).toLocaleString('en-IN')}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#d4af37', borderRadius: '0.75rem' }}
                  labelStyle={{ color: '#d4af37', fontWeight: 'bold' }}
                  formatter={(value: any) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, 'Sales Revenue']}
                />
                <Area type="monotone" dataKey="Sales" stroke="#d4af37" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Billing Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Recent Bills</h3>
                <p className="text-[10px] text-slate-400">Newly closed POS invoices</p>
              </div>
              <button
                id="view-all-reports"
                onClick={() => setView('reports')}
                className="text-amber-500 hover:text-amber-400 text-xs font-semibold flex items-center gap-1 transition"
              >
                All <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3" id="recent-invoices-list">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No transactions logged yet.</div>
              ) : (
                recentTransactions.map((inv) => (
                  <div key={inv.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{inv.invoiceNo}</h4>
                      <p className="text-[9px] text-slate-400 mt-0.5">{inv.customerName || 'Walk-in'}</p>
                      <span className="text-[8px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded uppercase mt-1 inline-block">
                        {inv.paymentMethod}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-amber-300">
                        {formatCurrency(inv.grandTotal)}
                      </p>
                      <p className="text-[8px] text-slate-500 font-mono mt-0.5">
                        {new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button
              id="new-invoice-checkout"
              onClick={() => setView('pos')}
              className="w-full bg-slate-950 hover:bg-slate-800/80 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase py-2.5 rounded-lg tracking-wider transition flex items-center justify-center gap-2"
            >
              Open Checkout Cart
            </button>
          </div>
        </div>
      </div>

      {/* Stock Alerts Highlight (only shown if there are alerts) */}
      {alertCount > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">Procurement Action Required</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{alertCount} fashion items have fallen below safety inventory stock margins.</p>
            </div>
          </div>
          <button
            id="adjust-all-stock"
            onClick={() => setView('products')}
            className="text-[10px] bg-amber-500 text-slate-950 font-extrabold px-3 py-1.5 rounded uppercase tracking-wider transition hover:opacity-90 active:scale-95"
          >
            Review Stock In-Out
          </button>
        </div>
      )}
    </div>
  );
};
