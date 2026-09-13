/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import {
  BarChart3,
  CreditCard,
  Download,
  IndianRupee,
  FileText,
  PieChart,
  Gift,
  ShieldAlert,
  History,
  Award,
  Boxes,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { DateTimeFilterPanel } from './DateTimeFilterPanel';
import { isWithinDateTimeRange, formatNiceDateRange, DATE_PRESETS } from '../utils/dateFilter';

export const ReportsView: React.FC = () => {
  const {
    invoices: allInvoices,
    expenses: allExpenses,
    products,
    discountCards: allDiscountCards,
    membershipTypes,
    gifts: allGifts = [],
    inventoryHistory: allInventoryHistory = [],
    dateFilter,
  } = useAppState();

  const { fromDate, toDate, startTime, endTime } = dateFilter;

  // Filter invoices
  const invoices = useMemo(() => {
    return allInvoices.filter((inv) =>
      isWithinDateTimeRange(inv.date, fromDate, toDate, startTime, endTime)
    );
  }, [allInvoices, fromDate, toDate, startTime, endTime]);

  // Filter expenses
  const expenses = useMemo(() => {
    return allExpenses.filter((e) =>
      isWithinDateTimeRange(e.date, fromDate, toDate, startTime, endTime)
    );
  }, [allExpenses, fromDate, toDate, startTime, endTime]);

  // Filter discount cards (Membership) based on their issueDate
  const discountCards = useMemo(() => {
    return allDiscountCards.filter((card) => {
      if (card.issueDate) {
        return isWithinDateTimeRange(card.issueDate, fromDate, toDate, startTime, endTime);
      }
      return true;
    });
  }, [allDiscountCards, fromDate, toDate, startTime, endTime]);

  // Filter inventoryHistory
  const inventoryHistory = useMemo(() => {
    return allInventoryHistory.filter((ih) =>
      isWithinDateTimeRange(ih.date, fromDate, toDate, startTime, endTime)
    );
  }, [allInventoryHistory, fromDate, toDate, startTime, endTime]);

  // Filter gifts based on createdAt date if present
  const gifts = useMemo(() => {
    return allGifts.filter((g) => {
      if (g.createdAt) {
        return isWithinDateTimeRange(g.createdAt, fromDate, toDate, startTime, endTime);
      }
      return true;
    });
  }, [allGifts, fromDate, toDate, startTime, endTime]);

  const [reportTab, setReportTab] = useState<'sales' | 'profit' | 'gst' | 'membership' | 'gifts'>('sales');
  const [giftSubTab, setGiftSubTab] = useState<'inventory' | 'issues' | 'ledger' | 'consumption'>('inventory');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'all' | 'cash' | 'upi' | 'card' | 'credit'>('all');

  // Format Helper
  const formatCurrency = (val: number) => {
    return formatINR(val);
  };

  // Compile calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Profit breakdown
  let totalGrossProfit = 0;
  let totalPurchaseCost = 0;
  invoices.forEach((inv) => {
    let cost = 0;
    inv.items.forEach((item) => {
      cost += item.purchasePrice * item.quantity;
    });
    totalPurchaseCost += cost;
    // Gross profit on sale before expense subtract
    const invProfit = inv.grandTotal - cost;
    totalGrossProfit += Math.max(0, invProfit);
  });

  const netProfit = totalGrossProfit - totalExpenses;
  const totalGstTax = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0);

  // Category wise sales analysis
  const getCategorySalesData = () => {
    // Get unique categories from actual products or fallback to default categories with 0 values
    const uniqueCategories: string[] = Array.from(new Set(products.map((p) => p.category)));
    if (uniqueCategories.length === 0) {
      uniqueCategories.push('Suits & Blazers', 'Shirts', 'Footwear', 'Accessories');
    }

    const data: Record<string, number> = {};
    uniqueCategories.forEach((cat) => {
      data[cat] = 0;
    });

    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const matchedProd = products.find((p) => p.name === item.name || p.sku === item.sku);
        const cat: string = matchedProd
          ? matchedProd.category
          : item.name.includes('Tuxedo') || item.name.includes('Suit') || item.name.includes('Blazer')
          ? 'Suits & Blazers'
          : item.name.includes('Shirt')
          ? 'Shirts'
          : item.name.includes('Loafers') || item.name.includes('Shoes')
          ? 'Footwear'
          : 'Accessories';

        data[cat] = (data[cat] || 0) + item.total;
      });
    });

    return Object.entries(data).map(([name, value]) => ({
      name,
      Revenue: Number(value.toFixed(0)),
    }));
  };

  const categoryData = getCategorySalesData();

  // Elegant luxury colors for Category Bar Chart
  const COLORS = ['#aa7c11', '#d4af37', '#f3e5ab', '#b8860b'];

  // Excel / CSV download simulator
  const triggerExportCsv = (type: string) => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    if (type === 'sales') {
      headers = ['Invoice No', 'Date', 'Customer', 'Items Count', 'Gross Subtotal', 'Discount Applied', 'Grand Net Total', 'Payment Mode'];
      rows = invoices.map((inv) => [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString(),
        inv.customerName || 'Walk-in',
        inv.items.reduce((sum, item) => sum + item.quantity, 0),
        formatINR(inv.subtotal, { keepDecimals: true }),
        formatINR(inv.discountAmount, { keepDecimals: true }),
        formatINR(inv.grandTotal, { keepDecimals: true }),
        inv.paymentMethod.toUpperCase(),
      ]);
      filename = 'smart_fashion_sales_ledger.csv';
    } else if (type === 'profit') {
      headers = ['Transaction / Expense ID', 'Date', 'Type', 'Inbound Revenue', 'Outbound Cost / Buy Price', 'Net Surplus / Profit'];
      // Log invoices as profit, expenses as cost
      invoices.forEach((inv) => {
        let cost = 0;
        inv.items.forEach((it) => { cost += it.purchasePrice * it.quantity; });
        rows.push([
          inv.invoiceNo,
          new Date(inv.date).toLocaleDateString(),
          'POS Retail Sale',
          formatINR(inv.grandTotal, { keepDecimals: true }),
          formatINR(cost, { keepDecimals: true }),
          formatINR(inv.grandTotal - cost, { keepDecimals: true }),
        ]);
      });
      expenses.forEach((e) => {
        rows.push([
          e.id,
          new Date(e.date).toLocaleDateString(),
          `Expense (${e.category})`,
          formatINR(0, { keepDecimals: true }),
          formatINR(e.amount, { keepDecimals: true }),
          `-${formatINR(e.amount, { keepDecimals: true })}`,
        ]);
      });
      filename = 'smart_fashion_profit_and_loss_audit.csv';
    } else if (type === 'gst') {
      headers = ['Invoice No', 'Date', 'Tax Rate', 'Pre-tax Base Price', 'GST Tax Amount Billed', 'Retail checkout Gross'];
      rows = invoices.map((inv) => [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString(),
        `${inv.gstRate}%`,
        formatINR(inv.grandTotal - inv.gstAmount, { keepDecimals: true }),
        formatINR(inv.gstAmount, { keepDecimals: true }),
        formatINR(inv.grandTotal, { keepDecimals: true }),
      ]);
      filename = 'smart_fashion_gst_tax_audit.csv';
    } else if (type === 'membership') {
      headers = ['Card Number', 'Customer Name', 'Card Type/Tier', 'Status', 'Issue Date', 'Expiry Date', 'Total Discount Saved'];
      rows = discountCards.map((card) => {
        const cardInvoices = invoices.filter(inv => inv.discountCardNumber === card.cardNumber);
        const savedAmt = cardInvoices.reduce((sum, inv) => sum + (inv.discountCardDiscount || 0), 0);
        return [
          card.cardNumber,
          card.customerName,
          card.cardType.toUpperCase(),
          card.status.toUpperCase(),
          card.issueDate ? new Date(card.issueDate).toLocaleDateString() : 'N/A',
          card.expiryDate ? new Date(card.expiryDate).toLocaleDateString() : 'N/A',
          formatINR(savedAmt, { keepDecimals: true }),
        ];
      });
      filename = 'smart_fashion_membership_benefits_audit.csv';
    } else if (type === 'gifts') {
      headers = ['Gift SKU', 'Gift Name', 'Category', 'MRP', 'Promo Price', 'Current Stock', 'Status'];
      rows = gifts.map((g) => [
        g.sku,
        g.name.replace(/,/g, ''),
        g.category.replace('cat_g_', '').replace('_', ' '),
        formatINR(g.mrp, { keepDecimals: true }),
        formatINR(g.sellingPrice, { keepDecimals: true }),
        g.currentStock,
        g.status.toUpperCase(),
      ]);
      filename = 'smart_fashion_gifts_master_audit.csv';
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gift Reports compiled data and summaries
  const giftIssues = useMemo(() => {
    const issues: any[] = [];
    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        if (item.isGift) {
          issues.push({
            id: inv.id + '_' + item.productId,
            invoiceNo: inv.invoiceNo,
            date: inv.date,
            customerName: inv.customerName || 'Walk-in',
            name: item.name,
            sku: item.sku,
            price: item.sellingPrice,
            quantity: item.quantity,
            originalSellingPrice: item.originalSellingPrice || item.purchasePrice || 0,
          });
        }
      });
    });
    return issues.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices]);

  const giftLedger = useMemo(() => {
    return (inventoryHistory || [])
      .filter((ih) => ih.isGift || !!ih.giftId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inventoryHistory]);

  const giftConsumption = useMemo(() => {
    const consumptionMap: Record<string, { sku: string; category: string; totalQty: number; totalCostValue: number; totalPromoReceived: number }> = {};
    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        if (item.isGift) {
          if (!consumptionMap[item.name]) {
            consumptionMap[item.name] = {
              sku: item.sku,
              category: '',
              totalQty: 0,
              totalCostValue: 0,
              totalPromoReceived: 0,
            };
          }
          const matchedGift = gifts.find((g) => g.id === item.productId || g.name === item.name);
          consumptionMap[item.name].category = matchedGift ? matchedGift.category : 'General';
          consumptionMap[item.name].totalQty += item.quantity;
          consumptionMap[item.name].totalCostValue += (matchedGift ? matchedGift.mrp : item.originalSellingPrice || 0) * item.quantity;
          consumptionMap[item.name].totalPromoReceived += item.sellingPrice * item.quantity;
        }
      });
    });
    return Object.entries(consumptionMap).map(([name, val]) => ({
      name,
      ...val,
    }));
  }, [invoices, gifts]);

  return (
    <div className="space-y-6" id="reports-view-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100">Showroom Analytics & Reports</h1>
          <p className="text-xs text-slate-400">Review detailed financial ledgers, tax compliance accounts, and category performance.</p>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <button
            id="export-ledger-csv"
            onClick={() => triggerExportCsv(reportTab)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/20 px-4 py-2 rounded-lg text-slate-300 transition"
          >
            <Download className="w-4 h-4 text-amber-500/80" />
            Export current View to Excel / CSV
          </button>
        </div>
      </div>

      {/* Non-sticky Filter Panel */}
      <div className="mb-4">
        <DateTimeFilterPanel title="Showroom Ledger & Audit Filter Panel" />
      </div>

      {/* Sticky Selected Range Display Banner */}
      <div 
        className="sticky bg-slate-950/95 backdrop-blur-md py-3 border-b border-slate-800/80 shadow-lg" 
        id="report-period-badge-sticky-wrapper"
        style={{ position: 'sticky', top: 'var(--header-height)', zIndex: 900 }}
      >
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md" id="report-period-badge">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-black text-amber-500">Active Audit Period:</span>
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
            <span className="text-slate-500">Preset Mode:</span>
            <span className="text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 font-bold">
              {DATE_PRESETS.find(p => p.id === dateFilter.preset)?.label || 'Custom Period'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-800 gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
        {[
          { id: 'sales', label: 'Sales Reports', icon: BarChart3 },
          { id: 'profit', label: 'Profit Ledger', icon: IndianRupee },
          { id: 'gst', label: 'GST Tax Reports', icon: FileText },
          { id: 'membership', label: 'Membership Reports', icon: CreditCard },
          { id: 'gifts', label: 'Gift Reports', icon: Gift },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = reportTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`report-tab-${tab.id}`}
              onClick={() => setReportTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition select-none ${
                active
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents: SALES REPORTS */}
      {reportTab === 'sales' && (
        <div className="space-y-6">
          {/* Visual Category analysis charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 min-w-0">
              <div>
                <h3 className="font-serif text-base font-bold text-amber-100">Category Wise Revenue</h3>
                <p className="text-[10px] text-slate-400">Total dollar sales accrued per clothing department.</p>
              </div>

              <div className="h-60 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      width={70}
                      tickFormatter={(val: number) => `₹${Number(val).toLocaleString('en-IN')}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#d4af37', borderRadius: '0.75rem' }}
                      labelStyle={{ color: '#d4af37', fontWeight: 'bold' }}
                      formatter={(value: any) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, 'Revenue']}
                    />
                    <Bar dataKey="Revenue" radius={[4, 4, 0, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick statistics */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-serif text-base font-bold text-amber-100">Financial Summary</h3>
                <p className="text-[10px] text-slate-400">Consolidated balance statement.</p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-950 rounded-xl">
                    <span className="text-slate-400 text-xs font-medium">Accumulative Revenue:</span>
                    <span className="font-mono font-bold text-amber-300 text-sm">{formatCurrency(totalRevenue)}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-950 rounded-xl">
                    <span className="text-slate-400 text-xs font-medium">Showroom Expenses:</span>
                    <span className="font-mono font-bold text-slate-300 text-sm">{formatCurrency(totalExpenses)}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-950 rounded-xl">
                    <span className="text-slate-400 text-xs font-medium">GST Collected:</span>
                    <span className="font-mono font-bold text-slate-300 text-sm">{formatCurrency(totalGstTax)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Net Liquid Surplus:</span>
                  <h4 className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{formatCurrency(netProfit)}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Sales Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-sm font-bold text-amber-100">Closed Sales Ledger Invoices</h3>
                <p className="text-[10px] text-slate-400">Complete list of registered POS showroom invoices.</p>
              </div>

              {/* Payment Mode Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'cash', 'upi', 'card', 'credit'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentModeFilter(mode)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer border ${
                      paymentModeFilter === mode
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {mode === 'credit' ? 'Credit (Udhar)' : mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer Phone</th>
                    <th className="p-3 text-right font-mono">Gross Basket</th>
                    <th className="p-3 text-right font-mono">Discounts</th>
                    <th className="p-3 text-right font-mono">G.S.T Tax</th>
                    <th className="p-3 text-right font-mono">Grand Total</th>
                    <th className="p-3 text-center">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(() => {
                    const displayInvs = paymentModeFilter === 'all'
                      ? invoices
                      : invoices.filter((i) => i.paymentMethod === paymentModeFilter);

                    if (displayInvs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-500">No invoices found for this payment mode.</td>
                        </tr>
                      );
                    }

                    return displayInvs.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/10">
                        <td className="p-3 font-bold text-slate-200">{inv.invoiceNo}</td>
                        <td className="p-3 text-slate-500 font-mono">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="p-3 font-mono text-slate-300">{inv.customerPhone || 'Walk-in'}</td>
                        <td className="p-3 text-right font-mono text-slate-400">{formatINR(inv.subtotal, { keepDecimals: true })}</td>
                        <td className="p-3 text-right font-mono text-red-400">-{formatINR(inv.discountAmount, { keepDecimals: true })}</td>
                        <td className="p-3 text-right font-mono text-slate-400">{formatINR(inv.gstAmount, { keepDecimals: true })}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-200">{formatINR(inv.grandTotal, { keepDecimals: true })}</td>
                        <td className="p-3 text-center uppercase whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider border ${
                            inv.paymentMethod === 'credit'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold'
                              : 'bg-slate-950 text-slate-400 border-slate-850'
                          }`}>
                            {inv.paymentMethod === 'credit' ? 'Credit (Udhar)' : inv.paymentMethod}
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: PROFIT AND LOSS */}
      {reportTab === 'profit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Inbound Revenue</span>
              <h3 className="text-2xl font-mono font-bold text-emerald-400 mt-1">{formatCurrency(totalRevenue)}</h3>
              <p className="text-[9px] text-slate-500 mt-2">Accrued from showroom POS checkouts.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Wholesale Buy Cost</span>
              <h3 className="text-2xl font-mono font-bold text-amber-500 mt-1">{formatCurrency(totalPurchaseCost)}</h3>
              <p className="text-[9px] text-slate-500 mt-2">Total procurement cost of sold items.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Operating Expenses</span>
              <h3 className="text-2xl font-mono font-bold text-red-400 mt-1">{formatCurrency(totalExpenses)}</h3>
              <p className="text-[9px] text-slate-500 mt-2">Electricity, rent, stylist staff payouts.</p>
            </div>
          </div>

          {/* Profit analysis table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800">
              <h3 className="font-serif text-sm font-bold text-amber-100">Bespoke Showroom Profit Breakdown</h3>
              <p className="text-[10px] text-slate-400">Line item surplus analysis after subtract of material cost.</p>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="p-3">Reference No</th>
                    <th className="p-3">Billed Date</th>
                    <th className="p-3">Items Count</th>
                    <th className="p-3 text-right font-mono">Total Sales Retails (₹)</th>
                    <th className="p-3 text-right font-mono">Wholesale Buying Cost (₹)</th>
                    <th className="p-3 text-right font-mono">Net Surplus Surplus (₹)</th>
                    <th className="p-3 text-center">Profit Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">No logs for margins.</td>
                    </tr>
                  ) : (
                    invoices.map((inv) => {
                      let cost = 0;
                      inv.items.forEach((it) => { cost += it.purchasePrice * it.quantity; });
                      const surplus = inv.grandTotal - cost;
                      const marginRate = inv.grandTotal > 0 ? (surplus / inv.grandTotal) * 100 : 0;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/10">
                          <td className="p-3 font-bold text-slate-200">{inv.invoiceNo}</td>
                          <td className="p-3 text-slate-500 font-mono">{new Date(inv.date).toLocaleDateString()}</td>
                          <td className="p-3 text-slate-300 font-mono">{inv.items.reduce((sum, it) => sum + it.quantity, 0)} items</td>
                          <td className="p-3 text-right font-mono font-medium text-slate-400">{formatINR(inv.grandTotal, { keepDecimals: true })}</td>
                          <td className="p-3 text-right font-mono text-slate-400">{formatINR(cost, { keepDecimals: true })}</td>
                          <td className={`p-3 text-right font-mono font-bold ${surplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatINR(surplus, { keepDecimals: true })}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${marginRate >= 40 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {marginRate.toFixed(0)}%
                            </span>
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

      {/* Tab Contents: GST AUDIT */}
      {reportTab === 'gst' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-100">Cumulative GST Tax Ledger</h3>
              <p className="text-[10px] text-slate-400">Summary of tax amounts collected under store compliance profiles.</p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center">
              <span className="text-[9px] text-slate-500 uppercase font-semibold">Total GST Collected:</span>
              <h3 className="text-xl font-mono font-bold text-amber-300 mt-1">{formatCurrency(totalGstTax)}</h3>
            </div>
          </div>

          {/* GST table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800">
              <h3 className="font-serif text-sm font-bold text-amber-100">Tax Audited POS Bills</h3>
              <p className="text-[10px] text-slate-400">Log of tax breakdown per retail transaction.</p>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="p-3">Invoice Code</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-center font-mono">Tax Rate</th>
                    <th className="p-3 text-right font-mono">Taxable Base Amount (₹)</th>
                    <th className="p-3 text-right font-mono">GST Billed (₹)</th>
                    <th className="p-3 text-right font-mono">Invoice Gross (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">No GST transactions found.</td>
                    </tr>
                  ) : (
                    invoices.map((inv) => {
                      const baseAmt = inv.grandTotal - inv.gstAmount;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/10">
                          <td className="p-3 font-bold text-slate-200">{inv.invoiceNo}</td>
                          <td className="p-3 text-slate-500 font-mono">{new Date(inv.date).toLocaleDateString()}</td>
                          <td className="p-3 text-center font-mono text-slate-300">{inv.gstRate}%</td>
                          <td className="p-3 text-right font-mono text-slate-400">{formatINR(baseAmt, { keepDecimals: true })}</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400">{formatINR(inv.gstAmount, { keepDecimals: true })}</td>
                          <td className="p-3 text-right font-mono text-slate-200">{formatINR(inv.grandTotal, { keepDecimals: true })}</td>
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

      {/* Tab Contents: MEMBERSHIP BENEFITS REPORTS */}
      {reportTab === 'membership' && (() => {
        // Calculations
        const totalMembershipDiscount = invoices.reduce((sum, inv) => sum + (inv.discountCardDiscount || 0), 0);

        const now = new Date();
        const thisMonthInvoices = invoices.filter(inv => {
          const d = new Date(inv.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthlyMembershipSavings = thisMonthInvoices.reduce((sum, inv) => sum + (inv.discountCardDiscount || 0), 0);

        const silverCount = discountCards.filter(c => c.cardType && c.cardType.toLowerCase() === 'silver').length;
        const goldCount = discountCards.filter(c => c.cardType && c.cardType.toLowerCase() === 'gold').length;
        const vipCount = discountCards.filter(c => c.cardType && (c.cardType.toLowerCase() === 'platinum' || c.cardType.toLowerCase() === 'vip')).length;

        const memberSavingsMap: Record<string, { name: string, cardNo: string, tier: string, saved: number, visits: number }> = {};
        invoices.forEach(inv => {
          if (inv.discountCardNumber && inv.discountCardDiscount && inv.discountCardDiscount > 0) {
            const cardNo = inv.discountCardNumber;
            if (!memberSavingsMap[cardNo]) {
              const cardObj = discountCards.find(c => c.cardNumber === cardNo);
              memberSavingsMap[cardNo] = {
                name: inv.customerName || cardObj?.customerName || 'Unknown Member',
                cardNo: cardNo,
                tier: cardObj?.cardType || 'Member',
                saved: 0,
                visits: 0,
              };
            }
            memberSavingsMap[cardNo].saved += inv.discountCardDiscount;
            memberSavingsMap[cardNo].visits += 1;
          }
        });
        const topMembers = Object.values(memberSavingsMap).sort((a, b) => b.saved - a.saved).slice(0, 5);

        const expiredMembers = discountCards.filter(c => c.status === 'blocked' || c.status === 'expired' || (c.expiryDate && new Date(c.expiryDate) < new Date()));

        return (
          <div className="space-y-6">
            {/* Cards widgets stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Benefit Savings Given</span>
                <h3 className="text-2xl font-mono font-bold text-amber-300 mt-1">{formatCurrency(totalMembershipDiscount)}</h3>
                <p className="text-[9px] text-slate-500 mt-2">Aggregate discount value applied across all card scans.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Current Month Savings</span>
                <h3 className="text-2xl font-mono font-bold text-amber-300 mt-1">{formatCurrency(monthlyMembershipSavings)}</h3>
                <p className="text-[9px] text-slate-500 mt-2">Card discount savings recorded this current month.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Patron Tiers Active</span>
                <div className="flex gap-4 mt-2.5 font-mono text-xs">
                  <div>
                    <span className="block text-[9px] text-slate-500">SILVER</span>
                    <span className="font-extrabold text-slate-300">{silverCount}</span>
                  </div>
                  <div className="border-l border-slate-800 pl-4">
                    <span className="block text-[9px] text-slate-500">GOLD</span>
                    <span className="font-extrabold text-amber-400">{goldCount}</span>
                  </div>
                  <div className="border-l border-slate-800 pl-4">
                    <span className="block text-[9px] text-slate-500">PLATINUM</span>
                    <span className="font-extrabold text-amber-500">{vipCount}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Expired / Blocked Cards</span>
                <h3 className="text-2xl font-mono font-bold text-red-400 mt-1">{expiredMembers.length}</h3>
                <p className="text-[9px] text-slate-500 mt-2">Cards currently expired or blocked by managers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Members Saved Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800">
                  <h3 className="font-serif text-sm font-bold text-amber-100">Top Saved Patron Members</h3>
                  <p className="text-[10px] text-slate-400">Patrons driving high-volume showroom membership savings.</p>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-3">Customer Name</th>
                        <th className="p-3 font-mono">Card No</th>
                        <th className="p-3">Tier</th>
                        <th className="p-3 text-right font-mono">Visits</th>
                        <th className="p-3 text-right font-mono">Total Saved (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                      {topMembers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center font-sans text-slate-500 italic">No savings recorded yet.</td>
                        </tr>
                      ) : (
                        topMembers.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-850/20">
                            <td className="p-3 font-sans font-semibold text-slate-200">{formatMemberName(m.name)}</td>
                            <td className="p-3 text-slate-400">{m.cardNo}</td>
                            <td className="p-3 uppercase text-amber-400 font-bold">{m.tier}</td>
                            <td className="p-3 text-right">{m.visits}</td>
                            <td className="p-3 text-right font-extrabold text-emerald-400">{formatINR(m.saved, { keepDecimals: true })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expired/Blocked Cards Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800">
                  <h3 className="font-serif text-sm font-bold text-amber-100">Card Auditing & Warnings</h3>
                  <p className="text-[10px] text-slate-400">List of expired, blocked, or invalid client membership cards.</p>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-3">Client Cardholder</th>
                        <th className="p-3 font-mono">Card Number</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                      {expiredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center font-sans text-slate-500 italic">No expired or blocked cards in records.</td>
                        </tr>
                      ) : (
                        expiredMembers.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-850/20">
                            <td className="p-3 font-sans font-semibold text-slate-200">{formatMemberName(c.customerName)}</td>
                            <td className="p-3 text-slate-400">{c.cardNumber}</td>
                            <td className="p-3 uppercase text-amber-500 font-bold">{c.cardType}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                                c.status === 'blocked'
                                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              }`}>
                                {c.status ? c.status.toUpperCase() : 'EXPIRED'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tab Contents: GIFT REPORTS */}
      {reportTab === 'gifts' && (() => {
        // Calculations for Gift Summary KPI Metrics
        const totalGiftConfigs = gifts.length;
        const totalActiveGifts = gifts.filter(g => g.status === 'active').length;
        const totalGiftsIssued = giftIssues.reduce((sum, item) => sum + item.quantity, 0);
        const lowStockGifts = gifts.filter(g => g.status === 'active' && g.currentStock <= 5).length;
        const outOfStockGifts = gifts.filter(g => g.currentStock === 0).length;

        return (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/20 transition">
                <div className="absolute right-4 top-4 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Gift className="w-4 h-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Gifts Configured</span>
                <h3 className="text-2xl font-mono font-extrabold text-amber-100 mt-1">{totalGiftConfigs}</h3>
                <p className="text-[9px] text-slate-400 mt-2">Active: <span className="font-mono text-emerald-400">{totalActiveGifts}</span> | Inactive: <span className="font-mono text-slate-500">{totalGiftConfigs - totalActiveGifts}</span></p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/20 transition">
                <div className="absolute right-4 top-4 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Award className="w-4 h-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Gifts Issued</span>
                <h3 className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">{totalGiftsIssued}</h3>
                <p className="text-[9px] text-slate-400 mt-2">Distributed via POS campaigns</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/20 transition">
                <div className="absolute right-4 top-4 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Low Stock Warning</span>
                <h3 className="text-2xl font-mono font-extrabold text-amber-400 mt-1">{lowStockGifts}</h3>
                <p className="text-[9px] text-slate-400 mt-2">Active gifts with &le; 5 units on hand</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-red-500/20 transition">
                <div className="absolute right-4 top-4 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                  <Boxes className="w-4 h-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Out of Stock</span>
                <h3 className="text-2xl font-mono font-extrabold text-red-400 mt-1">{outOfStockGifts}</h3>
                <p className="text-[9px] text-slate-400 mt-2">Currently zero stock on hand</p>
              </div>
            </div>

            {/* Sub-Tabs Row */}
            <div className="flex border-b border-slate-800/60 gap-4 text-xs font-semibold overflow-x-auto whitespace-nowrap scrollbar-none">
              {[
                { id: 'inventory', label: 'Current Gift Inventory', icon: Boxes },
                { id: 'issues', label: 'Gift Issue Report', icon: Award },
                { id: 'ledger', label: 'Stock Ledger History', icon: History },
                { id: 'consumption', label: 'Consumption Analytics', icon: PieChart },
              ].map((sub) => {
                const Icon = sub.icon;
                const active = giftSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setGiftSubTab(sub.id as any)}
                    className={`flex items-center gap-2 py-2 px-1 text-[11px] font-bold uppercase tracking-wider border-b-2 transition select-none ${
                      active
                        ? 'border-amber-500/60 text-amber-300'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB CONTENTS: CURRENT GIFT INVENTORY */}
            {giftSubTab === 'inventory' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-serif text-sm font-bold text-amber-100">Live Gift Inventory Catalog</h3>
                    <p className="text-[10px] text-slate-400">Inventory counts, categories, and pricing configured in Gifts Master.</p>
                  </div>
                  <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded uppercase">
                    Count: {gifts.length} Items
                  </span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Gift Item Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right font-mono">MRP</th>
                        <th className="p-3 text-right font-mono">Promo Price</th>
                        <th className="p-3 text-center font-mono">Current Stock</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                      {gifts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center font-sans text-slate-500 italic">No gifts found in the system. Create some in Gifts Master first.</td>
                        </tr>
                      ) : (
                        gifts.map((g) => {
                          const isLow = g.currentStock <= 5 && g.currentStock > 0;
                          const isOut = g.currentStock === 0;
                          return (
                            <tr key={g.id} className="hover:bg-slate-850/20">
                              <td className="p-3 text-amber-500/80 font-bold">{g.sku}</td>
                              <td className="p-3 font-sans font-bold text-slate-200">
                                <div className="flex items-center gap-2">
                                  {g.imageUrl ? (
                                    <img src={g.imageUrl} alt={g.name} referrerPolicy="no-referrer" className="w-6 h-6 rounded bg-slate-950 object-cover border border-slate-800" />
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                                      <Gift className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                  <span>{g.name}</span>
                                </div>
                              </td>
                              <td className="p-3 font-sans text-slate-400 capitalize">
                                {g.category.replace('cat_g_', '').replace('_', ' ').replace('-', ' ')}
                              </td>
                              <td className="p-3 text-right text-slate-400">{formatINR(g.mrp)}</td>
                              <td className="p-3 text-right text-emerald-400 font-bold">{formatINR(g.sellingPrice)}</td>
                              <td className="p-3 text-center">
                                <span className={`font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-100'}`}>
                                  {g.currentStock}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                                  g.status === 'inactive'
                                    ? 'bg-slate-800 border-slate-750 text-slate-500'
                                    : isOut
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : isLow
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                }`}>
                                  {g.status === 'inactive' ? 'INACTIVE' : isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'ACTIVE'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB CONTENTS: GIFT ISSUES REPORT */}
            {giftSubTab === 'issues' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-serif text-sm font-bold text-amber-100">POS Gift Disbursement Register</h3>
                    <p className="text-[10px] text-slate-400">Detailed logs of promotional gifts issued to customers at checkout.</p>
                  </div>
                  <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded uppercase">
                    Total Issued: {giftIssues.length} Times
                  </span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Gift Item Issued</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Promo Price</th>
                        <th className="p-3 text-right">Saved Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                      {giftIssues.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center font-sans text-slate-500 italic">No gifts have been issued through POS transactions yet.</td>
                        </tr>
                      ) : (
                        giftIssues.map((issue) => {
                          const savedValue = Math.max(0, (issue.originalSellingPrice - issue.price) * issue.quantity);
                          return (
                            <tr key={issue.id} className="hover:bg-slate-850/20">
                              <td className="p-3 font-bold text-slate-200">{issue.invoiceNo}</td>
                              <td className="p-3 text-slate-500">{new Date(issue.date).toLocaleDateString()}</td>
                              <td className="p-3 font-sans text-slate-300">{formatMemberName(issue.customerName)}</td>
                              <td className="p-3 font-sans font-semibold text-amber-300 flex items-center gap-1.5">
                                <Gift className="w-3 h-3 text-amber-400" /> {issue.name}
                              </td>
                              <td className="p-3 text-slate-400">{issue.sku}</td>
                              <td className="p-3 text-right font-bold text-slate-100">{issue.quantity}</td>
                              <td className="p-3 text-right text-emerald-400">
                                {issue.price === 0 ? <span className="text-amber-500 text-[10px] font-bold">FREE (₹0)</span> : formatINR(issue.price)}
                              </td>
                              <td className="p-3 text-right text-emerald-400 font-bold">
                                {formatINR(savedValue)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB CONTENTS: STOCK LEDGER HISTORY */}
            {giftSubTab === 'ledger' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800">
                  <h3 className="font-serif text-sm font-bold text-amber-100">Gifts Stock Ledger History</h3>
                  <p className="text-[10px] text-slate-400">Chronological stock log audits including initial imports, POS GWP deductions, and custom stock corrections.</p>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-3">Date & Time</th>
                        <th className="p-3">Gift Name</th>
                        <th className="p-3 text-center">Type</th>
                        <th className="p-3 text-right">Quantity</th>
                        <th className="p-3">Reason / Description</th>
                        <th className="p-3 text-center">Stock Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                      {giftLedger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center font-sans text-slate-500 italic">No stock adjustments logged for gifts. Adjust stock in Gifts Master to see history.</td>
                        </tr>
                      ) : (
                        giftLedger.map((log) => {
                          const isNegative = log.quantity < 0;
                          return (
                            <tr key={log.id} className="hover:bg-slate-850/20">
                              <td className="p-3 text-slate-500">
                                {new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="p-3 font-sans font-bold text-slate-200">
                                {log.productName || log.giftName}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  log.type === 'stock-in'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : log.type === 'stock-out'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {log.type}
                                </span>
                              </td>
                              <td className={`p-3 text-right font-extrabold ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                                {isNegative ? '' : '+'}{log.quantity}
                              </td>
                              <td className="p-3 font-sans text-slate-400 text-xs">
                                {log.reason}
                              </td>
                              <td className="p-3 text-center text-slate-500 font-bold">
                                <span className="text-slate-400">{log.prevStock}</span>
                                <span className="mx-1 text-slate-600">&rarr;</span>
                                <span className="text-amber-300">{log.nextStock}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB CONTENTS: CONSUMPTION ANALYTICS */}
            {giftSubTab === 'consumption' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Statistics Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 bg-slate-950/40 border-b border-slate-800">
                    <h3 className="font-serif text-sm font-bold text-amber-100">Top Performing Promotional Gifts</h3>
                    <p className="text-[10px] text-slate-400">Total consumption volume and promotional campaign value delivered.</p>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          <th className="p-3">Gift Item</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3 text-center font-mono">Qty Issued</th>
                          <th className="p-3 text-right font-mono">Value Delivered</th>
                          <th className="p-3 text-right font-mono">Revenue Contrib</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                        {giftConsumption.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center font-sans text-slate-500 italic">No consumption records recorded.</td>
                          </tr>
                        ) : (
                          giftConsumption
                            .sort((a, b) => b.totalQty - a.totalQty)
                            .map((c, idx) => (
                              <tr key={idx} className="hover:bg-slate-850/20">
                                <td className="p-3 font-sans font-semibold text-slate-200">{c.name}</td>
                                <td className="p-3 text-slate-400">{c.sku}</td>
                                <td className="p-3 text-center font-bold text-amber-400">{c.totalQty}</td>
                                <td className="p-3 text-right font-extrabold text-emerald-400">{formatINR(c.totalCostValue)}</td>
                                <td className="p-3 text-right font-medium text-slate-400">{formatINR(c.totalPromoReceived)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Consumption Visual Progress Bars */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif text-sm font-bold text-amber-100">Visual Campaign Consumption</h3>
                    <p className="text-[10px] text-slate-400 mb-4">Relative share of total issued items across campaign inventories.</p>

                    {giftConsumption.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 italic">
                        No gift campaign data available to plot.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          const maxQty = Math.max(...giftConsumption.map(c => c.totalQty), 1);
                          return giftConsumption.map((c, idx) => {
                            const pct = (c.totalQty / maxQty) * 100;
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="font-sans font-bold text-slate-300">{c.name}</span>
                                  <span className="font-mono text-amber-400">{c.totalQty} issued</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
                                  <div
                                    className="bg-amber-500 h-full rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl mt-4">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Total Gift Campaign Savings Passed to Patrons:</span>
                    <h4 className="text-lg font-mono font-bold text-emerald-400 mt-1 font-sans">
                      {formatINR(giftIssues.reduce((sum, issue) => sum + Math.max(0, (issue.originalSellingPrice - issue.price) * issue.quantity), 0))}
                    </h4>
                    <p className="text-[9px] text-slate-500 mt-1">Calculated as (MRP - Promo Price Paid) per issued gift item.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
