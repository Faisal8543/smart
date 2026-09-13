/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricBill, AppSettings } from '../types';
import { formatINR } from './currency';
import { generateCode128SvgString } from './code128';

export function buildPrintableFabricBillHtml(
  bill: FabricBill,
  settings: AppSettings
): string {
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';
  const storeAddress = settings?.storeProfile?.address || '';
  const storePhone = settings?.storeProfile?.phone || '+91 XXXXX XXXXX';
  const storeGstin = settings?.storeProfile?.gstin || '';
  const storeWebsite = settings?.storeProfile?.website || 'www.smartfashion.in';

  const customerName = bill.customerName ? bill.customerName.toUpperCase() : 'WALK-IN CUSTOMER';
  const formattedDate = new Date(bill.date).toLocaleDateString();

  const isCreditSale = bill.paymentMethod === 'credit';
  const currentBillAmount = bill.grandTotal;
  const amountPaidToday = bill.amountPaid !== undefined ? bill.amountPaid : (isCreditSale ? 0 : currentBillAmount);
  const netRemainingDue = Math.max(0, Number((currentBillAmount - amountPaidToday).toFixed(2)));
  const isPaidInFull = netRemainingDue <= 0.01;

  let paymentModeStr = String(bill.paymentMethod || 'CASH').toUpperCase();
  if (paymentModeStr === 'CREDIT') {
    paymentModeStr = 'CREDIT (UDHAR)';
  }

  // Item rows HTML
  const itemsHtml = bill.items
    .map((it) => {
      const rateDisplay = formatINR(it.ratePerMeter, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const totalDisplay = formatINR(it.totalAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const brandStr = it.brandName || (it as any).brand || '';
      const colorStr = it.colorName || (it as any).color || '';

      return `
        <tr class="item-row">
          <td class="item-desc-col">
            <div class="item-name" title="${escapeHtml(it.fabricName)}">${escapeHtml(it.fabricName)}</div>
            <div class="item-meta">BR: ${escapeHtml(brandStr)} | CLR: ${escapeHtml(colorStr)}</div>
          </td>
          <td class="item-qty-col">${it.meters.toFixed(2)} M</td>
          <td class="item-rate-col">${rateDisplay}</td>
          <td class="item-total-col">${totalDisplay}</td>
        </tr>
      `;
    })
    .join('');

  // Payment section HTML - flat continuous rows with uniform micro-spacing
  const paymentRows: string[] = [];

  // Row 1: Payment Mode
  paymentRows.push(`
    <div class="flex-between meta-line">
      <span class="bold">Payment Mode:</span>
      <span class="bold uppercase">${escapeHtml(paymentModeStr)}</span>
    </div>
  `);

  // Row 2: Current Bill
  paymentRows.push(`
    <div class="flex-between meta-line">
      <span>Bill Amount:</span>
      <span class="bold amount-val">${formatINR(currentBillAmount, { keepDecimals: true })}</span>
    </div>
  `);

  // Row 3: Amount Paid
  paymentRows.push(`
    <div class="flex-between meta-line bold">
      <span>Amount Paid:</span>
      <span class="bold amount-val">${formatINR(amountPaidToday, { keepDecimals: true })}</span>
    </div>
  `);

  // Row 4: Balance Due
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
        <span>Balance Due:</span>
        <span class="amount-val">${formatINR(netRemainingDue, { keepDecimals: true })}</span>
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
  if (bill.paymentMethod === 'upi' && qrImage) {
    upiQrHtml = `
      <div class="border-dashed-b text-center" style="padding:5px 0;">
        <img src="${escapeHtml(qrImage)}" alt="UPI QR" class="upi-qr-img" />
      </div>
    `;
  }

  // Exchange policy HTML (Fabrics Bill Policy)
  let exchangePolicyHtml = '';
  if (settings?.exchangePolicy?.enabled) {
    const policyText = settings.exchangePolicy?.fabricsPolicyText !== undefined
      ? settings.exchangePolicy.fabricsPolicyText
      : '';

    const trimmed = (policyText || '').trim();
    const lines = trimmed
      ? trimmed
          .split('\n')
          .filter((l) => l.trim().length > 0)
          .map((l) => `<p class="policy-line">${escapeHtml(l)}</p>`)
          .join('')
      : '';

    if (lines) {
      exchangePolicyHtml = `
        <div class="exchange-policy-box">
          ${lines}
        </div>
      `;
    }
  } else {
    exchangePolicyHtml = `<p class="exchange-valid-until">No Exchange Allowed</p>`;
  }

  // Calculate GST included (standard rate from store profile settings)
  const gstRate = settings?.storeProfile?.defaultGstRate || 0;
  const taxableAmount = currentBillAmount / (1 + gstRate / 100);
  const gstAmount = currentBillAmount - taxableAmount;

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
        <div class="meta-left">BILL NO: <span class="bold">${escapeHtml(bill.billNo)}</span></div>
        <div class="meta-right">DATE: ${formattedDate}</div>
      </div>
      <div class="invoice-meta-row">
        <div class="meta-left">CUSTOMER: <span class="bold">${escapeHtml(customerName)}</span></div>
        ${bill.customerPhone ? `<div class="meta-right">MOB: ${escapeHtml(bill.customerPhone)}</div>` : ''}
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
            <th class="th-qty">Meter</th>
            <th class="th-rate">Rate/M</th>
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
        <span class="amount-val">${formatINR(bill.subtotal, { keepDecimals: true })}</span>
      </div>

      ${bill.discountAmount > 0 ? `
        <div class="flex-between meta-line">
          <span>Discount Applied:</span>
          <span class="amount-val text-red-500 font-semibold">-${formatINR(bill.discountAmount, { keepDecimals: true })}</span>
        </div>
      ` : ''}

      <div class="tax-breakdown">
        <div class="flex-between meta-line">
          <span>Taxable Amount:</span>
          <span class="amount-val">${formatINR(taxableAmount, { keepDecimals: true })}</span>
        </div>
        <div class="flex-between meta-line text-small">
          <span>GST Included (${gstRate}%):</span>
          <span class="amount-val">${formatINR(gstAmount, { keepDecimals: true })}</span>
        </div>
      </div>

      <div class="grand-total-box">
        <div class="flex-between grand-total-line">
          <span>GRAND TOTAL:</span>
          <span class="grand-total-val">${formatINR(bill.grandTotal, { keepDecimals: true })}</span>
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
        ${generateCode128SvgString(bill.billNo, { height: 40, maxWidth: '54mm', includeText: true, fontSize: 9.5 })}
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

export function buildCompleteFabricPrintPageHtml(
  bill: FabricBill,
  settings: AppSettings
): string {
  const invoiceBodyHtml = buildPrintableFabricBillHtml(bill, settings);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fabric Bill #${escapeHtml(bill.billNo)}</title>
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
    .col-qty { width: 18% !important; }
    .col-rate { width: 19% !important; }
    .col-total { width: 19% !important; }

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

    /* Footer & Policies */
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
        background-color: transparent !important;
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
    window.addEventListener('afterprint', function () {
      setTimeout(function () {
        try { window.close(); } catch (e) {}
      }, 500);
    }, { once: true });
  </script>
</body>
</html>`;
}
