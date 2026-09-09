/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import { useShortcuts } from '../context/ShortcutContext';
import { useDebounce } from '../hooks/useDebounce';
import {
  BookOpen,
  Search,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  User,
  Phone,
  FileText,
  PlusCircle,
  TrendingDown,
  X,
  IndianRupee,
  ArrowLeft,
} from 'lucide-react';
import { Invoice } from '../types';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { calculateCreditSummary, CreditInvoiceSummary } from '../utils/creditUtils';
import { DuplicateCustomerModal } from './common/DuplicateCustomerModal';

export const CreditLedgerView: React.FC = () => {
  const { settings, invoices, recordCreditPayment, markCreditInvoiceAsPaid, addCustomer, findCustomerByPhone } = useAppState();
  const { showToast } = useShortcuts();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Unpaid' | 'Partially Paid' | 'Overdue' | 'Paid'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'overdue' | 'dueThisWeek'>('all');

  // Report Preview State
  const [printMode, setPrintMode] = useState<'summary' | 'customer'>('summary');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);

  const handleViewLedgerReport = () => {
    try {
      if (filteredCalculatedInvoices.length === 0) {
        showToast?.('No ledger records available for the selected filters.', 'error');
        return;
      }
      setPrintMode('summary');
      setReportPreviewOpen(true);
    } catch (err) {
      showToast?.('Failed to open ledger report preview.', 'error');
    }
  };

  const handleViewCustomerStatement = (phone: string, name: string) => {
    try {
      const custInvoices = creditInvoices.filter((inv) => inv.customerPhone === phone);
      if (custInvoices.length === 0) {
        showToast?.('No ledger records available for this customer.', 'error');
        return;
      }
      setCustomerHistoryModal({ phone, name });
      setPrintMode('customer');
      setReportPreviewOpen(true);
    } catch (err) {
      showToast?.('Failed to open customer statement preview.', 'error');
    }
  };

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewInvoiceModal, setViewInvoiceModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [customerHistoryModal, setCustomerHistoryModal] = useState<{ phone: string; name: string } | null>(null);

  // New Credit Customer State
  const [newCreditCustModalOpen, setNewCreditCustModalOpen] = useState(false);
  const [creditCustName, setCreditCustName] = useState('');
  const [creditCustPhone, setCreditCustPhone] = useState('');
  const [creditCustNotes, setCreditCustNotes] = useState('');
  const [creditDuplicateModal, setCreditDuplicateModal] = useState<{
    isOpen: boolean;
    existingCustomer: any;
  }>({ isOpen: false, existingCustomer: null });

  const handleCreateCreditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = creditCustPhone.replace(/\D/g, '');
    if (!creditCustName.trim() || cleanPhone.length < 7) {
      showToast?.('Please enter a valid customer name and mobile number (min 7 digits).', 'error');
      return;
    }

    const existing = findCustomerByPhone(cleanPhone);
    if (existing) {
      setCreditDuplicateModal({
        isOpen: true,
        existingCustomer: existing,
      });
      return;
    }

    addCustomer(creditCustName.trim(), cleanPhone, creditCustNotes.trim() || 'Udhar Credit Account Established');
    showToast?.(`Credit Customer Profile established for ${creditCustName}`, 'success');
    setNewCreditCustModalOpen(false);
    setCreditCustName('');
    setCreditCustPhone('');
    setCreditCustNotes('');
  };

  const handleOpenExistingCreditCustomer = (cust: any) => {
    setCreditDuplicateModal({ isOpen: false, existingCustomer: null });
    setNewCreditCustModalOpen(false);
    setCustomerHistoryModal({ phone: cust.phone, name: cust.name });
  };

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Get all credit invoices
  const creditInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.paymentMethod === 'credit');
  }, [invoices]);

  // Compute summaries for all credit invoices
  const calculatedInvoices = useMemo(() => {
    return creditInvoices.map((inv) => {
      const summary = calculateCreditSummary(inv);
      return {
        invoice: inv,
        summary,
      };
    });
  }, [creditInvoices]);

  // KPI Metrics
  const kpiData = useMemo(() => {
    let totalOutstanding = 0;
    let totalCollected = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let totalCreditVolume = 0;

    calculatedInvoices.forEach(({ invoice, summary }) => {
      totalCreditVolume += summary.totalAmount;
      totalOutstanding += summary.balanceDue;
      totalCollected += summary.paidAmount;
      if (summary.status === 'Overdue') {
        overdueCount += 1;
        overdueAmount += summary.balanceDue;
      }
    });

    return {
      totalCreditVolume,
      totalOutstanding,
      totalCollected,
      overdueCount,
      overdueAmount,
      totalCount: calculatedInvoices.length,
    };
  }, [calculatedInvoices]);

  // Filtered invoices
  const filteredCalculatedInvoices = useMemo(() => {
    return calculatedInvoices.filter(({ invoice, summary }) => {
      // Status filter
      if (statusFilter !== 'all' && summary.status !== statusFilter) {
        return false;
      }

      // Time filter
      if (timeFilter === 'overdue' && summary.status !== 'Overdue') {
        return false;
      }
      if (timeFilter === 'dueThisWeek') {
        if (summary.daysRemaining < 0 || summary.daysRemaining > 7 || summary.status === 'Paid') {
          return false;
        }
      }

      // Search term
      if (debouncedSearchTerm.trim()) {
        const term = (debouncedSearchTerm || '').toLowerCase().trim();
        const invNo = (invoice.invoiceNo || '').toLowerCase();
        const custName = (invoice.customerName || '').toLowerCase();
        const custPhone = (invoice.customerPhone || '').toLowerCase();
        return invNo.includes(term) || custName.includes(term) || custPhone.includes(term);
      }

      return true;
    });
  }, [calculatedInvoices, statusFilter, timeFilter, debouncedSearchTerm]);

  // Filtered Summary KPI Metrics for Ledger Report
  const filteredKpi = useMemo(() => {
    let totalCreditSales = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let overdueAmount = 0;
    const uniqueCustomers = new Set<string>();

    filteredCalculatedInvoices.forEach(({ invoice, summary }) => {
      totalCreditSales += summary.totalAmount;
      totalCollected += summary.paidAmount;
      totalOutstanding += summary.balanceDue;
      if (summary.status === 'Overdue') {
        overdueAmount += summary.balanceDue;
      }
      const custKey = invoice.customerPhone || invoice.customerName || 'Walk-in Client';
      uniqueCustomers.add(custKey);
    });

    return {
      totalCreditSales,
      totalCollected,
      totalOutstanding,
      overdueAmount,
      customerCount: uniqueCustomers.size,
      invoiceCount: filteredCalculatedInvoices.length,
    };
  }, [filteredCalculatedInvoices]);

  // Open Receive Payment Modal
  const handleOpenPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    const summary = calculateCreditSummary(inv);
    setPaymentAmount(summary.balanceDue.toString());
    setPaymentMode('cash');
    setPaymentNotes('Partial Payment');
    setPaymentModal(true);
  };

  // Submit Receive Payment
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast?.('Please enter a valid payment amount.', 'error');
      return;
    }

    const summary = calculateCreditSummary(selectedInvoice);
    if (amount > summary.balanceDue + 0.01) {
      showToast?.(`Amount exceeds remaining balance due (${formatINR(summary.balanceDue)}).`, 'error');
      return;
    }

    recordCreditPayment(selectedInvoice.id, amount, paymentMode, paymentNotes.trim() || undefined);
    showToast?.(`Payment of ${formatINR(amount)} recorded successfully!`, 'success');
    setPaymentModal(false);
    setSelectedInvoice(null);
  };

  // One-click Mark as Paid
  const handleMarkAsPaid = (inv: Invoice) => {
    const summary = calculateCreditSummary(inv);
    if (summary.balanceDue <= 0) {
      showToast?.('Invoice is already fully paid.', 'info');
      return;
    }
    if (confirm(`Mark Invoice ${inv.invoiceNo} as Paid in Full (${formatINR(summary.balanceDue)})?`)) {
      markCreditInvoiceAsPaid(inv.id, 'cash', 'Marked as paid in full');
      showToast?.(`Invoice ${inv.invoiceNo} marked as Paid in Full!`, 'success');
    }
  };

  // Helper for Status Badge styling
  const renderStatusBadge = (status: CreditInvoiceSummary['status']) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> Paid
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Partially Paid
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
            <AlertCircle className="w-3 h-3 text-rose-400" /> Overdue
          </span>
        );
      case 'Unpaid':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3" /> Unpaid
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg gold-gradient text-slate-950 font-bold shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-amber-100 tracking-wide">
                Credit Ledger (Udhar Management)
              </h1>
              <p className="text-xs text-slate-400">
                Monitor credit sales, track overdue invoices, receive partial payments, and manage customer credit balances.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewCreditCustModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg gold-gradient text-slate-950 text-xs font-bold uppercase tracking-wider shadow-md hover:brightness-110 transition"
          >
            <PlusCircle className="w-4 h-4" /> Add Credit Customer
          </button>
          <button
            onClick={handleViewLedgerReport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:border-amber-500/40 hover:text-amber-400 transition"
          >
            <FileText className="w-4 h-4 text-amber-400" /> View Ledger Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Outstanding</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-mono font-bold text-rose-400">{formatINR(kpiData.totalOutstanding)}</div>
            <p className="text-[10px] text-slate-500 mt-1">Pending balance across all credit sales</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Accounts</span>
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 animate-pulse">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-mono font-bold text-rose-300">{formatINR(kpiData.overdueAmount)}</div>
            <p className="text-[10px] text-rose-400 font-medium mt-1">
              {kpiData.overdueCount} {kpiData.overdueCount === 1 ? 'Invoice' : 'Invoices'} past due date
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collected</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-mono font-bold text-emerald-400">{formatINR(kpiData.totalCollected)}</div>
            <p className="text-[10px] text-slate-500 mt-1">Partial and full credit recoveries</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Credit Sales</span>
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-mono font-bold text-amber-200">{formatINR(kpiData.totalCreditVolume)}</div>
            <p className="text-[10px] text-slate-500 mt-1">{kpiData.totalCount} credit invoices issued</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 flex flex-col lg:flex-row gap-3 items-center justify-between shadow-md">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search customer, phone, or invoice no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-lg">
            <span className="text-[10px] text-slate-400 font-bold px-2 uppercase">Status:</span>
            {(['all', 'Unpaid', 'Partially Paid', 'Overdue', 'Paid'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  statusFilter === st
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'all' ? 'All' : st}
              </button>
            ))}
          </div>

          {/* Quick Time Filters */}
          <button
            onClick={() => setTimeFilter(timeFilter === 'overdue' ? 'all' : 'overdue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
              timeFilter === 'overdue'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Overdue Only
          </button>
        </div>
      </div>

      {/* Credit Ledger Data Table */}
      <div className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-850 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Invoice Date</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Remaining / Overdue</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 text-xs font-mono">
              {filteredCalculatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-600" />
                    No credit transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredCalculatedInvoices.map(({ invoice, summary }) => {
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-850/40 transition">
                      {/* Customer */}
                      <td className="py-3.5 px-4 font-sans font-medium text-slate-200">
                        <button
                          onClick={() =>
                            setCustomerHistoryModal({
                              phone: invoice.customerPhone || '',
                              name: invoice.customerName || 'Customer',
                            })
                          }
                          className="text-left group flex flex-col hover:text-amber-400 transition"
                        >
                          <span className="font-bold flex items-center gap-1 group-hover:underline">
                            <User className="w-3 h-3 text-slate-400 group-hover:text-amber-400" />
                            {formatMemberName(invoice.customerName) || 'Walk-in Client'}
                          </span>
                          {invoice.customerPhone && (
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> {invoice.customerPhone}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Invoice No */}
                      <td className="py-3.5 px-4 font-bold text-amber-300">{invoice.invoiceNo}</td>

                      {/* Invoice Date */}
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                        {formatINR(summary.totalAmount)}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold">
                        {formatINR(summary.paidAmount)}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3.5 px-4 text-right font-bold text-rose-400">
                        {formatINR(summary.balanceDue)}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {summary.dueDate ? new Date(summary.dueDate).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Days Remaining / Overdue */}
                      <td className="py-3.5 px-4">
                        {summary.status === 'Paid' ? (
                          <span className="text-slate-500 font-sans text-[11px]">Settled</span>
                        ) : summary.daysRemaining < 0 ? (
                          <span className="text-rose-400 font-bold font-sans text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            Overdue by {Math.abs(summary.daysRemaining)} {Math.abs(summary.daysRemaining) === 1 ? 'day' : 'days'}
                          </span>
                        ) : summary.daysRemaining === 0 ? (
                          <span className="text-amber-400 font-bold font-sans text-[11px]">Due Today</span>
                        ) : (
                          <span className="text-amber-200/80 font-sans text-[11px]">
                            {summary.daysRemaining} {summary.daysRemaining === 1 ? 'day' : 'days'} remaining
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center font-sans">
                        {renderStatusBadge(summary.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Invoice */}
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setViewInvoiceModal(true);
                            }}
                            title="View Invoice & Payments"
                            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-750 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Receive Payment */}
                          {summary.balanceDue > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(invoice)}
                              title="Receive Payment"
                              className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-bold text-[10px] flex items-center gap-1 transition"
                            >
                              <PlusCircle className="w-3 h-3" /> Pay
                            </button>
                          )}

                          {/* Mark as Paid */}
                          {summary.balanceDue > 0 && (
                            <button
                              onClick={() => handleMarkAsPaid(invoice)}
                              title="Mark as Paid in Full"
                              className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold text-[10px] transition"
                            >
                              Settle
                            </button>
                          )}
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

      {/* VIEW INVOICE & CREDIT HISTORY MODAL */}
      {viewInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  Credit Invoice: {selectedInvoice.invoiceNo}
                </h3>
              </div>
              <button
                onClick={() => setViewInvoiceModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans">
              {/* Customer & Invoice Summary */}
              {(() => {
                const summary = calculateCreditSummary(selectedInvoice);
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 border border-slate-850 p-4 rounded-xl">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Customer</span>
                        <p className="font-bold text-slate-200 text-sm mt-0.5">
                          {formatMemberName(selectedInvoice.customerName)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">{selectedInvoice.customerPhone}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Invoice Total</span>
                        <p className="font-bold text-amber-200 font-mono text-sm mt-0.5">
                          {formatINR(summary.totalAmount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Balance Due</span>
                        <p className="font-bold text-rose-400 font-mono text-sm mt-0.5">
                          {formatINR(summary.balanceDue)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Status</span>
                        <div className="mt-1">{renderStatusBadge(summary.status)}</div>
                      </div>
                    </div>

                    {/* Due Date & Remarks */}
                    <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-400 font-bold block">Due Date:</span>
                        <span className="text-slate-200 font-mono">{selectedInvoice.dueDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Reason:</span>
                        <span className="text-slate-300">{selectedInvoice.creditReason || 'None specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Remarks:</span>
                        <span className="text-slate-300">{selectedInvoice.creditRemarks || 'None'}</span>
                      </div>
                    </div>

                    {/* Itemized Cart Breakdown */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-amber-200 uppercase text-[10px] tracking-wider">Purchased Items</h4>
                      <div className="border border-slate-850 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono">
                          <thead>
                            <tr className="bg-slate-950 text-[10px] text-slate-400 uppercase font-bold">
                              <th className="py-2 px-3">Item</th>
                              <th className="py-2 px-3 text-center">Qty</th>
                              <th className="py-2 px-3 text-right">Price</th>
                              <th className="py-2 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {selectedInvoice.items.map((it: any, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-sans text-slate-200">
                                  {it.name}{' '}
                                  <span className="text-[9px] text-slate-500">
                                    ({it.size} / {it.color || 'OS'})
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">{it.quantity}</td>
                                <td className="py-2 px-3 text-right">{formatINR(it.sellingPrice)}</td>
                                <td className="py-2 px-3 text-right font-bold text-slate-200">
                                  {formatINR(it.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Payment History Log */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-amber-200 uppercase text-[10px] tracking-wider">
                          Payment Timeline & Receipts ({selectedInvoice.payments?.length || 0})
                        </h4>
                        {summary.balanceDue > 0 && (
                          <button
                            onClick={() => {
                              setViewInvoiceModal(false);
                              handleOpenPaymentModal(selectedInvoice);
                            }}
                            className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1"
                          >
                            <PlusCircle className="w-3 h-3" /> Receive Partial Payment
                          </button>
                        )}
                      </div>

                      {!selectedInvoice.payments || selectedInvoice.payments.length === 0 ? (
                        <div className="bg-slate-950 p-3 rounded-lg text-slate-500 text-[11px] text-center font-mono">
                          No partial payments recorded yet. Total balance is pending.
                        </div>
                      ) : (
                        <div className="space-y-1.5 font-mono">
                          {selectedInvoice.payments.map((pmt) => (
                            <div
                              key={pmt.id}
                              className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between"
                            >
                              <div>
                                <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5" /> {formatINR(pmt.amount)}
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                  Mode: <span className="uppercase text-amber-300 font-semibold">{pmt.paymentMethod}</span>
                                  {pmt.notes && <span className="text-slate-500 ml-2">— {pmt.notes}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {new Date(pmt.date).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE PAYMENT MODAL */}
      {paymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  Receive Payment — {selectedInvoice.invoiceNo}
                </h3>
              </div>
              <button
                onClick={() => setPaymentModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4 text-xs font-sans">
              {(() => {
                const summary = calculateCreditSummary(selectedInvoice);
                return (
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Total Remaining Balance</span>
                      <div className="text-rose-400 font-mono font-bold text-lg">{formatINR(summary.balanceDue)}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Invoice Total</span>
                      <div className="text-slate-300 font-mono font-semibold">{formatINR(summary.totalAmount)}</div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex justify-between">
                  <span>Amount to Receive (₹)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const summary = calculateCreditSummary(selectedInvoice);
                      setPaymentAmount(summary.balanceDue.toString());
                    }}
                    className="text-[10px] text-amber-400 hover:underline"
                  >
                    Pay Full Balance
                  </button>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'upi', label: 'UPI / QR' },
                    { id: 'card', label: 'Card' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMode(m.id as any)}
                      className={`p-2.5 rounded-lg border text-center font-bold transition ${
                        paymentMode === m.id
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Remarks / Notes (Optional)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Received via GPay, Cash handed at store..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold hover:bg-slate-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg gold-gradient text-slate-950 font-bold uppercase tracking-wider text-xs shadow-lg hover:opacity-90"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER CREDIT HISTORY MODAL */}
      {customerHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  Customer Credit Ledger: {formatMemberName(customerHistoryModal.name)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewCustomerStatement(customerHistoryModal.phone, customerHistoryModal.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 text-xs font-bold hover:bg-slate-750 transition"
                >
                  <FileText className="w-3.5 h-3.5" /> View Statement
                </button>
                <button
                  onClick={() => setCustomerHistoryModal(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans">
              {(() => {
                const custInvoices = creditInvoices.filter(
                  (inv) => inv.customerPhone === customerHistoryModal.phone
                );
                const summaries = custInvoices.map((inv) => calculateCreditSummary(inv));

                const totalInvoiced = summaries.reduce((s, c) => s + c.totalAmount, 0);
                const totalPaid = summaries.reduce((s, c) => s + c.paidAmount, 0);
                const totalOutstanding = summaries.reduce((s, c) => s + c.balanceDue, 0);

                return (
                  <>
                    <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-850 p-4 rounded-xl text-center">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Total Credit Issued</span>
                        <div className="text-amber-200 font-mono font-bold text-base mt-1">
                          {formatINR(totalInvoiced)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Total Paid</span>
                        <div className="text-emerald-400 font-mono font-bold text-base mt-1">
                          {formatINR(totalPaid)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Total Balance Due</span>
                        <div className="text-rose-400 font-mono font-bold text-base mt-1">
                          {formatINR(totalOutstanding)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-amber-200 uppercase text-[10px] tracking-wider">
                        All Credit Invoices ({custInvoices.length})
                      </h4>
                      <div className="space-y-2">
                        {custInvoices.map((inv) => {
                          const summary = calculateCreditSummary(inv);
                          return (
                            <div
                              key={inv.id}
                              className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-300 font-mono text-sm">{inv.invoiceNo}</span>
                                  <span className="text-slate-500 font-mono">
                                    {new Date(inv.date).toLocaleDateString()}
                                  </span>
                                  {renderStatusBadge(summary.status)}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                  Due Date: <span className="font-mono text-slate-300">{inv.dueDate || 'N/A'}</span>
                                  {inv.creditReason && (
                                    <span className="ml-2 text-slate-500">• Reason: {inv.creditReason}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 justify-between sm:justify-end">
                                <div className="text-right font-mono">
                                  <div className="text-slate-300">Total: {formatINR(summary.totalAmount)}</div>
                                  <div className="text-rose-400 font-bold">
                                    Due: {formatINR(summary.balanceDue)}
                                  </div>
                                </div>

                                {summary.balanceDue > 0 && (
                                  <button
                                    onClick={() => {
                                      setCustomerHistoryModal(null);
                                      handleOpenPaymentModal(inv);
                                    }}
                                    className="px-3 py-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition"
                                  >
                                    Pay
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Customer Modal */}
      {newCreditCustModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-fade-in">
            <button
              onClick={() => setNewCreditCustModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl gold-gradient text-slate-950 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Add Credit Customer</h3>
                <p className="text-xs text-slate-400">Establish a new Udhar Ledger profile</p>
              </div>
            </div>

            <form onSubmit={handleCreateCreditCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={creditCustName}
                  onChange={(e) => setCreditCustName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={creditCustPhone}
                  onChange={(e) => setCreditCustPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Credit Notes / Terms
                </label>
                <textarea
                  value={creditCustNotes}
                  onChange={(e) => setCreditCustNotes(e.target.value)}
                  placeholder="e.g. VIP Credit Limit ₹50,000"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCreditCustModalOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg gold-gradient text-slate-950 text-xs font-bold uppercase tracking-wider shadow hover:brightness-110 transition"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Customer Warning Modal */}
      <DuplicateCustomerModal
        isOpen={creditDuplicateModal.isOpen}
        existingCustomer={creditDuplicateModal.existingCustomer}
        onOpenExisting={handleOpenExistingCreditCustomer}
        onCancel={() => setCreditDuplicateModal({ isOpen: false, existingCustomer: null })}
        moduleContext="Credit Ledger (Udhar Management)"
      />

      {/* Dynamic Style Injection for Printing */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        @media print {
          .no-print, header, nav, aside, footer, .global-app-header {
            display: none !important;
          }

          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          #printable-area, #printable-area * {
            visibility: visible !important;
          }

          #printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }

          .print-preview-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Dedicated Full-Page Report Preview Mode */}
      {reportPreviewOpen && (
        <div className="fixed inset-0 z-[2000] w-full max-w-full h-full bg-slate-100 flex flex-col overflow-y-auto font-sans text-slate-900 animate-fadeIn print-preview-overlay">
          {/* Top Bar Controls */}
          <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 px-6 py-3 flex items-center justify-between no-print">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-serif">
                  SMART FASHION ERP — Report Preview
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  {printMode === 'summary'
                    ? `Credit Ledger Report (${filteredCalculatedInvoices.length} Records)`
                    : `Customer Udhar Statement: ${customerHistoryModal?.name}`}
                </p>
              </div>
            </div>

            {/* Top-Right Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportPreviewOpen(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Ledger
              </button>
            </div>
          </div>

          {/* Centered A4 Landscape Report Paper on Clean Light Background */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 flex justify-center items-center bg-slate-100">
            <div
              id="printable-area"
              className="print-container w-full max-w-[297mm] h-auto bg-white text-slate-950 p-[8mm] sm:p-[10mm] shadow-xl border border-slate-300 rounded-sm mx-auto my-auto"
            >
              {printMode === 'summary' && (
                <div className="space-y-6">
                  {/* Report Header */}
                  <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                    <div>
                      <h1 className="font-serif text-2xl font-black uppercase tracking-wider text-slate-900">
                        SMART FASHION
                      </h1>
                      <h2 className="text-xs font-bold text-amber-800 uppercase tracking-widest mt-0.5">
                        Credit Ledger Report
                      </h2>
                      <div className="text-xs text-slate-600 font-mono mt-2 space-y-0.5">
                        <p><strong className="text-slate-800">Address:</strong> {settings.storeProfile.address || 'Main Market Road'}</p>
                        <p><strong className="text-slate-800">Phone:</strong> {settings.storeProfile.phone || 'N/A'} | <strong className="text-slate-800">GSTIN:</strong> {settings.storeProfile.gstin || '27AAAAA0000A1Z5'}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono text-slate-600 space-y-1">
                      <div className="p-2.5 bg-slate-100 border border-slate-300 rounded text-left">
                        <p><strong className="text-slate-900">Report Date:</strong> {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        <p><strong className="text-slate-900">Printed By:</strong> Showroom Concierge</p>
                        <p className="text-[10px] text-slate-500 mt-1 border-t border-slate-300 pt-1">
                          Filter: <span className="font-bold text-slate-800 uppercase">{statusFilter}</span> | Overdue: <span className="font-bold text-slate-800 uppercase">{timeFilter === 'overdue' ? 'YES' : 'NO'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Data Table */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-400 pb-1 flex justify-between">
                      <span>Credit Invoices ({filteredCalculatedInvoices.length})</span>
                      <span className="text-[10px] text-slate-500 font-normal">All amounts in INR (₹)</span>
                    </h3>
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="border-b-2 border-slate-900 bg-slate-200 text-[10px] uppercase font-bold text-slate-800">
                          <th className="py-2 px-2">Customer Name</th>
                          <th className="py-2 px-2">Mobile No.</th>
                          <th className="py-2 px-2">Invoice No.</th>
                          <th className="py-2 px-2">Invoice Date</th>
                          <th className="py-2 px-2">Due Date</th>
                          <th className="py-2 px-2 text-right">Invoice Amount</th>
                          <th className="py-2 px-2 text-right">Amount Paid</th>
                          <th className="py-2 px-2 text-right">Balance Due</th>
                          <th className="py-2 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {filteredCalculatedInvoices.map(({ invoice, summary }) => (
                          <tr key={invoice.id} className="align-top hover:bg-slate-50">
                            <td className="py-2 px-2 font-sans font-bold text-slate-900">
                              {formatMemberName(invoice.customerName) || 'Walk-in Client'}
                            </td>
                            <td className="py-2 px-2">{invoice.customerPhone || 'N/A'}</td>
                            <td className="py-2 px-2 font-bold">{invoice.invoiceNo}</td>
                            <td className="py-2 px-2">{new Date(invoice.date).toLocaleDateString()}</td>
                            <td className="py-2 px-2">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-2 px-2 text-right font-bold">{formatINR(summary.totalAmount)}</td>
                            <td className="py-2 px-2 text-right text-emerald-800 font-semibold">{formatINR(summary.paidAmount)}</td>
                            <td className="py-2 px-2 text-right font-bold text-rose-800">{formatINR(summary.balanceDue)}</td>
                            <td className="py-2 px-2 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                summary.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                summary.status === 'Overdue' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                summary.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-slate-100 text-slate-800 border border-slate-300'
                              }`}>
                                {summary.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Summary Box */}
                  <div className="border-t-2 border-slate-900 pt-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Report Footer Summary
                    </h4>
                    <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono">
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Credit Sales</span>
                        <span className="text-sm font-bold text-slate-900">{formatINR(filteredKpi.totalCreditSales)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Collected</span>
                        <span className="text-sm font-bold text-emerald-800">{formatINR(filteredKpi.totalCollected)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Outstanding</span>
                        <span className="text-sm font-bold text-rose-800">{formatINR(filteredKpi.totalOutstanding)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Overdue Amount</span>
                        <span className="text-sm font-bold text-rose-800">{formatINR(filteredKpi.overdueAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Number of Customers</span>
                        <span className="text-sm font-bold text-slate-900">{filteredKpi.customerCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Number of Credit Invoices</span>
                        <span className="text-sm font-bold text-slate-900">{filteredKpi.invoiceCount}</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {printMode === 'customer' && customerHistoryModal && (() => {
                const custInvoices = creditInvoices.filter((inv) => inv.customerPhone === customerHistoryModal.phone);
                const summaries = custInvoices.map((inv) => calculateCreditSummary(inv));
                const totalInvoiced = summaries.reduce((s, c) => s + c.totalAmount, 0);
                const totalPaid = summaries.reduce((s, c) => s + c.paidAmount, 0);
                const totalOutstanding = summaries.reduce((s, c) => s + c.balanceDue, 0);
                const overdueAmount = summaries.filter(s => s.status === 'Overdue').reduce((s, c) => s + c.balanceDue, 0);

                return (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                      <div>
                        <h1 className="font-serif text-2xl font-black uppercase tracking-wider text-slate-900">
                          SMART FASHION
                        </h1>
                        <h2 className="text-xs font-bold text-amber-800 uppercase tracking-widest mt-0.5">
                          Customer Udhar Ledger Statement
                        </h2>
                        <div className="text-xs text-slate-600 font-mono mt-2 space-y-0.5">
                          <p><strong className="text-slate-800">Address:</strong> {settings.storeProfile.address || 'Main Market Road'}</p>
                          <p><strong className="text-slate-800">Phone:</strong> {settings.storeProfile.phone || 'N/A'} | <strong className="text-slate-800">GSTIN:</strong> {settings.storeProfile.gstin || '27AAAAA0000A1Z5'}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs font-mono text-slate-600 space-y-1">
                        <div className="p-2.5 bg-slate-100 border border-slate-300 rounded text-left">
                          <p><strong className="text-slate-900">Report Date:</strong> {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                          <p><strong className="text-slate-900">Printed By:</strong> Showroom Concierge</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Profile Banner */}
                    <div className="p-4 bg-slate-100 border border-slate-300 rounded-lg flex justify-between items-center font-mono text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Account Holder</span>
                        <div className="text-sm font-bold text-slate-900">{formatMemberName(customerHistoryModal.name)}</div>
                        <div className="text-xs text-slate-700">Mobile: {customerHistoryModal.phone}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-right">
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Credit Sales</span>
                          <span className="text-xs font-bold text-slate-900">{formatINR(totalInvoiced)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Collected</span>
                          <span className="text-xs font-bold text-emerald-800">{formatINR(totalPaid)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Balance Due</span>
                          <span className="text-sm font-bold text-rose-800">{formatINR(totalOutstanding)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invoices Table */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-400 pb-1">
                        Itemized Customer Invoices ({custInvoices.length})
                      </h3>
                      <table className="w-full text-left text-xs border-collapse font-mono">
                        <thead>
                          <tr className="border-b-2 border-slate-900 bg-slate-200 text-[10px] uppercase font-bold text-slate-800">
                            <th className="py-2 px-2">Customer Name</th>
                            <th className="py-2 px-2">Mobile No.</th>
                            <th className="py-2 px-2">Invoice #</th>
                            <th className="py-2 px-2">Invoice Date</th>
                            <th className="py-2 px-2">Due Date</th>
                            <th className="py-2 px-2 text-right">Invoice Amount</th>
                            <th className="py-2 px-2 text-right">Amount Paid</th>
                            <th className="py-2 px-2 text-right">Balance Due</th>
                            <th className="py-2 px-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                          {custInvoices.map((inv) => {
                            const summary = calculateCreditSummary(inv);
                            return (
                              <tr key={inv.id}>
                                <td className="py-2 px-2 font-sans font-bold text-slate-900">{formatMemberName(inv.customerName) || 'Walk-in Client'}</td>
                                <td className="py-2 px-2">{inv.customerPhone || 'N/A'}</td>
                                <td className="py-2 px-2 font-bold">{inv.invoiceNo}</td>
                                <td className="py-2 px-2">{new Date(inv.date).toLocaleDateString()}</td>
                                <td className="py-2 px-2">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}</td>
                                <td className="py-2 px-2 text-right font-bold">{formatINR(summary.totalAmount)}</td>
                                <td className="py-2 px-2 text-right text-emerald-800 font-semibold">{formatINR(summary.paidAmount)}</td>
                                <td className="py-2 px-2 text-right font-bold text-rose-800">{formatINR(summary.balanceDue)}</td>
                                <td className="py-2 px-2 text-center font-sans">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    summary.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    summary.status === 'Overdue' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                    summary.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                    'bg-slate-100 text-slate-800 border border-slate-300'
                                  }`}>
                                    {summary.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Summary */}
                    <div className="border-t-2 border-slate-900 pt-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Report Footer Summary
                      </h4>
                      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono">
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Credit Sales</span>
                          <span className="text-sm font-bold text-slate-900">{formatINR(totalInvoiced)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Collected</span>
                          <span className="text-sm font-bold text-emerald-800">{formatINR(totalPaid)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Outstanding</span>
                          <span className="text-sm font-bold text-rose-800">{formatINR(totalOutstanding)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Overdue Amount</span>
                          <span className="text-sm font-bold text-rose-800">{formatINR(overdueAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Number of Customers</span>
                          <span className="text-sm font-bold text-slate-900">1</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-bold block">Number of Credit Invoices</span>
                          <span className="text-sm font-bold text-slate-900">{custInvoices.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
