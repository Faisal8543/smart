/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice, AppSettings } from '../types';
import { formatINR } from './currency';
import { getPreviousOutstandingForCustomer } from './creditUtils';
import { generateCode128SvgString } from './code128';

export function buildPrintableInvoiceHtml(
  invoice: Invoice,
  settings: AppSettings,
  allInvoices: Invoice[]
): string {
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';
  const storeAddress = settings?.storeProfile?.address || '';
  const storePhone = settings?.storeProfile?.phone || '+91 XXXXX XXXXX';
  const storeGstin = settings?.storeProfile?.gstin || '';
  const storeWebsite = settings?.storeProfile?.website || 'www.smartfashion.in';

  const customerName = invoice.customerName ? invoice.customerName.toUpperCase() : 'WALK-IN CUSTOMER';
  const formattedDate = new Date(invoice.date).toLocaleDateString();

  // Outstanding calculations
  const prevOutstanding =
    invoice.previousOutstanding !== undefined
      ? invoice.previousOutstanding
      : getPreviousOutstandingForCustomer(invoice.customerPhone, invoice.id, allInvoices, invoice.date);

  const hasPrevOutstanding = prevOutstanding > 0;
  const isCreditSale = invoice.paymentMethod === 'credit';
  const currentInvoiceAmount = invoice.grandTotal;
  const totalOutstanding = hasPrevOutstanding ? prevOutstanding + currentInvoiceAmount : currentInvoiceAmount;

  const amountPaidToday = invoice.collectedPreviousDue
    ? invoice.totalPaidToday ?? invoice.amountPaid ?? 0
    : invoice.amountPaid !== undefined
    ? invoice.amountPaid
    : isCreditSale
    ? 0
    : currentInvoiceAmount;

  const netRemainingDue = Math.max(0, Number((totalOutstanding - amountPaidToday).toFixed(2)));
  const isPaidInFull = netRemainingDue <= 0.01;

  let paymentModeStr = String(invoice.paymentMethod || 'CASH').toUpperCase();
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

  // Savings calculations
  const memberSavings = invoice.discountCardDiscount || 0;
  const giftSavings =
    invoice.items
      ?.filter((it: any) => it.isGift)
      ?.reduce(
        (sum: number, it: any) => sum + (it.originalSellingPrice - it.sellingPrice) * it.quantity,
        0
      ) || 0;

  let offerSavings = 0;
  let couponSavings = 0;

  if (invoice.appliedOffers) {
    invoice.appliedOffers.forEach((ao: any) => {
      if (ao.offer.id === 'membership-card') {
        // handled under memberSavings
      } else if (
        ao.offer.offerCategory === 'coupon' ||
        ao.offer.type === 'coupon' ||
        (ao.offer.code && ao.offer.code !== 'bogo' && ao.offer.code !== 'buy3get1')
      ) {
        couponSavings += ao.savings;
      } else {
        offerSavings += ao.savings;
      }
    });
  } else {
    couponSavings = invoice.discountAmount || 0;
  }

  const combinedCouponAndOffer = couponSavings + offerSavings;
  const totalSavings = memberSavings + combinedCouponAndOffer + giftSavings;

  // Item rows HTML
  const itemsHtml = invoice.items
    .map((it: any) => {
      const isFree = it.sellingPrice === 0 || it.total === 0;
      const rateDisplay = isFree
        ? `<span class="free-badge">FREE</span>`
        : formatINR(it.sellingPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      const totalDisplay = isFree
        ? `<span class="bold" style="font-size:9.5px;">Val ${formatINR(
            it.originalSellingPrice || it.sellingPrice,
            { minimumFractionDigits: 0, maximumFractionDigits: 0 }
          )}</span>`
        : formatINR(it.total, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      return `
        <tr class="item-row">
          <td class="item-desc-col">
            <div class="item-name" title="${escapeHtml(it.name)}">${it.isGift ? '🎁 ' : ''}${escapeHtml(it.name)}</div>
            <div class="item-meta">SZ: ${escapeHtml(it.size || 'STD')} | CLR: ${escapeHtml(it.color || 'OS')}</div>
          </td>
          <td class="item-qty-col">${it.quantity}</td>
          <td class="item-rate-col">${rateDisplay}</td>
          <td class="item-total-col">${totalDisplay}</td>
        </tr>
      `;
    })
    .join('');

  // Savings summary HTML
  let savingsSummaryHtml = '';
  if (totalSavings > 0) {
    savingsSummaryHtml = `
      <div class="savings-container">
        <div class="savings-title">SAVINGS SUMMARY</div>
        ${
          memberSavings > 0
            ? `<div class="flex-between meta-line"><span>Member Savings:</span><span class="amount-val">${formatINR(memberSavings, { keepDecimals: true })}</span></div>`
            : ''
        }
        ${
          combinedCouponAndOffer > 0
            ? `<div class="flex-between meta-line"><span>Coupon Savings:</span><span class="amount-val">${formatINR(combinedCouponAndOffer, { keepDecimals: true })}</span></div>`
            : ''
        }
        ${
          giftSavings > 0
            ? `<div class="flex-between meta-line"><span>Gift Savings:</span><span class="amount-val">${formatINR(giftSavings, { keepDecimals: true })}</span></div>`
            : ''
        }
        <div class="flex-between meta-line bold border-dashed-t-inner">
          <span>TOTAL SAVINGS:</span>
          <span class="amount-val">${formatINR(totalSavings, { keepDecimals: true })}</span>
        </div>
      </div>
    `;
  }

  // Payment section HTML - flat continuous rows with uniform micro-spacing
  const paymentRows: string[] = [];

  // Row 1: Payment Mode
  paymentRows.push(`
    <div class="flex-between meta-line">
      <span class="bold">Payment Mode:</span>
      <span class="bold uppercase">${escapeHtml(paymentModeStr)}</span>
    </div>
  `);

  // Row 2 (Optional): Previous Outstanding (only if > 0)
  if (hasPrevOutstanding) {
    paymentRows.push(`
      <div class="flex-between meta-line">
        <span>Previous Outstanding:</span>
        <span class="bold amount-val">${formatINR(prevOutstanding, { keepDecimals: true })}</span>
      </div>
    `);
  }

  // Row 3: Current Invoice
  paymentRows.push(`
    <div class="flex-between meta-line">
      <span>Current Invoice:</span>
      <span class="bold amount-val">${formatINR(currentInvoiceAmount, { keepDecimals: true })}</span>
    </div>
  `);

  // Row 4 (Optional): TOTAL OUTSTANDING (only if previous outstanding > 0)
  if (hasPrevOutstanding) {
    paymentRows.push(`
      <div class="flex-between meta-line bold" style="margin-top:0.5px;">
        <span>TOTAL OUTSTANDING:</span>
        <span class="amount-val">${formatINR(totalOutstanding, { keepDecimals: true })}</span>
      </div>
    `);
  }

  // Row 5: Amount Paid (or Amount Paid Today)
  paymentRows.push(`
    <div class="flex-between meta-line bold">
      <span>${hasPrevOutstanding ? 'Amount Paid Today:' : 'Amount Paid:'}</span>
      <span class="bold amount-val">${formatINR(amountPaidToday, { keepDecimals: true })}</span>
    </div>
  `);

  // Row 6: Payment Status / Balance Due / Remaining Due
  if (isPaidInFull) {
    paymentRows.push(`
      <div class="flex-between meta-line bold payment-status-row" style="align-items: center; margin-top: 0.5px; margin-bottom: 0.5px;">
        <span>Payment Status:</span>
        <span class="paid-badge">PAID</span>
      </div>
    `);
  } else {
    paymentRows.push(`
      <div class="flex-between meta-line bold due-text payment-status-row" style="margin-top: 0.5px; margin-bottom: 0.5px;">
        <span>${escapeHtml(remainingLabel)}</span>
        <span class="amount-val">${formatINR(netRemainingDue, { keepDecimals: true })}</span>
      </div>
    `);
    if (invoice.dueDate) {
      paymentRows.push(`
        <div class="flex-between meta-line" style="margin-top:0.5px;">
          <span>Due Date:</span>
          <span class="bold">${escapeHtml(invoice.dueDate)}</span>
        </div>
      `);
    }
  }

  // Row 7 (Optional): Change Returned (only if > 0)
  if (invoice.changeReturned !== undefined && invoice.changeReturned > 0) {
    paymentRows.push(`
      <div class="flex-between meta-line" style="margin-top:0.5px;">
        <span>Change Returned:</span>
        <span class="bold amount-val">${formatINR(invoice.changeReturned, { keepDecimals: true })}</span>
      </div>
    `);
  }

  const paymentDetailsHtml = `
    <div class="payment-container border-dashed-b">
      ${paymentRows.join('')}
    </div>
  `;

  // UPI QR if present
  let upiQrHtml = '';
  const qrImage = (settings?.storeProfile as any)?.upiQrCode || (settings?.storeProfile as any)?.merchantQrCode;
  if (invoice.paymentMethod === 'upi' && qrImage) {
    upiQrHtml = `
      <div class="border-dashed-b text-center" style="padding:5px 0;">
        <img src="${escapeHtml(qrImage)}" alt="UPI QR" class="upi-qr-img" />
      </div>
    `;
  }

  // Exchange policy HTML (Products Bill Policy)
  let exchangePolicyHtml = '';
  if (settings?.exchangePolicy?.enabled) {
    const policyText = settings.exchangePolicy?.productsPolicyText !== undefined
      ? settings.exchangePolicy.productsPolicyText
      : (settings.exchangePolicy?.customPolicyText || '');

    const trimmed = (policyText || '').trim();
    const lines = trimmed
      ? trimmed
          .split('\n')
          .filter((l) => l.trim().length > 0)
          .map((l) => `<p class="policy-line">${escapeHtml(l)}</p>`)
          .join('')
      : '';

    let validUntilHtml = '';
    if (invoice.exchangeValidUntil) {
      const d = new Date(invoice.exchangeValidUntil);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        validUntilHtml = `<p class="exchange-valid-until">Exchange Valid Until: ${day}/${month}/${year}</p>`;
      }
    }

    if (lines || validUntilHtml) {
      exchangePolicyHtml = `
        <div class="exchange-policy-box">
          ${lines}
          ${validUntilHtml}
        </div>
      `;
    }
  } else {
    exchangePolicyHtml = `<p class="exchange-valid-until">No Exchange Allowed</p>`;
  }

  return `
    <!-- Header -->
    <div class="receipt-header border-dashed-b text-center">
      <h4 class="header-title">${escapeHtml(storeName)}</h4>
      ${storeAddress ? `<p class="header-sub">${escapeHtml(storeAddress)}</p>` : ''}
      <p class="header-contact">
        ${storePhone ? `<span>MOB: ${escapeHtml(storePhone)}</span>` : ''}
        ${storeGstin ? `<span> | GSTIN: ${escapeHtml(storeGstin)}</span>` : ''}
      </p>
    </div>

    <!-- Bill Details -->
    <div class="invoice-meta border-dashed-b">
      <div class="invoice-meta-row">
        <div class="meta-left">INVOICE: <span class="bold">${escapeHtml(invoice.invoiceNo)}</span></div>
        <div class="meta-right">DATE: ${formattedDate}</div>
      </div>
      <div class="invoice-meta-row">
        <div class="meta-left">CUSTOMER: <span class="bold">${escapeHtml(customerName)}</span></div>
        ${invoice.customerPhone ? `<div class="meta-right">MOB: ${escapeHtml(invoice.customerPhone)}</div>` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <div class="items-table-wrapper">
      <table class="items-table">
        <colgroup>
          <col class="col-desc">
          <col class="col-qty">
          <col class="col-rate">
          <col class="col-total">
        </colgroup>
        <thead>
          <tr>
            <th class="th-desc">Item Description</th>
            <th class="th-qty">Qty</th>
            <th class="th-rate">Rate</th>
            <th class="th-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <!-- Calculations Section -->
    <div class="calc-section">
      <div class="flex-between meta-line bold gross-subtotal-row">
        <span>Gross Subtotal:</span>
        <span class="amount-val">${formatINR(invoice.subtotal, { keepDecimals: true })}</span>
      </div>

      ${savingsSummaryHtml}

      <div class="tax-breakdown">
        <div class="flex-between meta-line">
          <span>Taxable Amount:</span>
          <span class="amount-val">${formatINR(invoice.grandTotal - invoice.gstAmount, { keepDecimals: true })}</span>
        </div>
        <div class="flex-between meta-line text-small">
          <span>GST Included (${invoice.gstRate}%):</span>
          <span class="amount-val">${formatINR(invoice.gstAmount, { keepDecimals: true })}</span>
        </div>
      </div>

      <div class="grand-total-box">
        <div class="flex-between grand-total-line">
          <span>GRAND TOTAL:</span>
          <span class="grand-total-val">${formatINR(invoice.grandTotal, { keepDecimals: true })}</span>
        </div>
      </div>
    </div>

    <!-- Payment Details -->
    ${paymentDetailsHtml}

    <!-- UPI QR -->
    ${upiQrHtml}

    <!-- Footer -->
    <div class="receipt-footer text-center">
      <p class="thank-you-title">
        Thank You For Shopping With ${escapeHtml(storeName)}
      </p>
      ${exchangePolicyHtml}
      <div class="customer-care-box">
        <p class="care-header">CUSTOMER CARE</p>
        <p class="care-phone">${escapeHtml(storePhone)}</p>
        ${storeWebsite ? `<p class="care-website">${escapeHtml(storeWebsite)}</p>` : ''}
      </div>
      <!-- Bill Lookup Barcode (Code 128) -->
      <div class="barcode-wrapper">
        ${generateCode128SvgString(invoice.invoiceNo, { height: 40, maxWidth: '54mm', includeText: true, fontSize: 9.5 })}
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildCompletePrintPageHtml(
  invoice: Invoice,
  settings: AppSettings,
  allInvoices: Invoice[]
): string {
  const invoiceBodyHtml = buildPrintableInvoiceHtml(invoice, settings, allInvoices);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${escapeHtml(invoice.invoiceNo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

    @page {
      size: 80mm auto;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      border-color: #000000 !important;
      opacity: 1 !important;
      filter: none !important;
      mix-blend-mode: normal !important;
      text-shadow: none !important;
    }
    html, body {
      width: 80mm !important;
      max-width: 80mm !important;
      min-width: 80mm !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10.5px;
      font-weight: 400;
      line-height: 1.25;
      letter-spacing: 0px !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    #invoice-print-area {
      display: block !important;
      position: relative !important;
      width: 75mm !important;
      max-width: 75mm !important;
      min-width: 75mm !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin-left: auto !important;
      margin-right: auto !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      padding: 1.5mm 0 1.5mm 0 !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      transform: none !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      letter-spacing: 0px !important;
      border: none !important;
    }
    #invoice-print-area * {
      max-width: 100% !important;
      box-sizing: border-box !important;
      color: #000000 !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      letter-spacing: 0px !important;
      opacity: 1 !important;
      filter: none !important;
      mix-blend-mode: normal !important;
      text-shadow: none !important;
    }

    .receipt-header,
    .invoice-meta,
    .items-table-wrapper,
    .items-table,
    .calc-section,
    .savings-container,
    .tax-breakdown,
    .grand-total-box,
    .payment-container,
    .receipt-footer,
    .exchange-policy-box,
    .customer-care-box,
    .barcode-wrapper {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      flex-grow: 0 !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
    }

    /* Common utilities & layout */
    .receipt-header {
      padding-bottom: 2px;
      margin-bottom: 2px;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: center !important;
      letter-spacing: 0px !important;
    }
    .header-title {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 700 !important;
      font-size: 16px !important;
      letter-spacing: 0px !important;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.15;
      word-break: break-word;
      overflow-wrap: break-word;
      margin: 0 0 1px 0;
    }
    .header-sub {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      letter-spacing: 0px !important;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.2;
      margin: 0.5px 0;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .header-contact {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      letter-spacing: 0px !important;
      margin: 0.5px 0 0 0;
      text-align: center;
      line-height: 1.2;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .border-dashed-b {
      border-bottom: 1px dashed #000000 !important;
      padding-bottom: 2px;
      margin-bottom: 2px;
    }
    .border-dashed-t {
      border-top: 1px dashed #000000 !important;
      padding-top: 2px;
      margin-top: 2px;
    }
    .border-dashed-t-inner {
      border-top: 1px dashed #000000 !important;
      padding-top: 1.5px;
      margin-top: 1.5px;
    }

    .flex-between {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      gap: 4px;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    .meta-line {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10.5px;
      line-height: 1.25;
      margin-top: 0.5px;
      margin-bottom: 0.5px;
      font-weight: 400;
    }

    .text-small {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 9.5px !important;
      line-height: 1.2;
    }

    .invoice-meta {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10.5px;
      line-height: 1.25;
      padding-bottom: 2px;
      margin-bottom: 2px;
    }
    .invoice-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      width: 100%;
      margin-top: 0.5px;
      margin-bottom: 0.5px;
      gap: 4px;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .meta-left {
      flex: 1 1 auto;
      min-width: 0;
      word-break: break-word;
      overflow-wrap: break-word;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .meta-right {
      flex: 0 0 auto;
      text-align: right;
      white-space: nowrap;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    /* Items Table */
    .items-table-wrapper {
      width: 100% !important;
      border-bottom: 1px dashed #000000 !important;
      padding-bottom: 2px;
      margin-bottom: 2px;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .items-table {
      width: 75mm !important;
      max-width: 75mm !important;
      min-width: 75mm !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      margin-left: auto !important;
      margin-right: auto !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      padding: 0 !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .col-desc { width: 44% !important; }
    .col-qty { width: 12% !important; }
    .col-rate { width: 22% !important; }
    .col-total { width: 22% !important; }

    .items-table th {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 600 !important;
      color: #000000 !important;
      border-bottom: 1px dashed #000000 !important;
      padding: 2px 1px 2px 0;
      font-size: 10.5px;
      line-height: 1.25;
      vertical-align: bottom;
      text-transform: uppercase;
      letter-spacing: 0px !important;
    }
    .th-desc { text-align: left; }
    .th-qty { text-align: center; }
    .th-rate { text-align: right; }
    .th-total { text-align: right; }

    /* Individual product row - NO separator border between items */
    .item-row {
      border-bottom: none !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .items-table td {
      padding: 2px 1px !important;
      vertical-align: top !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10.5px;
      line-height: 1.25;
    }

    .item-desc-col {
      width: 44% !important;
      max-width: 33mm !important;
      overflow: hidden !important;
      white-space: nowrap !important;
      padding-right: 2px !important;
      vertical-align: top !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .item-name {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 600 !important;
      font-size: 10.5px !important;
      line-height: 1.25 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      letter-spacing: 0px !important;
    }
    .item-meta {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 9px !important;
      font-weight: 400 !important;
      line-height: 1.15 !important;
      margin-top: 1px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      letter-spacing: 0px !important;
    }
    .item-qty-col {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: center !important;
      font-weight: 500 !important;
      vertical-align: top !important;
      white-space: nowrap !important;
      font-size: 10.5px !important;
      letter-spacing: 0px !important;
    }
    .item-rate-col {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: right !important;
      font-weight: 500 !important;
      vertical-align: top !important;
      white-space: nowrap !important;
      font-size: 10.5px !important;
      letter-spacing: 0px !important;
    }
    .item-total-col {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: right !important;
      font-weight: 600 !important;
      vertical-align: top !important;
      white-space: nowrap !important;
      padding-right: 0 !important;
      font-size: 10.5px !important;
      letter-spacing: 0px !important;
    }

    /* Savings Section */
    .savings-container {
      margin: 2px 0;
      padding: 2px 0;
      border-top: 1px dashed #000000 !important;
      border-bottom: 1px dashed #000000 !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .savings-title {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 600 !important;
      font-size: 10.5px !important;
      text-transform: uppercase;
      margin-bottom: 1.5px;
      letter-spacing: 0px !important;
      line-height: 1.25;
    }

    /* Tax and Grand Total */
    .gross-subtotal-row {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10.5px !important;
      margin-bottom: 1px;
    }
    .tax-breakdown {
      margin: 1px 0;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .grand-total-box {
      border-top: 2px solid #000000 !important;
      border-bottom: 2px solid #000000 !important;
      padding: 2.5px 0;
      margin: 2.5px 0 2px 0;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .grand-total-line {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 800 !important;
      font-size: 15px !important;
      text-transform: uppercase;
      letter-spacing: 0px !important;
      line-height: 1.25;
      align-items: center;
    }
    .grand-total-val {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 15px !important;
      font-weight: 800 !important;
      text-align: right;
      white-space: nowrap;
      flex: 0 0 auto;
      letter-spacing: 0px !important;
    }

    /* Payment Section */
    .payment-container {
      margin-top: 2px !important;
      margin-bottom: 2px !important;
      padding-top: 0px !important;
      padding-bottom: 2px !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .payment-status-row {
      margin-top: 0.5px !important;
      margin-bottom: 0.5px !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    /* Badges & Text styles */
    .amount-val {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: right;
      white-space: nowrap;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0px !important;
      flex: 0 0 auto;
    }
    .bold { font-weight: 600 !important; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
    .due-text { font-weight: 600 !important; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
    .paid-badge {
      background: transparent !important;
      color: #000000 !important;
      padding: 1px 4px;
      border-radius: 2px;
      border: 1.5px solid #000000 !important;
      font-size: 9.5px !important;
      font-weight: 800 !important;
      text-transform: uppercase;
      letter-spacing: 0px !important;
      line-height: 1;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .free-badge {
      font-weight: 700 !important;
      color: #000000 !important;
      background: transparent !important;
      padding: 0.5px 3px;
      border-radius: 2px;
      border: 1px solid #000000 !important;
      font-size: 8.5px !important;
      text-transform: uppercase;
      line-height: 1;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    /* Footer & Policies - All strictly center-aligned & compact */
    .receipt-footer {
      margin-top: 2px;
      font-size: 9px;
      line-height: 1.2;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: center !important;
      width: 100% !important;
    }
    .receipt-footer * {
      text-align: center !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .thank-you-title {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 600 !important;
      font-size: 9.5px !important;
      line-height: 1.2;
      margin-top: 2px;
      margin-bottom: 1px;
      text-align: center !important;
      display: block !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      width: 100% !important;
      letter-spacing: 0px !important;
    }
    .exchange-policy-box {
      font-size: 9px;
      line-height: 1.2;
      margin: 1px 0;
      word-break: break-word;
      overflow-wrap: break-word;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: center !important;
      display: block !important;
    }
    .policy-line {
      margin: 0.5px 0;
      word-break: break-word;
      overflow-wrap: break-word;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: center !important;
      display: block !important;
      font-weight: 400;
    }
    .exchange-valid-until {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-weight: 600 !important;
      font-size: 9.5px !important;
      margin-top: 0.5px;
      margin-bottom: 0.5px;
      word-break: break-word;
      text-align: center !important;
      display: block !important;
    }
    .customer-care-box {
      border-top: 1px dashed #000000 !important;
      margin-top: 1.5px;
      padding-top: 1.5px;
      font-size: 9px;
      line-height: 1.2;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      text-align: center !important;
      display: block !important;
    }
    .care-header {
      font-weight: 600 !important;
      text-transform: uppercase;
      font-size: 9px;
      margin-bottom: 0px;
      line-height: 1.15;
      text-align: center !important;
      display: block !important;
    }
    .care-phone {
      font-weight: 600 !important;
      font-size: 9.5px;
      margin-top: 0.5px;
      margin-bottom: 0px;
      line-height: 1.15;
      text-align: center !important;
      display: block !important;
    }
    .care-website {
      font-weight: 400 !important;
      font-size: 9px;
      margin-top: 0.5px;
      margin-bottom: 0px;
      line-height: 1.15;
      text-align: center !important;
      display: block !important;
    }
    .barcode-wrapper {
      margin-top: 1.5px;
      margin-bottom: 0px;
      text-align: center !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
    }
    .barcode-wrapper svg {
      margin: 0 auto !important;
      display: block !important;
    }
    .barcode-text {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 9.5px !important;
      font-weight: 600 !important;
      color: #000000 !important;
      letter-spacing: 0px !important;
      margin-top: 1.5px !important;
      line-height: 1 !important;
      text-align: center !important;
      word-break: break-all !important;
    }
    .upi-qr-img {
      width: 48px !important;
      height: 48px !important;
      object-fit: contain !important;
      margin: 2px auto !important;
      display: block !important;
    }

    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        border-color: #000000 !important;
        opacity: 1 !important;
        filter: none !important;
        mix-blend-mode: normal !important;
        text-shadow: none !important;
      }
      html, body {
        width: 80mm !important;
        max-width: 80mm !important;
        min-width: 80mm !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        letter-spacing: 0px !important;
      }
      body * {
        visibility: hidden;
      }
      #invoice-print-area,
      #invoice-print-area * {
        visibility: visible !important;
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        opacity: 1 !important;
        filter: none !important;
        mix-blend-mode: normal !important;
        text-shadow: none !important;
        background-color: transparent !important;
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        letter-spacing: 0px !important;
      }
      #invoice-print-area {
        display: block !important;
        position: relative !important;
        width: 75mm !important;
        max-width: 75mm !important;
        min-width: 75mm !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        padding: 1.5mm 0 1.5mm 0 !important;
        box-sizing: border-box !important;
        overflow: visible !important;
        transform: none !important;
        background: #ffffff !important;
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        letter-spacing: 0px !important;
        border: none !important;
      }
      #invoice-print-area .receipt-header,
      #invoice-print-area .invoice-meta,
      #invoice-print-area .items-table-wrapper,
      #invoice-print-area .items-table,
      #invoice-print-area .calc-section,
      #invoice-print-area .savings-container,
      #invoice-print-area .tax-breakdown,
      #invoice-print-area .grand-total-box,
      #invoice-print-area .payment-container,
      #invoice-print-area .receipt-footer,
      #invoice-print-area .exchange-policy-box,
      #invoice-print-area .customer-care-box,
      #invoice-print-area .barcode-wrapper {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        flex-grow: 0 !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
      }
      #invoice-print-area table {
        width: 75mm !important;
        max-width: 75mm !important;
        min-width: 75mm !important;
        table-layout: fixed !important;
        margin-left: auto !important;
        margin-right: auto !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        border-collapse: collapse !important;
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      #invoice-print-area * {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      #invoice-print-area img,
      #invoice-print-area svg,
      #invoice-print-area canvas {
        max-width: 100% !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div id="invoice-print-area">
    ${invoiceBodyHtml}
  </div>
  <script>
    (function () {
      var printed = false;
      function triggerPrint() {
        if (printed) return;
        printed = true;
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error('Print trigger error:', e);
        }
      }

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          setTimeout(triggerPrint, 250);
        }).catch(function () {
          setTimeout(triggerPrint, 250);
        });
      } else if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(triggerPrint, 250);
      } else {
        window.addEventListener('load', function () {
          setTimeout(triggerPrint, 250);
        }, { once: true });
      }

      // Fallback timer to guarantee print runs once
      setTimeout(triggerPrint, 1000);

      window.addEventListener('afterprint', function () {
        setTimeout(function () {
          try { window.close(); } catch (e) {}
        }, 500);
      }, { once: true });
    })();
  </script>
</body>
</html>`;
}

