import { Invoice } from '../types';

export interface CreditInvoiceSummary {
  invoiceTotal: number;
  totalAmount: number;
  totalPaid: number;
  paidAmount: number;
  balanceDue: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  daysText: string;
  isOverdue: boolean;
  daysDiff: number;
}

export function calculateCreditSummary(invoice: Invoice, nowDateStr?: string): CreditInvoiceSummary {
  const invoiceTotal = invoice.grandTotal || 0;

  let totalPaid = 0;
  const payments = invoice.payments || [];
  const initialPaid = invoice.amountPaid || 0;

  if (payments.length > 0) {
    const hasInitialInPayments = payments.some((p) => p.id?.startsWith('pmt_init_'));
    if (hasInitialInPayments) {
      totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    } else {
      totalPaid = initialPaid + payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }
  } else {
    totalPaid = initialPaid;
  }

  totalPaid = Math.min(invoiceTotal, totalPaid);
  const balanceDue = Math.max(0, Number((invoiceTotal - totalPaid).toFixed(2)));

  const today = nowDateStr ? new Date(nowDateStr) : new Date();
  today.setHours(0, 0, 0, 0);

  let dueDateObj: Date | null = null;
  if (invoice.dueDate) {
    dueDateObj = new Date(invoice.dueDate);
    dueDateObj.setHours(0, 0, 0, 0);
  }

  let isOverdue = false;
  let daysDiff = 0;
  let daysText = '-';

  if (balanceDue <= 0.01) {
    daysText = 'Paid in Full';
  } else if (dueDateObj && !isNaN(dueDateObj.getTime())) {
    const diffTime = dueDateObj.getTime() - today.getTime();
    daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      isOverdue = true;
      daysText = `${Math.abs(daysDiff)} Day${Math.abs(daysDiff) > 1 ? 's' : ''} Overdue`;
    } else if (daysDiff === 0) {
      daysText = 'Due Today';
    } else {
      daysText = `${daysDiff} Day${daysDiff > 1 ? 's' : ''} Left`;
    }
  }

  let status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  if (balanceDue <= 0.01) {
    status = 'Paid';
  } else if (isOverdue) {
    status = 'Overdue';
  } else if (totalPaid <= 0.01) {
    status = 'Unpaid';
  } else {
    status = 'Partially Paid';
  }

  return {
    invoiceTotal,
    totalAmount: invoiceTotal,
    totalPaid,
    paidAmount: totalPaid,
    balanceDue,
    status,
    daysText,
    isOverdue,
    daysDiff,
  };
}

export function getPreviousOutstandingForCustomer(
  customerPhone: string | undefined,
  currentInvoiceId: string | undefined,
  allInvoices: Invoice[],
  currentInvoiceDate?: string
): number {
  if (!customerPhone) return 0;
  const cleanPhone = customerPhone.replace(/\D/g, '');
  if (cleanPhone.length < 5) return 0;

  const currentInstTime = currentInvoiceDate ? new Date(currentInvoiceDate).getTime() : Date.now();

  const priorCreditInvoices = allInvoices.filter((inv) => {
    if (currentInvoiceId && inv.id === currentInvoiceId) return false;
    if (!inv.customerPhone) return false;
    const invPhone = inv.customerPhone.replace(/\D/g, '');
    if (invPhone !== cleanPhone) return false;

    // Must be a credit sale
    if (inv.paymentMethod !== 'credit') return false;

    // Check date if comparing historical invoices
    if (currentInvoiceDate && inv.date) {
      const invTime = new Date(inv.date).getTime();
      if (invTime >= currentInstTime) return false;
    }

    return true;
  });

  const total = priorCreditInvoices.reduce((sum, inv) => {
    const summary = calculateCreditSummary(inv);
    return sum + summary.balanceDue;
  }, 0);

  return Number(total.toFixed(2));
}
