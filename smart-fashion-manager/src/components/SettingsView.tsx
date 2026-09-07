/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useAppState } from '../context/StateContext';
import {
  Settings,
  X,
  Lock,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Building,
  Sliders,
  Check,
  Globe,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  Layers,
  Palette,
} from 'lucide-react';
import { PermissionButton } from './common/PermissionGuard';
import { UserManagementView } from './UserManagementView';

interface ShortcutItem {
  key: string;
  action: string;
  category: 'Navigation' | 'General' | 'POS Billing' | 'Membership Cards' | 'Search';
  description: string;
}

const defaultShortcuts: ShortcutItem[] = [
  // NAVIGATION
  { key: 'Alt + 1', action: 'Dashboard', category: 'Navigation', description: 'Navigate to the main store overview and analytics dashboard' },
  { key: 'Alt + 2', action: 'POS Billing', category: 'Navigation', description: 'Open the active POS checkout workspace' },
  { key: 'Alt + 3', action: 'Products', category: 'Navigation', description: 'Navigate to the active apparel inventory directory' },
  { key: 'Alt + 4', action: 'Customers', category: 'Navigation', description: 'Manage the CRM VIP clients directory' },
  { key: 'Alt + 5', action: 'Suppliers', category: 'Navigation', description: 'Manage external showroom garment suppliers' },
  { key: 'Alt + 6', action: 'Sales Reports', category: 'Navigation', description: 'View full showroom transaction ledger and analytics charts' },
  { key: 'Alt + 7', action: 'Expenses', category: 'Navigation', description: 'Log and analyze business operations expenditure' },
  { key: 'Alt + 8', action: 'Promotions', category: 'Navigation', description: 'Create and distribute active promo codes and percentage off' },
  { key: 'Alt + 9', action: 'Discount Cards', category: 'Navigation', description: 'Issue and audit loyal client discount/membership cards' },
  { key: 'Alt + 0', action: 'Store Settings', category: 'Navigation', description: 'Access brand customization and technical setup modules' },

  // GENERAL
  { key: 'Ctrl + N', action: 'New POS Sale', category: 'General', description: 'Flush current checkout basket and start a new POS transaction' },
  { key: 'Ctrl + D', action: 'Dashboard', category: 'General', description: 'Force direct redirect to the core store statistics panel' },
  { key: 'Ctrl + P', action: 'Products', category: 'General', description: 'Quick jump to view product catalog' },
  { key: 'Ctrl + C', action: 'Customers', category: 'General', description: 'Quick jump to view CRM customer list' },
  { key: 'Ctrl + M', action: 'Membership Cards', category: 'General', description: 'Jump to membership card issuing system' },
  { key: 'Ctrl + R', action: 'Sales Reports', category: 'General', description: 'Quick jump to sales report suite' },
  { key: 'Ctrl + E', action: 'Expenses', category: 'General', description: 'Jump directly to expense ledger' },
  { key: 'Ctrl + T', action: 'Membership Tier Manager', category: 'General', description: 'Toggle membership benefits rule settings' },
  { key: 'Ctrl + Shift + N', action: 'Issue Membership Card', category: 'General', description: 'Open the prompt to issue a new VIP membership' },
  { key: 'Ctrl + Shift + S', action: 'Store Settings', category: 'General', description: 'Instantly load store setup studio' },
  { key: 'Ctrl + Shift + U', action: 'Suppliers', category: 'General', description: 'Jump to garment manufacturer supplier list' },
  { key: 'Ctrl + Shift + F', action: 'Global Search', category: 'General', description: 'Highlight and focus the top navigation multi-search utility' },
  { key: 'Ctrl + Shift + X', action: 'Logout', category: 'General', description: 'Instantly lock showroom panel and exit session' },
  { key: 'Ctrl + K', action: 'Command Palette', category: 'General', description: 'Toggle search utility for global navigation commands' },
  { key: 'Ctrl + /', action: 'Open Shortcut Help', category: 'General', description: 'Display global shortcut keys reference panel' },

  // POS BILLING
  { key: 'F1', action: 'Focus Barcode Input', category: 'POS Billing', description: 'Move focus and highlight input of barcode scan emulator' },
  { key: 'F2', action: 'Customer Search', category: 'POS Billing', description: 'Move cursor focus to search VIP CRM customer phone' },
  { key: 'F3', action: 'Membership Card Scan', category: 'POS Billing', description: 'Move cursor focus to scan/input membership card' },
  { key: 'F4', action: 'Apply Discount', category: 'POS Billing', description: 'Move cursor focus to input active percentage coupon / discount dialog' },
  { key: 'F5', action: 'Hold Bill', category: 'POS Billing', description: 'Temporarily place current shopping basket items on hold queue' },
  { key: 'F6', action: 'Resume Bill', category: 'POS Billing', description: 'Restore a previously held showroom checkout basket' },
  { key: 'F7', action: 'Payment Window', category: 'POS Billing', description: 'Focus the complete checkout payment window button' },
  { key: 'F8', action: 'Cash Payment', category: 'POS Billing', description: 'Instantly select Cash as the active payment method' },
  { key: 'F9', action: 'UPI Payment', category: 'POS Billing', description: 'Instantly select UPI QR as the active payment method' },
  { key: 'F10', action: 'Card Payment', category: 'POS Billing', description: 'Instantly select Credit Card as the active payment method' },
  { key: 'F11', action: 'Close / View Invoice', category: 'POS Billing', description: 'Close active preview or toggle invoice modal dialog' },
  { key: 'F12', action: 'Complete Sale', category: 'POS Billing', description: 'Trigger submission flow to write completed invoice to database' },
  { key: 'Esc', action: 'Close Popup', category: 'POS Billing', description: 'Close any active overlay dialog modal or dismiss receipt' },
  { key: 'Delete', action: 'Remove Selected Item', category: 'POS Billing', description: 'Delete the highlighted item row from checkout basket' },
  { key: 'Ctrl + +', action: 'Increase Quantity', category: 'POS Billing', description: 'Increment quantity of currently selected garment in basket' },
  { key: 'Ctrl + -', action: 'Decrease Quantity', category: 'POS Billing', description: 'Decrement quantity of currently selected garment in basket' },
  { key: 'Ctrl + Backspace', action: 'Clear Cart', category: 'POS Billing', description: 'Wipe all entries and empty current active shopping basket' },

  // MEMBERSHIP CARDS
  { key: 'Ctrl + I', action: 'Issue New Card', category: 'Membership Cards', description: 'Initiate brand new client membership card setup modal' },
  { key: 'Ctrl + Shift + E', action: 'Extend Membership', category: 'Membership Cards', description: 'Extend the expiration period of selected card' },
  { key: 'Ctrl + Shift + R', action: 'Reprint Card', category: 'Membership Cards', description: 'Open high-fidelity layout reprint window' },
  { key: 'Ctrl + Shift + C', action: 'Copy Card Number', category: 'Membership Cards', description: 'Copy selected card number string to operating system clipboard' },
  { key: 'Ctrl + Shift + Q', action: 'Regenerate Barcode', category: 'Membership Cards', description: 'Refresh/rebuild security barcode graphic' },

  // SEARCH
  { key: 'Ctrl + F', action: 'Global Search', category: 'Search', description: 'Trigger top global search dropdown interface' },
  { key: 'Arrow Keys', action: 'Navigate Search Results', category: 'Search', description: 'Move active highlighted row up or down in listing' },
  { key: 'Enter', action: 'Open Selected Result', category: 'Search', description: 'Instantly activate or load the highlighted record' }
];

const generateShortcutGuideHTML = (shortcuts: ShortcutItem[], showroomName: string) => {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const version = "v2.4.0";

  const navCurated = [
    { key: 'ALT + 1', action: 'Dashboard' },
    { key: 'ALT + 2', action: 'POS Billing' },
    { key: 'ALT + 3', action: 'Products' },
    { key: 'ALT + 4', action: 'Customers' },
    { key: 'ALT + 5', action: 'Suppliers' },
    { key: 'ALT + 6', action: 'Sales Reports' },
    { key: 'ALT + 7', action: 'Expenses' },
    { key: 'ALT + 8', action: 'Promotions' },
    { key: 'ALT + 9', action: 'Discount Cards' },
    { key: 'ALT + 0', action: 'Store Settings' }
  ];

  const posCurated = [
    { key: 'F1', action: 'Barcode Input' },
    { key: 'F2', action: 'Customer Search' },
    { key: 'F3', action: 'Membership Scan' },
    { key: 'F4', action: 'Apply Discount' },
    { key: 'F5', action: 'Hold Bill' },
    { key: 'F6', action: 'Resume Bill' },
    { key: 'F7', action: 'Payment Window' },
    { key: 'F8', action: 'Cash Payment' },
    { key: 'F9', action: 'UPI Payment' },
    { key: 'F10', action: 'Card Payment' },
    { key: 'F11', action: 'Print Bill' },
    { key: 'F12', action: 'Complete Sale' },
    { key: 'ESC', action: 'Close Window' },
    { key: 'DELETE', action: 'Remove Item' }
  ];

  const membershipCurated = [
    { key: 'CTRL + I', action: 'Issue Card' },
    { key: 'CTRL + SHIFT + E', action: 'Extend Card' },
    { key: 'CTRL + SHIFT + R', action: 'Reprint Card' },
    { key: 'CTRL + SHIFT + C', action: 'Copy Card Number' },
    { key: 'CTRL + SHIFT + Q', action: 'Regenerate Barcode' }
  ];

  const printingCurated = [
    { key: 'CTRL + SHIFT + P', action: 'Print Bill' },
    { key: 'CTRL + SHIFT + B', action: 'Print Barcode' },
    { key: 'CTRL + SHIFT + L', action: 'Print Membership Card' }
  ];

  const searchCurated = [
    { key: 'CTRL + F', action: 'Global Search' },
    { key: 'Arrow Keys', action: 'Navigate Results' },
    { key: 'ENTER', action: 'Open Selected' }
  ];

  const generalCurated = [
    { key: 'CTRL + N', action: 'New POS' },
    { key: 'CTRL + D', action: 'Dashboard' },
    { key: 'CTRL + P', action: 'Products' },
    { key: 'CTRL + C', action: 'Customers' },
    { key: 'CTRL + R', action: 'Reports' },
    { key: 'CTRL + E', action: 'Expenses' },
    { key: 'CTRL + T', action: 'Membership Tier' },
    { key: 'CTRL + K', action: 'Command Palette' },
    { key: 'CTRL + /', action: 'Shortcut Help' },
    { key: 'CTRL + SHIFT + X', action: 'Logout' }
  ];

  const filterCurated = (curatedList: { key: string, action: string }[], categoryName: string) => {
    return curatedList.filter(c => {
      return shortcuts.some(s => {
        const matchKey = s.key.replace(/\s+/g, '').toLowerCase() === c.key.replace(/\s+/g, '').toLowerCase();
        const matchCat = s.category === categoryName || (categoryName === 'Membership' && s.category === 'Membership Cards');
        return matchKey && matchCat;
      });
    });
  };

  const navigationShortcuts = filterCurated(navCurated, 'Navigation');
  const posShortcuts = filterCurated(posCurated, 'POS Billing');
  const membershipShortcuts = filterCurated(membershipCurated, 'Membership');
  const printingShortcuts = filterCurated(printingCurated, 'Printing');
  const searchShortcuts = filterCurated(searchCurated, 'Search');
  const generalShortcuts = filterCurated(generalCurated, 'General');

  const renderSectionHTML = (title: string, sectionShortcuts: { key: string, action: string }[]) => {
    if (sectionShortcuts.length === 0) return '';
    return `
      <div class="shortcut-section">
        <h3 class="section-title">${title}</h3>
        <div class="section-table-body">
          ${sectionShortcuts.map(s => `
            <div class="shortcut-row">
              <span class="shortcut-key">${s.key}</span>
              <span class="dotted-leader"></span>
              <span class="shortcut-action">${s.action}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  return `
    <div class="pdf-document">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        
        * {
          box-sizing: border-box;
        }

        .pdf-document {
          background: #FFFFFF !important;
          padding: 0;
          margin: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 210mm;
          height: 297mm;
        }
        
        .pdf-page-render {
          width: 210mm;
          height: 297mm;
          padding: 15mm;
          box-sizing: border-box;
          background: #FFFFFF !important;
          color: #000000 !important;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: 'Poppins', sans-serif;
          position: relative;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* HEADER */
        .page-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 2mm;
        }

        .header-brand-title {
          font-family: 'Poppins', sans-serif;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 3px;
          color: #4B5563;
          text-transform: uppercase;
          margin: 0 0 2px 0;
        }
        
        .header-main-title {
          font-family: 'Poppins', sans-serif;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #000000;
          margin: 0 0 2px 0;
        }
        
        .header-sub-desc {
          font-family: 'Poppins', sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: #4B5563;
          margin: 0 0 6px 0;
        }
        
        .header-meta {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: #4B5563;
        }

        /* PREMIUM GOLD DIVIDER */
        .gold-divider {
          height: 1px;
          background: #C8A34A;
          border: none;
          margin: 1mm 0 4mm 0;
          width: 100%;
        }
        
        /* TWO COLUMNS CONTENT GRID */
        .content-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12mm;
          flex-grow: 1;
          height: auto;
          overflow: hidden;
          margin-top: 2px;
          z-index: 10;
        }
        
        .grid-col {
          display: flex;
          flex-direction: column;
          gap: 6mm;
        }

        /* SECTION STYLE */
        .shortcut-section {
          display: flex;
          flex-direction: column;
        }

        .section-title {
          font-family: 'Poppins', sans-serif;
          font-size: 13px;
          font-weight: 800;
          color: #C8A34A !important;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid #C8A34A;
        }

        .section-table-body {
          display: flex;
          flex-direction: column;
        }

        .shortcut-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 1.5px 0;
          border-bottom: none;
          width: 100%;
        }

        .shortcut-key {
          font-family: 'JetBrains Mono', monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #000000 !important;
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .dotted-leader {
          flex-grow: 1;
          border-bottom: 1px dotted #9CA3AF;
          margin: 0 4px;
          height: 1px;
          align-self: flex-end;
          margin-bottom: 3px;
        }

        .shortcut-action {
          font-family: 'Poppins', sans-serif;
          font-size: 8.5px;
          font-weight: 400;
          color: #111827 !important;
          text-align: right;
          white-space: nowrap;
          flex-shrink: 0;
        }
        
        /* FOOTER */
        .page-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 8mm;
          border-top: 1px solid #E5E7EB;
          padding-top: 6px;
          font-family: 'Poppins', sans-serif;
          font-size: 8px;
          color: #4B5563;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          z-index: 10;
        }
        
        .footer-left {
          font-weight: 600;
          color: #4B5563;
        }
        
        .footer-center {
          letter-spacing: 1px;
          font-weight: 700;
          color: #4B5563;
        }
        
        .footer-right {
          font-weight: 600;
          color: #4B5563;
        }
      </style>
      
      <div class="pdf-page-render">
        <!-- Header -->
        <div class="page-header">
          <div class="header-brand-title">SMART FASHION</div>
          <h1 class="header-main-title">Keyboard Shortcut Guide</h1>
          <p class="header-sub-desc">Luxury Showroom Management System</p>
          <div class="header-meta">Version 2.4.6 | Generated: 07 Jul 2026</div>
        </div>
        
        <!-- Premium Divider -->
        <hr class="gold-divider" />
        
        <!-- Content Grid -->
        <div class="content-grid">
          <div class="grid-col">
            ${renderSectionHTML('NAVIGATION', navigationShortcuts)}
            ${renderSectionHTML('POS BILLING', posShortcuts)}
            ${renderSectionHTML('MEMBERSHIP', membershipShortcuts)}
          </div>
          <div class="grid-col">
            ${renderSectionHTML('PRINTING', printingShortcuts)}
            ${renderSectionHTML('SEARCH', searchShortcuts)}
            ${renderSectionHTML('GENERAL', generalShortcuts)}
          </div>
        </div>
        
        <!-- Footer -->
        <div class="page-footer">
          <span class="footer-left">Smart Fashion Showroom Management System</span>
          <span class="footer-center">Keyboard Shortcut Reference</span>
          <span class="footer-right">Confidential – Internal Use Only</span>
        </div>
      </div>
    </div>
  `;
};

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateStoreProfile, 
    updateInvoicePrefix, 
    changeAdminPin, 
    resetDatabase, 
    restoreDatabaseState, 
    backupData, 
    updateStoreBranding,
    updateTheme,
    lastMembershipSerial,
    updateLastMembershipSerial,
    updateExchangePolicySettings
  } = useAppState();

  // Tab state
  const [activeTab, setActiveTab] = useState<'financials' | 'users' | 'security' | 'membership' | 'shortcuts' | 'exchange'>(() => {
    if (window.location.hash.includes('settings/users') || window.location.hash.includes('settings/user-management')) {
      return 'users';
    }
    if (window.location.hash.includes('settings/membership')) {
      return 'membership';
    }
    if (window.location.hash.includes('settings/shortcuts')) {
      return 'shortcuts';
    }
    if (window.location.hash.includes('settings/exchange')) {
      return 'exchange';
    }
    return 'financials';
  });

  // Exchange Policy States
  const [exchangeEnabled, setExchangeEnabled] = useState(settings.exchangePolicy?.enabled ?? true);
  const [exchangePeriod, setExchangePeriod] = useState(settings.exchangePolicy?.exchangePeriodDays ?? 7);
  const [exchangeInvoiceRequired, setExchangeInvoiceRequired] = useState(settings.exchangePolicy?.originalInvoiceRequired ?? true);
  const [exchangeTagsRequired, setExchangeTagsRequired] = useState(settings.exchangePolicy?.originalTagsRequired ?? true);
  const [exchangeUnusedRequired, setExchangeUnusedRequired] = useState(settings.exchangePolicy?.productMustBeUnused ?? true);
  const [exchangeDiscountedAllowed, setExchangeDiscountedAllowed] = useState(settings.exchangePolicy?.discountedProductsExchange ?? false);
  const [exchangePromoAllowed, setExchangePromoAllowed] = useState(settings.exchangePolicy?.promotionalProductsExchange ?? false);
  const [exchangeRefundAllowed, setExchangeRefundAllowed] = useState(settings.exchangePolicy?.refundAllowed ?? false);
  const [exchangeOnly, setExchangeOnlyState] = useState(settings.exchangePolicy?.exchangeOnly ?? true);
  const [exchangeProductsPolicyText, setExchangeProductsPolicyText] = useState(
    settings.exchangePolicy?.productsPolicyText ?? settings.exchangePolicy?.customPolicyText ?? ''
  );
  const [exchangeFabricsPolicyText, setExchangeFabricsPolicyText] = useState(
    settings.exchangePolicy?.fabricsPolicyText ?? ''
  );

  useEffect(() => {
    if (settings.exchangePolicy) {
      setExchangeEnabled(settings.exchangePolicy.enabled);
      setExchangePeriod(settings.exchangePolicy.exchangePeriodDays);
      setExchangeInvoiceRequired(settings.exchangePolicy.originalInvoiceRequired);
      setExchangeTagsRequired(settings.exchangePolicy.originalTagsRequired);
      setExchangeUnusedRequired(settings.exchangePolicy.productMustBeUnused);
      setExchangeDiscountedAllowed(settings.exchangePolicy.discountedProductsExchange);
      setExchangePromoAllowed(settings.exchangePolicy.promotionalProductsExchange);
      setExchangeRefundAllowed(settings.exchangePolicy.refundAllowed);
      setExchangeOnlyState(settings.exchangePolicy.exchangeOnly);
      setExchangeProductsPolicyText(
        settings.exchangePolicy.productsPolicyText !== undefined
          ? settings.exchangePolicy.productsPolicyText
          : (settings.exchangePolicy.customPolicyText ?? '')
      );
      setExchangeFabricsPolicyText(settings.exchangePolicy.fabricsPolicyText ?? '');
    }
  }, [settings.exchangePolicy]);

  const handleExchangePolicySave = (e: React.FormEvent) => {
    e.preventDefault();
    updateExchangePolicySettings({
      enabled: exchangeEnabled,
      exchangePeriodDays: Number(exchangePeriod),
      originalInvoiceRequired: exchangeInvoiceRequired,
      originalTagsRequired: exchangeTagsRequired,
      productMustBeUnused: exchangeUnusedRequired,
      discountedProductsExchange: exchangeDiscountedAllowed,
      promotionalProductsExchange: exchangePromoAllowed,
      refundAllowed: exchangeRefundAllowed,
      exchangeOnly: exchangeOnly,
      productsPolicyText: exchangeProductsPolicyText,
      fabricsPolicyText: exchangeFabricsPolicyText,
      customPolicyText: exchangeProductsPolicyText,
    });
    showToast('Exchange Policy saved persistently!', 'success');
  };

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash.includes('settings/users') || window.location.hash.includes('settings/user-management')) {
        setActiveTab('users');
      } else if (window.location.hash.includes('settings/membership')) {
        setActiveTab('membership');
      } else if (window.location.hash.includes('settings/shortcuts')) {
        setActiveTab('shortcuts');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Core profile state (kept sync with Settings)
  const [storeName, setStoreName] = useState(settings.storeProfile.name);
  const [storeAddress, setStoreAddress] = useState(settings.storeProfile.address);
  const [storePhone, setStorePhone] = useState(settings.storeProfile.phone);
  const [storeGstin, setStoreGstin] = useState(settings.storeProfile.gstin);
  const [gstRate, setGstRate] = useState(settings.storeProfile.defaultGstRate);
  const [vipDiscountPercentage, setVipDiscountPercentage] = useState(settings.storeProfile.platinumDiscountPercentage ?? (settings.storeProfile as any).vipDiscountPercentage ?? 20);
  const [storeOpeningDate, setStoreOpeningDate] = useState(settings.storeProfile.openingDate || '15/03/2026');
  const [membershipValidity, setMembershipValidity] = useState<number>(settings.storeProfile.membershipValidityMonths || 12);
  const [adminSerialNum, setAdminSerialNum] = useState(lastMembershipSerial);
  const [upiId, setUpiId] = useState(settings.storeProfile.upiId || '');
  const [upiDisplayName, setUpiDisplayName] = useState(settings.storeProfile.upiDisplayName || '');

  // Editable brand information state (RIGHT PANEL)
  const [editBrandTagline, setEditBrandTagline] = useState(settings.storeProfile.tagline ?? "Bespoke Men's Tailoring");
  const [editWebsite, setEditWebsite] = useState(settings.storeProfile.website ?? 'www.smartfashion.com');
  const [editEmail, setEditEmail] = useState(settings.storeProfile.email ?? 'concierge@smartfashion.com');

  // Theme state
  const [previewTheme, setPreviewTheme] = useState<'luxury' | 'light'>(settings.theme || 'luxury');

  // Store branding & logo states
  const branding = settings.storeBranding || {
    primaryColor: '#050505',
    secondaryColor: '#1c1917',
    accentColor: '#d4af37',
  };

  // Editable preferences states (RIGHT PANEL)
  const [editPrimaryColor, setEditPrimaryColor] = useState(branding.primaryColor ?? '#050505');
  const [editSecondaryColor, setEditSecondaryColor] = useState(branding.secondaryColor ?? '#1c1917');
  const [editAccentColor, setEditAccentColor] = useState(branding.accentColor ?? '#d4af37');

  // Toast states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Card background template states
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [uploadProgressFront, setUploadProgressFront] = useState<number | null>(null);
  const [uploadProgressBack, setUploadProgressBack] = useState<number | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Keyboard Shortcut Documentation Tab States
  const [shortcutSearch, setShortcutSearch] = useState('');
  const [shortcutFilter, setShortcutFilter] = useState<'All' | 'Navigation' | 'POS' | 'Membership' | 'Search'>('All');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Ref to track last synced settings string to prevent redundant resets during local typing
  const lastSyncedSettingsRef = useRef<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync inputs when settings change in background
  useEffect(() => {
    const settingsStr = JSON.stringify(settings);
    if (settingsStr === lastSyncedSettingsRef.current) {
      return;
    }
    lastSyncedSettingsRef.current = settingsStr;

    setStoreName(settings.storeProfile.name);
    setStoreAddress(settings.storeProfile.address);
    setStorePhone(settings.storeProfile.phone);
    setStoreGstin(settings.storeProfile.gstin);
    setGstRate(settings.storeProfile.defaultGstRate);
    setVipDiscountPercentage(settings.storeProfile.platinumDiscountPercentage ?? (settings.storeProfile as any).vipDiscountPercentage ?? 20);
    setStoreOpeningDate(settings.storeProfile.openingDate || '15/03/2026');
    setMembershipValidity(settings.storeProfile.membershipValidityMonths || 12);
    setUpiId(settings.storeProfile.upiId || '');
    setUpiDisplayName(settings.storeProfile.upiDisplayName || '');

    setEditBrandTagline(settings.storeProfile.tagline ?? "Bespoke Men's Tailoring");
    setEditWebsite(settings.storeProfile.website ?? 'www.smartfashion.com');
    setEditEmail(settings.storeProfile.email ?? 'concierge@smartfashion.com');

    const b = settings.storeBranding || {
      primaryColor: '#050505',
      secondaryColor: '#1c1917',
      accentColor: '#d4af37',
    };

    setEditPrimaryColor(b.primaryColor ?? '#050505');
    setEditSecondaryColor(b.secondaryColor ?? '#1c1917');
    setEditAccentColor(b.accentColor ?? '#d4af37');
  }, [settings]);

  useEffect(() => {
    setAdminSerialNum(lastMembershipSerial);
  }, [lastMembershipSerial]);

  // Membership local settings & database integration
  const {
    membershipTypes,
    membershipDiscountRules,
    updateMembershipType,
    addMembershipDiscountRule,
    deleteMembershipDiscountRule,
    reorderMembershipDiscountRules,
    membershipBenefits,
    addMembershipBenefit,
    updateMembershipBenefit,
    deleteMembershipBenefit,
    reorderMembershipBenefits,
  } = useAppState();

  const [selectedTypeId, setSelectedTypeId] = useState<string>('Silver');

  // Form states for adding threshold rules
  const [newRuleMinPurchase, setNewRuleMinPurchase] = useState<number>(0);
  const [newRuleDiscountPct, setNewRuleDiscountPct] = useState<number>(5);
  const [newRuleMaxDiscount, setNewRuleMaxDiscount] = useState<number>(1000);

  const activeType = membershipTypes.find(t => t.id === selectedTypeId) || membershipTypes[0];

  const [typeName, setTypeName] = useState('');
  const [typeColor, setTypeColor] = useState('');
  const [typeStatus, setTypeStatus] = useState<'active' | 'inactive'>('active');
  const [typeValidity, setTypeValidity] = useState<number>(12);
  const [typeMaxPerBill, setTypeMaxPerBill] = useState<number>(0);
  const [typeMaxMonthly, setTypeMaxMonthly] = useState<number>(0);
  const [typeMaxYearly, setTypeMaxYearly] = useState<number>(0);
  const [typeMinPurchase, setTypeMinPurchase] = useState<number>(0);

  // Perks
  const [perkFestival, setPerkFestival] = useState(false);
  const [perkBirthday, setPerkBirthday] = useState(false);
  const [perkAnniversary, setPerkAnniversary] = useState(false);
  const [perkSpecial, setPerkSpecial] = useState(false);
  const [perkExclusive, setPerkExclusive] = useState(false);
  const [perkAlteration, setPerkAlteration] = useState(false);
  const [perkDelivery, setPerkDelivery] = useState(false);
  const [perkBilling, setPerkBilling] = useState(false);

  // Load selected card fields on select change
  useEffect(() => {
    if (activeType) {
      setTypeName(activeType.name);
      setTypeColor(activeType.color);
      setTypeStatus(activeType.status);
      setTypeValidity(activeType.validityMonths);
      setTypeMaxPerBill(activeType.maxDiscountPerBill || 0);
      setTypeMaxMonthly(activeType.maxMonthlyDiscount || 0);
      setTypeMaxYearly(activeType.maxYearlyDiscount || 0);
      setTypeMinPurchase(activeType.minPurchaseAmount || 0);

      setPerkFestival(!!activeType.festivalDiscount);
      setPerkBirthday(!!activeType.birthdayDiscount);
      setPerkAnniversary(!!activeType.anniversaryDiscount);
      setPerkSpecial(!!activeType.specialMemberDiscount);
      setPerkExclusive(!!activeType.exclusiveSaleAccess);
      setPerkAlteration(!!activeType.freeAlteration);
      setPerkDelivery(!!activeType.freeDelivery);
      setPerkBilling(!!activeType.priorityBilling);
    }
  }, [selectedTypeId, membershipTypes]);

  const handleSaveMembershipType = (e: React.FormEvent) => {
    e.preventDefault();
    updateMembershipType(selectedTypeId, {
      name: typeName,
      color: typeColor,
      status: typeStatus,
      validityMonths: Number(typeValidity),
      maxDiscountPerBill: Number(typeMaxPerBill),
      maxMonthlyDiscount: Number(typeMaxMonthly),
      maxYearlyDiscount: Number(typeMaxYearly),
      minPurchaseAmount: Number(typeMinPurchase),
      festivalDiscount: perkFestival,
      birthdayDiscount: perkBirthday,
      anniversaryDiscount: perkAnniversary,
      specialMemberDiscount: perkSpecial,
      exclusiveSaleAccess: perkExclusive,
      freeAlteration: perkAlteration,
      freeDelivery: perkDelivery,
      priorityBilling: perkBilling,
    });
    showToast(`${typeName} tier benefit parameters updated successfully!`, 'success');
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRuleMinPurchase < 0 || newRuleDiscountPct <= 0 || newRuleDiscountPct > 100) {
      showToast('Please enter valid discount rule details. Percentage must be between 1 and 100.', 'error');
      return;
    }
    addMembershipDiscountRule({
      membershipTypeId: selectedTypeId,
      minPurchase: Number(newRuleMinPurchase),
      discountPercentage: Number(newRuleDiscountPct),
      maxDiscountAmount: Number(newRuleMaxDiscount),
      order: membershipDiscountRules.filter(r => r.membershipTypeId === selectedTypeId).length,
    });
    setNewRuleMinPurchase(0);
    setNewRuleDiscountPct(5);
    setNewRuleMaxDiscount(1000);
    showToast('Shopping threshold discount rule added.', 'success');
  };

  const handleRuleMoveUp = (ruleId: string) => {
    const rulesForType = membershipDiscountRules
      .filter(r => r.membershipTypeId === selectedTypeId)
      .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    
    const idx = rulesForType.findIndex(r => r.id === ruleId);
    if (idx > 0) {
      const reordered = [...rulesForType];
      const temp = reordered[idx];
      reordered[idx] = reordered[idx - 1];
      reordered[idx - 1] = temp;
      reorderMembershipDiscountRules(selectedTypeId, reordered);
      showToast('Threshold rule order updated.', 'success');
    }
  };

  const handleRuleMoveDown = (ruleId: string) => {
    const rulesForType = membershipDiscountRules
      .filter(r => r.membershipTypeId === selectedTypeId)
      .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    
    const idx = rulesForType.findIndex(r => r.id === ruleId);
    if (idx < rulesForType.length - 1 && idx !== -1) {
      const reordered = [...rulesForType];
      const temp = reordered[idx];
      reordered[idx] = reordered[idx + 1];
      reordered[idx + 1] = temp;
      reorderMembershipDiscountRules(selectedTypeId, reordered);
      showToast('Threshold rule order updated.', 'success');
    }
  };

  // Dynamic Benefit states
  const [isBenefitModalOpen, setIsBenefitModalOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<any | null>(null);
  const [benefitName, setBenefitName] = useState('');
  const [benefitDescription, setBenefitDescription] = useState('');
  const [benefitIcon, setBenefitIcon] = useState('Sparkles');
  const [benefitType, setBenefitType] = useState<'Discount' | 'Service' | 'Access' | 'Offer' | 'Gift' | 'Delivery' | 'Alteration' | 'Custom'>('Custom');
  const [benefitStatus, setBenefitStatus] = useState<'active' | 'inactive'>('active');
  const [benefitShowOnCard, setBenefitShowOnCard] = useState(true);

  const handleOpenAddBenefit = () => {
    setEditingBenefit(null);
    setBenefitName('');
    setBenefitDescription('');
    setBenefitIcon('Sparkles');
    setBenefitType('Custom');
    setBenefitStatus('active');
    setBenefitShowOnCard(true);
    setIsBenefitModalOpen(true);
  };

  const handleOpenEditBenefit = (b: any) => {
    setEditingBenefit(b);
    setBenefitName(b.benefitName);
    setBenefitDescription(b.description);
    setBenefitIcon(b.icon);
    setBenefitType(b.type);
    setBenefitStatus(b.status);
    setBenefitShowOnCard(b.showOnCard);
    setIsBenefitModalOpen(true);
  };

  const handleDuplicateBenefit = (b: any) => {
    const benefitsForType = membershipBenefits.filter(x => x.tierId === selectedTypeId);
    addMembershipBenefit({
      tierId: selectedTypeId,
      benefitName: `Copy of ${b.benefitName}`,
      description: b.description,
      icon: b.icon,
      type: b.type,
      status: b.status,
      showOnCard: b.showOnCard,
      displayOrder: benefitsForType.length,
    });
    showToast('Benefit duplicated successfully.', 'success');
  };

  const handleSaveBenefit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!benefitName.trim()) {
      showToast('Benefit Name is required.', 'error');
      return;
    }
    if (!benefitDescription.trim()) {
      showToast('Description is required.', 'error');
      return;
    }

    if (editingBenefit) {
      updateMembershipBenefit(editingBenefit.id, {
        benefitName,
        description: benefitDescription,
        icon: benefitIcon,
        type: benefitType,
        status: benefitStatus,
        showOnCard: benefitShowOnCard,
      });
      showToast('Benefit updated successfully.', 'success');
    } else {
      const benefitsForType = membershipBenefits.filter(x => x.tierId === selectedTypeId);
      addMembershipBenefit({
        tierId: selectedTypeId,
        benefitName,
        description: benefitDescription,
        icon: benefitIcon,
        type: benefitType,
        status: benefitStatus,
        showOnCard: benefitShowOnCard,
        displayOrder: benefitsForType.length,
      });
      showToast('Benefit added successfully.', 'success');
    }
    setIsBenefitModalOpen(false);
  };

  const handleBenefitMoveUp = (benefitId: string) => {
    const benefitsForType = membershipBenefits
      .filter(b => b.tierId === selectedTypeId)
      .sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    
    const idx = benefitsForType.findIndex(b => b.id === benefitId);
    if (idx > 0) {
      const reordered = [...benefitsForType];
      const temp = reordered[idx];
      reordered[idx] = reordered[idx - 1];
      reordered[idx - 1] = temp;
      reorderMembershipBenefits(selectedTypeId, reordered);
      showToast('Benefit sequence updated.', 'success');
    }
  };

  const handleBenefitMoveDown = (benefitId: string) => {
    const benefitsForType = membershipBenefits
      .filter(b => b.tierId === selectedTypeId)
      .sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    
    const idx = benefitsForType.findIndex(b => b.id === benefitId);
    if (idx < benefitsForType.length - 1 && idx !== -1) {
      const reordered = [...benefitsForType];
      const temp = reordered[idx];
      reordered[idx] = reordered[idx + 1];
      reordered[idx + 1] = temp;
      reorderMembershipBenefits(selectedTypeId, reordered);
      showToast('Benefit sequence updated.', 'success');
    }
  };

  const handleCardFrontSelect = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/avif'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isAvifExt = fileExt === '.avif';
    if (!allowedTypes.includes(file.type) && !isAvifExt) {
      showToast('Unsupported file type. Please upload a PNG, JPG, SVG, WEBP, or AVIF image.', 'error');
      return;
    }

    setIsUploadingFront(true);
    setUploadProgressFront(0);

    const formData = new FormData();
    formData.append('logo', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgressFront(percentComplete);
      }
    };

    const formattedSize = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

    xhr.onload = () => {
      setIsUploadingFront(false);
      setUploadProgressFront(null);

      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.url) {
            const currentBranding = settings.storeBranding || {
              showLogoOnInvoice: true,
              showLogoOnCard: true,
              printLogoSize: 'medium' as const,
            };

            const updated = {
              ...currentBranding,
              cardFrontTemplate: response.url,
              cardFrontTemplateFileName: file.name,
              cardFrontTemplateFileSize: formattedSize,
            };

            updateStoreBranding(updated);
            showToast('Platinum Card FRONT template uploaded and optimized successfully!', 'success');
          } else {
            showToast('Invalid response from server.', 'error');
          }
        } catch (e: any) {
          showToast('Failed to parse upload response.', 'error');
        }
      } else {
        showToast(`Upload failed with status code ${xhr.status}`, 'error');
      }
    };

    xhr.onerror = () => {
      setIsUploadingFront(false);
      setUploadProgressFront(null);
      showToast('Network error occurred during template upload.', 'error');
    };

    xhr.send(formData);
  };

  const handleCardBackSelect = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/avif'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isAvifExt = fileExt === '.avif';
    if (!allowedTypes.includes(file.type) && !isAvifExt) {
      showToast('Unsupported file type. Please upload a PNG, JPG, SVG, WEBP, or AVIF image.', 'error');
      return;
    }

    setIsUploadingBack(true);
    setUploadProgressBack(0);

    const formData = new FormData();
    formData.append('logo', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgressBack(percentComplete);
      }
    };

    const formattedSize = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

    xhr.onload = () => {
      setIsUploadingBack(false);
      setUploadProgressBack(null);

      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.url) {
            const currentBranding = settings.storeBranding || {
              showLogoOnInvoice: true,
              showLogoOnCard: true,
              printLogoSize: 'medium' as const,
            };

            const updated = {
              ...currentBranding,
              cardBackTemplate: response.url,
              cardBackTemplateFileName: file.name,
              cardBackTemplateFileSize: formattedSize,
            };

            updateStoreBranding(updated);
            showToast('Platinum Card BACK template uploaded and optimized successfully!', 'success');
          } else {
            showToast('Invalid response from server.', 'error');
          }
        } catch (e: any) {
          showToast('Failed to parse upload response.', 'error');
        }
      } else {
        showToast(`Upload failed with status code ${xhr.status}`, 'error');
      }
    };

    xhr.onerror = () => {
      setIsUploadingBack(false);
      setUploadProgressBack(null);
      showToast('Network error occurred during template upload.', 'error');
    };

    xhr.send(formData);
  };

  const handleRemoveCardFront = async () => {
    if (confirm('Are you sure you want to remove the custom Platinum Card Front template? The template-based SVG recreation will be restored.')) {
      const url = settings.storeBranding?.cardFrontTemplate;

      const currentBranding = settings.storeBranding || {
        showLogoOnInvoice: true,
        showLogoOnCard: true,
        printLogoSize: 'medium' as const,
      };
      const updated = {
        ...currentBranding,
        cardFrontTemplate: undefined,
        cardFrontTemplateFileName: undefined,
        cardFrontTemplateFileSize: undefined,
      };
      updateStoreBranding(updated);

      if (url && url.startsWith('/uploads/')) {
        try {
          await fetch('/api/upload/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });
        } catch (err) {
          console.error('Error deleting card template from server:', err);
        }
      }

      showToast('Platinum Card Front template removed and default restored.', 'success');
    }
  };

  const handleRemoveCardBack = async () => {
    if (confirm('Are you sure you want to remove the custom Platinum Card Back template? The template-based SVG recreation will be restored.')) {
      const url = settings.storeBranding?.cardBackTemplate;

      const currentBranding = settings.storeBranding || {
        showLogoOnInvoice: true,
        showLogoOnCard: true,
        printLogoSize: 'medium' as const,
      };
      const updated = {
        ...currentBranding,
        cardBackTemplate: undefined,
        cardBackTemplateFileName: undefined,
        cardBackTemplateFileSize: undefined,
      };
      updateStoreBranding(updated);

      if (url && url.startsWith('/uploads/')) {
        try {
          await fetch('/api/upload/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });
        } catch (err) {
          console.error('Error deleting card template from server:', err);
        }
      }

      showToast('Platinum Card Back template removed and default restored.', 'success');
    }
  };



  // Invoice fields
  const [invoicePrefix, setInvoicePrefix] = useState(settings.storeProfile.invoicePrefix || '');

  // Security pin fields
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [securityStatus, setSecurityStatus] = useState('');

  // Drag and drop / Backup fields
  const [dragActive, setDragActive] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState('');

  const handleProfileSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Validate Form Inputs
    const errors: Record<string, string> = {};

    if (!storeName || storeName.trim().length < 3) {
      errors.storeName = 'Showroom Name is required and must be at least 3 characters.';
    }

    if (!storePhone || !/^\+?[0-9\s\-()]{10,20}$/.test(storePhone.trim())) {
      errors.storePhone = 'Valid Phone Number is required (at least 10 digits).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editEmail || !emailRegex.test(editEmail.trim())) {
      errors.editEmail = 'Valid Email Address is required (e.g. name@domain.com).';
    }

    // India GSTIN: 15 alphanumeric characters
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/;
    if (!storeGstin || !gstinRegex.test(storeGstin.trim().toUpperCase())) {
      errors.storeGstin = 'Valid GST Number is required (15 characters: e.g. 22AAAAA1111A1Z1).';
    }

    if (!storeAddress || storeAddress.trim().length < 10) {
      errors.storeAddress = 'Complete Address is required (at least 10 characters).';
    }

    // Store Opening Date DD/MM/YYYY
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!storeOpeningDate || !dateRegex.test(storeOpeningDate.trim())) {
      errors.storeOpeningDate = 'Store Opening Date is required in DD/MM/YYYY format (e.g., 15/03/2026).';
    } else {
      const parts = storeOpeningDate.split('/');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const testDate = new Date(y, m, d);
      if (testDate.getFullYear() !== y || testDate.getMonth() !== m || testDate.getDate() !== d) {
        errors.storeOpeningDate = 'Please enter a valid calendar date.';
      }
    }

    if (!membershipValidity || membershipValidity < 1 || membershipValidity > 120) {
      errors.membershipValidity = 'Membership Validity is required and must be between 1 and 120 months.';
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast('Please correct the validation errors in the form.', 'error');
      return;
    }

    // 2. Prevent duplicate submissions / Set isSaving to true
    setIsSaving(true);

    // 3. Save updates
    updateStoreProfile({
      ...settings.storeProfile,
      name: storeName.trim(),
      address: storeAddress.trim(),
      phone: storePhone.trim(),
      email: editEmail.trim(),
      gstin: storeGstin.trim().toUpperCase(),
      tagline: editBrandTagline.trim(),
      website: editWebsite.trim(),
      defaultGstRate: Number(gstRate),
      platinumDiscountPercentage: Number(vipDiscountPercentage),
      openingDate: storeOpeningDate.trim(),
      invoicePrefix: invoicePrefix,
      membershipValidityMonths: Number(membershipValidity),
      upiId: upiId.trim(),
      upiDisplayName: upiDisplayName.trim(),
    });

    updateStoreBranding({
      ...(settings.storeBranding || {}),
      primaryColor: editPrimaryColor || '#050505',
      secondaryColor: editSecondaryColor || '#1c1917',
      accentColor: editAccentColor || '#d4af37',
    });

    updateLastMembershipSerial(Number(adminSerialNum));
    if (previewTheme !== settings.theme) {
      updateTheme(previewTheme);
    }

    // 4. Simulate a small async saving operation, then reset isSaving & show toast
    setTimeout(() => {
      setIsSaving(false);
      showToast('Business Information Updated Successfully.', 'success');
    }, 600);
  };

  const handleResetSerial = () => {
    if (window.confirm('Are you absolutely sure you want to reset the membership serial number? This can cause newly generated card numbers to overlap with existing ones.')) {
      setAdminSerialNum(0);
      updateLastMembershipSerial(0);
      alert('Membership serial number reset to 0.');
    }
  };

  const handlePrefixSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateInvoicePrefix(invoicePrefix.trim().toUpperCase());
    alert('Invoice serial prefixes saved.');
  };

  const handlePinUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityStatus('');
    if (newPin.length !== 6 || isNaN(Number(newPin))) {
      setSecurityStatus('New security PIN must be exactly 6 digits.');
      return;
    }

    const ok = changeAdminPin(oldPin, newPin);
    if (ok) {
      setSecurityStatus('PIN security keys updated.');
      setOldPin('');
      setNewPin('');
    } else {
      setSecurityStatus('Current security PIN verification failed.');
    }
  };

  // Compile JSON download
  const handleDownloadBackup = () => {
    try {
      const backupString = backupData();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(backupString);
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `smart_fashion_showroom_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Export error: ${err.message || err}`);
    }
  };

  // Drag and drop loaders
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processBackupFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processBackupFile(e.target.files[0]);
    }
  };

  const processBackupFile = (file: File) => {
    setRestoreFeedback('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.products || !json.invoices) {
          throw new Error('JSON format invalid. Missing core schemas.');
        }

        restoreDatabaseState(json);
        setRestoreFeedback('Database successfully restored. Reloading viewport...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        setRestoreFeedback(`Verification error: ${err.message || 'Malformed file structure'}`);
      }
    };
    reader.readAsText(file);
  };

  const triggerReset = () => {
    if (confirm('CRITICAL WARN: This will wipe all POS sales invoices, custom garment inventory lists, and linked customers, resetting the showroom state. Continue?')) {
      resetDatabase();
      window.location.reload();
    }
  };

  // Discard local changes and revert to saved settings
  const handleCancel = () => {
    setStoreName(settings.storeProfile.name);
    setEditBrandTagline(settings.storeProfile.tagline ?? "Bespoke Men's Tailoring");
    setEditWebsite(settings.storeProfile.website ?? 'www.smartfashion.com');
    setEditEmail(settings.storeProfile.email ?? 'concierge@smartfashion.com');
    setStorePhone(settings.storeProfile.phone);
    setStoreGstin(settings.storeProfile.gstin);
    setStoreAddress(settings.storeProfile.address);
    setGstRate(settings.storeProfile.defaultGstRate);
    setVipDiscountPercentage(settings.storeProfile.platinumDiscountPercentage ?? (settings.storeProfile as any).vipDiscountPercentage ?? 20);
    setStoreOpeningDate(settings.storeProfile.openingDate || '15/03/2026');
    setMembershipValidity(settings.storeProfile.membershipValidityMonths || 12);
    setAdminSerialNum(lastMembershipSerial);
    setInvoicePrefix(settings.storeProfile.invoicePrefix || '');
    setUpiId(settings.storeProfile.upiId || '');
    setUpiDisplayName(settings.storeProfile.upiDisplayName || '');

    const b = settings.storeBranding || {
      primaryColor: '#050505',
      secondaryColor: '#1c1917',
      accentColor: '#d4af37',
    };

    setEditPrimaryColor(b.primaryColor ?? '#050505');
    setEditSecondaryColor(b.secondaryColor ?? '#1c1917');
    setEditAccentColor(b.accentColor ?? '#d4af37');
    setPreviewTheme(settings.theme || 'luxury');

    showToast('Unsaved changes discarded.', 'info');
  };

  // Reset inputs to template default presets
  const handleReset = () => {
    setStoreName('SMART FASHION');
    setEditBrandTagline("Bespoke Men's Tailoring");
    setEditWebsite('www.smartfashion.com');
    setEditEmail('concierge@smartfashion.com');
    setStorePhone('+1 (555) 019-2834');
    setStoreGstin('22AAAAA1111A1Z1');
    setStoreAddress('Milan Galleria, Sector 4, Corso Vittorio Emanuele II, Italy');
    setGstRate(12);
    setVipDiscountPercentage(20);
    setStoreOpeningDate('15/03/2026');
    setAdminSerialNum(0);
    setInvoicePrefix('SF/2026/');
    setUpiId('example@upi');
    setUpiDisplayName('Smart Fashion');

    setEditPrimaryColor('#050505');
    setEditSecondaryColor('#1c1917');
    setEditAccentColor('#d4af37');
    setPreviewTheme('luxury');

    showToast('Brand preferences and compliance reset to template defaults.', 'info');
  };

  const getFilteredShortcuts = () => {
    return defaultShortcuts.filter(item => {
      const matchesCategory = 
        shortcutFilter === 'All' ||
        (shortcutFilter === 'Navigation' && item.category === 'Navigation') ||
        (shortcutFilter === 'POS' && item.category === 'POS Billing') ||
        (shortcutFilter === 'Membership' && item.category === 'Membership Cards') ||
        (shortcutFilter === 'Search' && item.category === 'Search');
        
      const term = shortcutSearch.toLowerCase();
      const matchesSearch = 
        !term ||
        item.key.toLowerCase().includes(term) ||
        item.action.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term);
        
      return matchesCategory && matchesSearch;
    });
  };

  const handleExportPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      
      const visibleShortcuts = getFilteredShortcuts();
      
      // Create off-screen container for rendering
      const pdfContainer = document.createElement('div');
      pdfContainer.id = 'pdf-temp-export-area';
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '210mm'; // standard A4 portrait width
      pdfContainer.style.height = '297mm'; // standard A4 portrait height
      pdfContainer.style.background = '#FFFFFF';
      pdfContainer.style.boxSizing = 'border-box';
      
      pdfContainer.innerHTML = generateShortcutGuideHTML(visibleShortcuts, storeName);
      document.body.appendChild(pdfContainer);
      
      // Give DOM time to update and fonts to load
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const canvas = await html2canvas(pdfContainer, {
        scale: 2, // Retinal high resolution
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      const fileName = `SmartFashion_KeyboardShortcuts_${formattedDate}.pdf`;
      
      pdf.save(fileName);
      
      // Cleanup
      if (document.body.contains(pdfContainer)) {
        document.body.removeChild(pdfContainer);
      }
      
      setIsGeneratingPDF(false);
      showToast('PDF exported successfully.', 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      setIsGeneratingPDF(false);
      showToast('Unable to generate document. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6" id="settings-view-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" /> Showroom Setup Studio
          </h1>
          <p className="text-xs text-slate-400">Calibrate brand design parameters, billing compliance taxes, key locks, and database actions.</p>
        </div>
      </div>

      {/* Luxury Enterprise Dashboard Tab Selector */}
      <div className="flex border-b border-slate-900 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('financials')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 relative cursor-pointer ${
            activeTab === 'financials'
              ? 'text-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Building className="w-4 h-4" />
          Showroom Profile
          {activeTab === 'financials' && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
          )}
        </button>

        <button
          type="button"
          id="tab-btn-user-management"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 relative cursor-pointer ${
            activeTab === 'users'
              ? 'text-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Lucide.Users className="w-4 h-4" />
          User Management
          {activeTab === 'users' && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 relative cursor-pointer ${
            activeTab === 'security'
              ? 'text-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Lock className="w-4 h-4" />
          Security & Backups
          {activeTab === 'security' && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('membership')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 relative cursor-pointer ${
            activeTab === 'membership'
              ? 'text-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          Membership Benefits
          {activeTab === 'membership' && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shortcuts')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 relative cursor-pointer ${
            activeTab === 'shortcuts'
              ? 'text-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Lucide.Keyboard className="w-4 h-4" />
          Keyboard Shortcuts
          {activeTab === 'shortcuts' && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exchange')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 relative cursor-pointer ${
            activeTab === 'exchange'
              ? 'text-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Exchange Policy
          {activeTab === 'exchange' && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Custom Dynamic Toast for Branding Alerts */}
      {toast && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-xs border fixed top-6 right-6 z-50 shadow-2xl animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}      {/* TAB 1: SHOWROOM PROFILE (Consolidated Brand, Identity & Compliance Setup) */}
      {activeTab === 'financials' && (
        <form onSubmit={handleProfileSave} className="max-w-4xl mx-auto space-y-6 pb-12">
          {/* Business Information Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl relative">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800/60 pb-3">
              <Globe className="w-4 h-4 text-amber-500" /> Business Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Showroom Name */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Showroom Name *</label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => {
                      setStoreName(e.target.value);
                      if (validationErrors.storeName) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.storeName;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-950 border ${validationErrors.storeName ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs transition duration-150`}
                    required
                  />
                </div>
                {validationErrors.storeName && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.storeName}</p>
                )}
              </div>

              {/* Brand Tagline */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Brand Tagline</label>
                <div className="relative">
                  <Sliders className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="text"
                    value={editBrandTagline}
                    onChange={(e) => setEditBrandTagline(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition duration-150"
                    placeholder="E.g., Luxury Fashion & Lifestyle"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => {
                      setStorePhone(e.target.value);
                      if (validationErrors.storePhone) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.storePhone;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-950 border ${validationErrors.storePhone ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs transition duration-150`}
                    required
                  />
                </div>
                {validationErrors.storePhone && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.storePhone}</p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => {
                      setEditEmail(e.target.value);
                      if (validationErrors.editEmail) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.editEmail;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-950 border ${validationErrors.editEmail ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs transition duration-150`}
                    required
                  />
                </div>
                {validationErrors.editEmail && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.editEmail}</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Website (Optional)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="text"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition duration-150"
                  />
                </div>
              </div>

              {/* GST Number */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">GST Number *</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="text"
                    value={storeGstin}
                    onChange={(e) => {
                      setStoreGstin(e.target.value.toUpperCase());
                      if (validationErrors.storeGstin) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.storeGstin;
                          return copy;
                        });
                      }
                    }}
                    maxLength={15}
                    className={`w-full bg-slate-950 border ${validationErrors.storeGstin ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs font-mono uppercase transition duration-150`}
                    required
                  />
                </div>
                {validationErrors.storeGstin && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.storeGstin}</p>
                )}
              </div>

              {/* Complete Address */}
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Complete Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-600" />
                  <textarea
                    value={storeAddress}
                    onChange={(e) => {
                      setStoreAddress(e.target.value);
                      if (validationErrors.storeAddress) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.storeAddress;
                          return copy;
                        });
                      }
                    }}
                    rows={3}
                    className={`w-full bg-slate-950 border ${validationErrors.storeAddress ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs transition duration-150 resize-none`}
                    required
                    placeholder="Enter full showroom address..."
                  />
                </div>
                {validationErrors.storeAddress && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.storeAddress}</p>
                )}
              </div>
            </div>

            {/* First divider */}
            <div className="border-t border-slate-800/80 my-4" />

            {/* Store configuration fields within Business Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pb-2">
              {/* Store Opening Date */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Store Opening Date *</label>
                <div className="relative premium-date-container group">
                  <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-amber-500/80 group-hover:text-amber-300 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                  <input
                    type="text"
                    value={storeOpeningDate}
                    onChange={(e) => {
                      setStoreOpeningDate(e.target.value);
                      if (validationErrors.storeOpeningDate) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.storeOpeningDate;
                          return copy;
                        });
                      }
                    }}
                    className={`peer w-full bg-slate-950 border ${validationErrors.storeOpeningDate ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs font-mono transition duration-150`}
                    placeholder="DD/MM/YYYY"
                    required
                  />
                </div>
                {validationErrors.storeOpeningDate && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.storeOpeningDate}</p>
                )}
                <p className="text-[8px] text-slate-550 mt-1">Used for first 8 digits of newly issued membership cards.</p>
              </div>

              {/* Membership Validity (Months) */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Membership Validity (Months) *</label>
                <div className="relative">
                  <Lucide.Clock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="number"
                    value={membershipValidity}
                    onChange={(e) => {
                      setMembershipValidity(Number(e.target.value));
                      if (validationErrors.membershipValidity) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.membershipValidity;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-950 border ${validationErrors.membershipValidity ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'} rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none text-xs font-mono transition duration-150`}
                    min={1}
                    max={120}
                    required
                  />
                </div>
                {validationErrors.membershipValidity && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{validationErrors.membershipValidity}</p>
                )}
                <p className="text-[8px] text-slate-550 mt-1">Default expiration duration for newly registered VIP cards.</p>
              </div>
            </div>

            {/* Payment Settings / UPI ID Section */}
            <div className="border-t border-slate-800/80 my-4" />
            <div className="space-y-4">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <Lucide.CreditCard className="w-3.5 h-3.5 text-amber-500" /> UPI QR Payment Settings
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider" htmlFor="upi-id-input">UPI ID *</label>
                  <div className="relative">
                    <Lucide.Smartphone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                    <input
                      id="upi-id-input"
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. merchant@upi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition duration-150"
                    />
                  </div>
                  <p className="text-[8px] text-slate-500">Used to dynamically generate custom QR codes for direct scan-and-pay on the POS.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider" htmlFor="upi-display-name-input">UPI Display Name (Optional)</label>
                  <div className="relative">
                    <Lucide.User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                    <input
                      id="upi-display-name-input"
                      type="text"
                      value={upiDisplayName}
                      onChange={(e) => setUpiDisplayName(e.target.value)}
                      placeholder="e.g. Smart Fashion"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition duration-150"
                    />
                  </div>
                  <p className="text-[8px] text-slate-500">The name customers see inside their UPI app when they scan the QR code.</p>
                </div>
              </div>
            </div>

            {/* Second divider */}
            <div className="border-t border-slate-800/80 my-4" />

            {/* Save Changes Button Aligned Bottom-Right */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-10 py-3 rounded-lg gold-gradient text-slate-950 text-xs font-extrabold uppercase tracking-wider transition duration-200 shadow-md hover:opacity-95 cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && <Lucide.RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* USER MANAGEMENT TAB */}
      {activeTab === 'users' && <UserManagementView />}

      {/* TAB 4: MEMBERSHIP BENEFITS */}
      {activeTab === 'membership' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative pb-12">
          {/* LEFT SIDEBAR: Membership Cards Tiers List (col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <Layers className="w-4 h-4 text-amber-500" /> Membership Tiers
              </h3>
              
              <div className="space-y-4">
                {membershipTypes.map((tier) => {
                  const isSelected = selectedTypeId === tier.id;
                  const ruleCount = membershipDiscountRules.filter(r => r.membershipTypeId === tier.id).length;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTypeId(tier.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-slate-950 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-750'
                      }`}
                    >
                      <div 
                        className="absolute top-0 right-0 w-[40%] h-[120%] opacity-[0.04] group-hover:opacity-[0.08] transition-opacity pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at top right, ${tier.color || '#d4af37'}, transparent)`,
                        }}
                      />
                      
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3.5 h-3.5 rounded-full border shadow"
                          style={{
                            backgroundColor: tier.color,
                            borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)',
                          }}
                        />
                        <div className="flex-1">
                          <span className="font-serif text-sm font-bold text-amber-100 uppercase tracking-widest block">{tier.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                            {ruleCount} Active Rules • Min Purchase: ${tier.minPurchaseAmount}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border ${
                          tier.status === 'active'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {tier.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {activeType && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 mb-4 self-start">
                  <CreditCard className="w-4 h-4 text-amber-500" /> Card Mockup Preview
                </h3>
                
                <div 
                  className="w-full aspect-[1.58/1] rounded-2xl p-5 flex flex-col justify-between border relative overflow-hidden text-white shadow-2xl transition duration-300 transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(212,175,55,0.2)',
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.08]" style={{
                    backgroundImage: `radial-gradient(circle at 50% 120%, ${typeColor || '#d4af37'} 40%, transparent 80%)`
                  }} />
                  
                  <div className="absolute top-4 right-4 w-10 h-10 opacity-20 bg-center bg-no-repeat" style={{
                    backgroundImage: `radial-gradient(circle, ${typeColor} 10%, transparent 80%)`
                  }} />

                  <div className="flex justify-between items-start z-10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-400 to-amber-600 shrink-0" />
                      <span className="font-serif text-[9px] font-black tracking-widest text-amber-400 uppercase">SMART FASHION</span>
                    </div>
                    <span 
                      className="font-mono text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded border"
                      style={{
                        borderColor: typeColor,
                        color: typeColor,
                      }}
                    >
                      {typeName.split(' ')[0]} MEMBER
                    </span>
                  </div>

                  <div className="z-10 w-8 h-6 bg-amber-400/20 border border-amber-400/30 rounded-md p-1 grid grid-cols-3 gap-0.5 opacity-60">
                    <div className="border border-amber-400/20 rounded-sm"></div>
                    <div className="border border-amber-400/20 rounded-sm"></div>
                    <div className="border border-amber-400/20 rounded-sm"></div>
                    <div className="border border-amber-400/20 rounded-sm"></div>
                    <div className="border border-amber-400/20 rounded-sm"></div>
                    <div className="border border-amber-400/20 rounded-sm"></div>
                  </div>

                  <div className="space-y-1 z-10">
                    <div className="font-mono text-xs tracking-widest font-extrabold text-slate-100">
                      0142 0000 0001
                    </div>
                    <div className="flex justify-between items-end text-[7px] text-slate-400 uppercase font-bold tracking-widest">
                      <div>
                        <span className="block text-[6px] text-slate-500">Cardholder Name</span>
                        <span className="text-amber-100">Alexander Thorne</span>
                      </div>
                      <div>
                        <span className="block text-[6px] text-slate-500">Validity</span>
                        <span className="text-amber-100">{typeValidity} Months</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT EDIT CONTAINER: Settings & Benefits Form (col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            
            <form onSubmit={handleSaveMembershipType} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-amber-500" /> Benefit Parameter Matrix: <span className="text-amber-100 font-serif normal-case tracking-widest">{typeName}</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Card Tier Name</label>
                  <input
                    type="text"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Card Theme Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={typeColor}
                      onChange={(e) => setTypeColor(e.target.value)}
                      className="w-10 h-10 rounded border border-slate-800 bg-transparent cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={typeColor}
                      onChange={(e) => setTypeColor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Card Deployment Status</label>
                  <select
                    value={typeStatus}
                    onChange={(e) => setTypeStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer text-xs"
                  >
                    <option value="active">Active (Issuer Committing enabled)</option>
                    <option value="inactive">Inactive (Card lookup locks out)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Card Validity (Months)</label>
                  <input
                    type="number"
                    value={typeValidity}
                    onChange={(e) => setTypeValidity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                    min={1}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Minimum Purchase Amount Required ($)</label>
                  <input
                    type="number"
                    value={typeMinPurchase}
                    onChange={(e) => setTypeMinPurchase(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    min={0}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Maximum Discount Limit Per Bill ($)</label>
                  <input
                    type="number"
                    value={typeMaxPerBill}
                    onChange={(e) => setTypeMaxPerBill(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    min={0}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Maximum Monthly Cap Accumulator ($)</label>
                  <input
                    type="number"
                    value={typeMaxMonthly}
                    onChange={(e) => setTypeMaxMonthly(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    min={0}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Maximum Yearly Cap Accumulator ($)</label>
                  <input
                    type="number"
                    value={typeMaxYearly}
                    onChange={(e) => setTypeMaxYearly(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    min={0}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs uppercase font-bold text-amber-500 tracking-wider">
                      Benefit Manager for {typeName}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Configure dynamic benefits and privileges specific to this membership tier.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddBenefit}
                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider cursor-pointer transition duration-150"
                  >
                    <Lucide.Plus className="w-3 h-3" /> Add New Benefit
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/25">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[9px] text-slate-400 uppercase font-semibold bg-slate-950/40">
                        <th className="py-2 px-3">Icon</th>
                        <th className="py-2 px-3">Benefit Name</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-center">Show On Card</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300 text-[11px]">
                      {membershipBenefits
                        ?.filter(b => b.tierId === selectedTypeId)
                        ?.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                        ?.map((benefit, idx, sortedArr) => {
                          const IconComponent = (Lucide as any)[benefit.icon] || Lucide.Sparkles;
                          return (
                            <tr key={benefit.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-2.5 px-3">
                                <div className="w-7 h-7 rounded bg-slate-800/50 border border-slate-700/60 flex items-center justify-center text-amber-400">
                                  <IconComponent className="w-3.5 h-3.5" />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-200">
                                {benefit.benefitName}
                                <span className="block text-[8px] text-slate-500 font-mono mt-0.5">{benefit.type}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate" title={benefit.description}>
                                {benefit.description}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => updateMembershipBenefit(benefit.id, { status: benefit.status === 'active' ? 'inactive' : 'active' })}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider cursor-pointer ${
                                    benefit.status === 'active'
                                      ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/60'
                                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                                  }`}
                                >
                                  {benefit.status}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => updateMembershipBenefit(benefit.id, { showOnCard: !benefit.showOnCard })}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider cursor-pointer ${
                                    benefit.showOnCard
                                      ? 'bg-blue-950/50 text-blue-400 border border-blue-800/60'
                                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                                  }`}
                                >
                                  {benefit.showOnCard ? 'Yes' : 'No'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleBenefitMoveUp(benefit.id)}
                                    className="w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 disabled:opacity-20 flex items-center justify-center cursor-pointer"
                                    title="Move Up"
                                  >
                                    <Lucide.ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === sortedArr.length - 1}
                                    onClick={() => handleBenefitMoveDown(benefit.id)}
                                    className="w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 disabled:opacity-20 flex items-center justify-center cursor-pointer"
                                    title="Move Down"
                                  >
                                    <Lucide.ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditBenefit(benefit)}
                                    className="w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center cursor-pointer ml-1"
                                    title="Edit Benefit"
                                  >
                                    <Lucide.Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateBenefit(benefit)}
                                    className="w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center cursor-pointer"
                                    title="Duplicate Benefit"
                                  >
                                    <Lucide.Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this benefit?')) {
                                        deleteMembershipBenefit(benefit.id);
                                        showToast('Benefit deleted successfully.', 'success');
                                      }
                                    }}
                                    className="w-6 h-6 rounded bg-red-950/40 border border-red-900 text-red-400 hover:bg-red-900/40 flex items-center justify-center cursor-pointer"
                                    title="Delete Benefit"
                                  >
                                    <Lucide.Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {(!membershipBenefits || membershipBenefits.filter(b => b.tierId === selectedTypeId).length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500 font-sans italic text-xs">
                            No benefits configured for this card type. Click "+ Add New Benefit" to configure.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="gold-gradient text-slate-950 font-bold px-5 py-2.5 rounded-lg uppercase tracking-wider text-[10px] shadow-md hover:opacity-90 cursor-pointer"
                >
                  Save Tier Parameters
                </button>
              </div>
            </form>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-amber-500" /> Progressive Discount Rules for {typeName}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-semibold">
                      <th className="py-2.5">Min Shopping Amount Required</th>
                      <th className="py-2.5">Discount Percentage (%)</th>
                      <th className="py-2.5">Maximum Discount Cap</th>
                      <th className="py-2.5 text-right">Sequence &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300 font-mono text-[11px]">
                    {membershipDiscountRules
                      .filter(r => r.membershipTypeId === selectedTypeId)
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((rule, idx, sortedArr) => (
                        <tr key={rule.id} className="hover:bg-slate-950/20">
                          <td className="py-3">${rule.minPurchase}</td>
                          <td className="py-3 text-amber-400 font-bold">{rule.discountPercentage}%</td>
                          <td className="py-3">${rule.maxDiscountAmount || 'No Cap'}</td>
                          <td className="py-3 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleRuleMoveUp(rule.id)}
                                className="w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 disabled:opacity-20 flex items-center justify-center cursor-pointer"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === sortedArr.length - 1}
                                onClick={() => handleRuleMoveDown(rule.id)}
                                className="w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 disabled:opacity-20 flex items-center justify-center cursor-pointer"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Delete this threshold rule?')) {
                                    deleteMembershipDiscountRule(rule.id);
                                  }
                                }}
                                className="w-6 h-6 rounded bg-red-950/40 border border-red-900 text-red-400 hover:bg-red-900/40 flex items-center justify-center cursor-pointer ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {membershipDiscountRules.filter(r => r.membershipTypeId === selectedTypeId).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500 font-sans italic text-xs">
                          No progressive discount rules configured for this card type.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleAddRule} className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-4">
                <span className="block text-[9px] text-amber-400 uppercase font-black tracking-widest">Create New Shopping Threshold Rule</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
                  <div className="space-y-1">
                    <label className="block text-[8px] text-slate-500 uppercase font-bold">Min Shopping Amount ($)</label>
                    <input
                      type="number"
                      value={newRuleMinPurchase}
                      onChange={(e) => setNewRuleMinPurchase(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono"
                      min={0}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] text-slate-500 uppercase font-bold">Discount Percentage (%)</label>
                    <input
                      type="number"
                      value={newRuleDiscountPct}
                      onChange={(e) => setNewRuleDiscountPct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono"
                      min={1}
                      max={100}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] text-slate-500 uppercase font-bold">Max Discount Cap ($)</label>
                    <input
                      type="number"
                      value={newRuleMaxDiscount}
                      onChange={(e) => setNewRuleMaxDiscount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono"
                      min={1}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-amber-400/20 text-slate-300 hover:text-amber-400 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer"
                  >
                    ✦ Add Discount Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & DATA LEDGER */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          {/* Change PIN Security codes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-amber-500" /> Showroom Authorization PIN
            </h3>

            <form onSubmit={handlePinUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Current 6-Digit PIN</label>
                  <input
                    type="password"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    placeholder="••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center text-slate-200 focus:outline-none tracking-widest text-lg font-bold focus:border-amber-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">New 6-Digit PIN</label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    placeholder="••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center text-slate-200 focus:outline-none tracking-widest text-lg font-bold focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {securityStatus && (
                <p className={`text-[10px] font-bold mt-2 ${securityStatus.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {securityStatus}
                </p>
              )}

              <button
                type="submit"
                className="gold-gradient text-slate-950 font-bold px-4 py-2.5 rounded-lg uppercase tracking-wider text-[10px] cursor-pointer"
              >
                Update Security PIN
              </button>
            </form>
          </div>

          {/* Backup Database and Restore */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Download className="w-4 h-4 text-amber-500" /> State Backup & Recovery
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Export the entire showroom database into a standalone JSON file to restore settings, logs, and sales at any time.
            </p>

            <button
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/20 py-2.5 rounded-lg text-slate-300 font-bold uppercase tracking-wider text-[9px] transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-500" />
              Download Local JSON Backup File
            </button>

            {/* Drag and Drop restore */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center min-h-[140px] relative ${
                dragActive
                  ? 'border-amber-500 bg-amber-500/5 shadow-inner'
                  : 'border-slate-800 hover:border-amber-500/10'
              }`}
            >
              <Upload className="w-8 h-8 text-slate-600 mb-2 animate-bounce" style={{ animationDuration: '3s' }} />
              <p className="text-[10px] text-slate-400">Drag & Drop showroom backup JSON files here, or</p>
              
              <label className="text-[10px] font-bold text-amber-500 hover:text-amber-400 cursor-pointer underline mt-1">
                Browse storage files
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {restoreFeedback && (
                <p className={`text-[10px] font-bold mt-3 ${restoreFeedback.includes('successfully') ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}>
                  {restoreFeedback}
                </p>
              )}
            </div>

            {/* Danger Hard Wipe */}
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px]">
              <span className="text-slate-500">Danger Operations Area:</span>
              <PermissionButton
                module="settings"
                action="delete"
                onClick={triggerReset}
                className="flex items-center gap-1.5 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded uppercase font-bold hover:bg-red-500 hover:text-white transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Wipe State
              </PermissionButton>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: KEYBOARD SHORTCUTS REFERENCE (NEW) */}
      {activeTab === 'shortcuts' && (() => {
        const filteredShortcuts = defaultShortcuts.filter(item => {
          const matchesCategory = 
            shortcutFilter === 'All' ||
            (shortcutFilter === 'Navigation' && item.category === 'Navigation') ||
            (shortcutFilter === 'POS' && item.category === 'POS Billing') ||
            (shortcutFilter === 'Membership' && item.category === 'Membership Cards') ||
            (shortcutFilter === 'Search' && item.category === 'Search');
            
          const term = (shortcutSearch || '').toLowerCase();
          const matchesSearch = 
            !term ||
            (item.key || '').toLowerCase().includes(term) ||
            (item.action || '').toLowerCase().includes(term) ||
            (item.category || '').toLowerCase().includes(term) ||
            (item.description || '').toLowerCase().includes(term);
            
          return matchesCategory && matchesSearch;
        });

        return (
          <div className="space-y-6 pb-12 animate-fadeIn">
            {/* Style override for physical paper print and PDF export */}
            <style>{`
              @media screen {
                .print-only {
                  display: none !important;
                }
              }
              @media print {
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
                  display: block !important;
                  background: white !important;
                  color: black !important;
                  padding: 40px !important;
                }
              }
            `}</style>

            {/* Top Actions & Filters Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm uppercase font-serif font-bold text-amber-100 tracking-wider flex items-center gap-2">
                    <Lucide.Keyboard className="w-5 h-5 text-amber-500 animate-pulse" />
                    Showroom Hotkey Command Directory
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    High-efficiency keyboard command center for POS operations, customer management, and quick navigation.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isGeneratingPDF}
                    onClick={handleExportPDF}
                    className={`flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider gold-gradient text-slate-950 px-3.5 py-2 rounded-xl shadow-md hover:opacity-90 transition cursor-pointer ${
                      isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Export high-resolution dark/gold PDF"
                  >
                    {isGeneratingPDF ? (
                      <Lucide.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Lucide.FileDown className="w-3.5 h-3.5" />
                    )}
                    {isGeneratingPDF ? 'Generating PDF...' : 'Export PDF'}
                  </button>
                </div>
              </div>

              {/* Search and Filters Controls */}
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
                {/* Search input with search icon */}
                <div className="relative flex-1 max-w-md">
                  <Lucide.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={shortcutSearch}
                    onChange={(e) => setShortcutSearch(e.target.value)}
                    placeholder="Search shortcut or action..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                  {shortcutSearch && (
                    <button
                      onClick={() => setShortcutSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                    >
                      <Lucide.X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Responsive Tab Filters */}
                <div className="flex flex-wrap gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-850 self-start lg:self-auto overflow-x-auto max-w-full">
                  {(['All', 'Navigation', 'POS', 'Membership', 'Search'] as const).map((filterOpt) => {
                    const isAct = shortcutFilter === filterOpt;
                    return (
                      <button
                        key={filterOpt}
                        type="button"
                        onClick={() => setShortcutFilter(filterOpt)}
                        className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          isAct
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                        }`}
                      >
                        {filterOpt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Shortcuts Table Listing */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-wider text-amber-500/80 w-[20%]">Shortcut Key</th>
                      <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-wider text-slate-400 w-[25%]">Action / Command</th>
                      <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-wider text-slate-400 w-[15%]">Category</th>
                      <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-wider text-slate-400 w-[40%]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs">
                    {filteredShortcuts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-mono">
                          No matches found for "{shortcutSearch}" in category "{shortcutFilter}"
                        </td>
                      </tr>
                    ) : (
                      filteredShortcuts.map((item, index) => {
                        return (
                          <tr 
                            key={item.key + '_' + index} 
                            className="hover:bg-slate-950/40 transition-colors group"
                          >
                            <td className="px-6 py-3.5">
                              <span className="font-mono text-xs font-bold text-amber-400 bg-slate-950 border border-amber-500/20 px-2 py-1 rounded shadow-sm inline-block tracking-normal select-none uppercase">
                                {item.key}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 font-bold text-slate-200">
                              {item.action}
                            </td>
                            <td className="px-6 py-3.5">
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider select-none ${
                                item.category === 'Navigation'
                                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                  : item.category === 'General'
                                  ? 'bg-slate-400/10 border-slate-400/20 text-slate-300'
                                  : item.category === 'POS Billing'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  : item.category === 'Membership Cards'
                                  ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              }`}>
                                {item.category}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-slate-400">
                              {item.description}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 bg-slate-950/20 border-t border-slate-850 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Showing {filteredShortcuts.length} of {defaultShortcuts.length} keyboard commands</span>
                <span className="flex items-center gap-1">
                  <Lucide.Info className="w-3.5 h-3.5 text-slate-600" />
                  These shortcuts are globally registered in active panels.
                </span>
              </div>
            </div>

            {/* Hidden ink-friendly A4 Printable Layout */}
            <div id="printable-area" className="print-only text-slate-950 bg-white">
              <div className="text-center border-b-2 border-double border-slate-950 pb-6 mb-8">
                <h1 className="font-serif text-3xl font-bold uppercase tracking-widest">{storeName}</h1>
                <p className="text-xs uppercase font-mono tracking-wider mt-1">Bespoke Showroom Command Directory</p>
                <p className="text-[10px] text-slate-500 mt-2">Print Date: {new Date().toLocaleDateString()} | System Hotkeys Cheat-Sheet</p>
              </div>
              
              <div className="space-y-6">
                {(['Navigation', 'General', 'POS Billing', 'Membership Cards', 'Search'] as const).map((category) => {
                  const categoryShortcuts = defaultShortcuts.filter(s => s.category === category);
                  if (categoryShortcuts.length === 0) return null;
                  
                  return (
                    <div key={category} className="avoid-break mb-6">
                      <h3 className="font-serif text-sm font-bold uppercase tracking-wider border-b border-slate-800 pb-1 mb-3 text-slate-900">
                        ✦ {category} COMMANDS
                      </h3>
                      
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-300">
                            <th className="py-2 font-bold w-[25%]">Shortcut Key</th>
                            <th className="py-2 font-bold w-[30%]">Action / Command</th>
                            <th className="py-2 font-bold w-[45%]">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {categoryShortcuts.map((s, idx) => (
                            <tr key={s.key + '_' + idx} className="py-2">
                              <td className="py-2 font-mono font-bold text-slate-900">{s.key}</td>
                              <td className="py-2 font-serif text-slate-800">{s.action}</td>
                              <td className="py-2 text-slate-600 italic">{s.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-12 pt-6 border-t border-slate-300 text-center text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                Smart Fashion Enterprise Showroom Systems • Secure Operations
              </div>
            </div>

            {/* Hidden High-Definition Digital PDF Canvas */}
            <div 
              id="pdf-export-area" 
              style={{ 
                display: 'none', 
                position: 'absolute', 
                left: '-9999px', 
                top: '-9999px', 
                width: '800px', 
                background: '#050505', 
                color: '#f3e5ab',
                padding: '40px',
                boxSizing: 'border-box'
              }}
            >
              <div className="border-2 border-amber-500/20 p-8 rounded-3xl bg-slate-900 space-y-6">
                <div className="text-center border-b border-amber-500/10 pb-6">
                  <h1 className="font-serif text-3xl font-bold tracking-tight text-amber-100 uppercase">{storeName}</h1>
                  <p className="text-[10px] text-amber-500 uppercase tracking-widest mt-1">Bespoke Apparel Management System</p>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-4">HOTKEY SHORTCUT COMMAND DIRECTORY</h2>
                </div>
                
                <div className="space-y-6 text-slate-200">
                  {(['Navigation', 'General', 'POS Billing', 'Membership Cards', 'Printing', 'Search'] as const).map((category) => {
                    const categoryShortcuts = defaultShortcuts.filter(s => s.category === category);
                    return (
                      <div key={category} className="space-y-2">
                        <h3 className="text-xs font-serif font-bold text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-1">
                          {category} Configuration
                        </h3>
                        
                        <div className="grid grid-cols-12 gap-2 text-[10px] py-1 font-mono text-slate-500 border-b border-slate-900/40">
                           <div className="col-span-3 uppercase font-black">Shortcut Key</div>
                          <div className="col-span-4 uppercase font-black">Action</div>
                          <div className="col-span-5 uppercase font-black">Description</div>
                        </div>
                        
                        <div className="space-y-2">
                          {categoryShortcuts.map((s, idx) => (
                            <div key={s.key + '_' + idx} className="grid grid-cols-12 gap-2 text-[11px] items-center py-0.5">
                              <div className="col-span-3">
                                <span className="font-mono text-[10px] font-bold text-amber-400 bg-slate-950 border border-amber-500/10 px-1.5 py-0.5 rounded uppercase font-bold">
                                  {s.key}
                                </span>
                              </div>
                              <div className="col-span-4 font-bold text-slate-300">{s.action}</div>
                              <div className="col-span-5 text-slate-400 text-[10px]">{s.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="pt-6 border-t border-slate-800 text-center text-[9px] text-slate-600 font-mono">
                  CONFIDENTIAL SYSTEM DOCUMENTATION • SMART FASHION COUTURE © 2026
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'exchange' && (
        <form onSubmit={handleExchangePolicySave} className="max-w-4xl mx-auto space-y-6 pb-12">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl relative">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-800/60 pb-3">
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin-slow" />
              Exchange Policy Configuration
            </h3>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <div>
                <p className="text-xs font-bold text-slate-200">Enable Exchange Policy</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Turn ON to enforce policy rules during POS and sales exchanges.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exchangeEnabled}
                  onChange={(e) => setExchangeEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-slate-950 peer-checked:after:border-amber-500"></div>
              </label>
            </div>

            {/* Main Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Exchange Period (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={exchangePeriod}
                  onChange={(e) => setExchangePeriod(Math.max(1, parseInt(e.target.value) || 7))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">Original Invoice Required</span>
                  <input
                    type="checkbox"
                    checked={exchangeInvoiceRequired}
                    onChange={(e) => setExchangeInvoiceRequired(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">Original Tags Required</span>
                  <input
                    type="checkbox"
                    checked={exchangeTagsRequired}
                    onChange={(e) => setExchangeTagsRequired(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">Product Must Be Unused</span>
                  <input
                    type="checkbox"
                    checked={exchangeUnusedRequired}
                    onChange={(e) => setExchangeUnusedRequired(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Additional Restrictions */}
            <div className="border-t border-slate-800/60 pt-4 space-y-4">
              <h4 className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider">Exchange Eligibility & Restrictions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-950/20 rounded-xl border border-slate-850">
                  <div>
                    <p className="text-[11px] font-bold text-slate-300">Discounted Products Exchange</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Allow exchanges on items bought on discount.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={exchangeDiscountedAllowed}
                    onChange={(e) => setExchangeDiscountedAllowed(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/20 rounded-xl border border-slate-850">
                  <div>
                    <p className="text-[11px] font-bold text-slate-300">Promotional Products Exchange</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Allow exchanges on promotional/gift offers.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={exchangePromoAllowed}
                    onChange={(e) => setExchangePromoAllowed(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/20 rounded-xl border border-slate-850">
                  <div>
                    <p className="text-[11px] font-bold text-slate-300">Refund Allowed</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Enable original payment cash/UPI refunds.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={exchangeRefundAllowed}
                    onChange={(e) => setExchangeRefundAllowed(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/20 rounded-xl border border-slate-850">
                  <div>
                    <p className="text-[11px] font-bold text-slate-300">Exchange Only — No Refund</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Force exchanges to equal or higher value.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={exchangeOnly}
                    onChange={(e) => setExchangeOnlyState(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Products Bill Policy Textarea */}
            <div className="border-t border-slate-800/60 pt-4 space-y-2">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider" htmlFor="products-policy-textarea">
                  Custom Policy Terms — Products Bill
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  These terms will be printed only on Product Bill invoices.
                </p>
              </div>
              <textarea
                id="products-policy-textarea"
                rows={4}
                value={exchangeProductsPolicyText}
                onChange={(e) => setExchangeProductsPolicyText(e.target.value)}
                placeholder="Enter custom exchange/return terms specifically for PRODUCT invoices..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-sans leading-relaxed"
              />
            </div>

            {/* Fabrics Bill Policy Textarea */}
            <div className="border-t border-slate-800/60 pt-4 space-y-2">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider" htmlFor="fabrics-policy-textarea">
                  Custom Policy Terms — Fabrics Bill
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  These terms will be printed only on Fabric Bill invoices.
                </p>
              </div>
              <textarea
                id="fabrics-policy-textarea"
                rows={4}
                value={exchangeFabricsPolicyText}
                onChange={(e) => setExchangeFabricsPolicyText(e.target.value)}
                placeholder="Enter custom exchange/return terms specifically for FABRIC invoices..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-sans leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="gold-gradient text-slate-950 font-bold px-5 py-2.5 rounded-xl uppercase tracking-wider text-xs shadow-md hover:opacity-90 cursor-pointer transition flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Exchange Policy Settings
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Benefit Modal */}
      {isBenefitModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-xs uppercase font-bold text-slate-200 tracking-wider">
                {editingBenefit ? 'Edit Benefit / Perk' : 'Add New Benefit / Perk'}
              </h4>
              <button
                type="button"
                onClick={() => setIsBenefitModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <Lucide.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBenefit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Benefit Name</label>
                <input
                  type="text"
                  required
                  value={benefitName}
                  onChange={(e) => setBenefitName(e.target.value)}
                  placeholder="e.g. Complimentary Custom Alterations"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Description</label>
                <textarea
                  required
                  rows={2}
                  value={benefitDescription}
                  onChange={(e) => setBenefitDescription(e.target.value)}
                  placeholder="Provide a detailed description of this privilege..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Icon</label>
                  <select
                    value={benefitIcon}
                    onChange={(e) => setBenefitIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Sparkles">✨ Sparkles</option>
                    <option value="Truck">🚚 Truck</option>
                    <option value="Scissors">✂ Scissors</option>
                    <option value="Gift">🎁 Gift</option>
                    <option value="Ticket">🎫 Ticket</option>
                    <option value="Flame">🔥 Flame</option>
                    <option value="Star">⭐ Star</option>
                    <option value="Shield">🛡 Shield</option>
                    <option value="Crown">👑 Crown</option>
                    <option value="Zap">⚡ Zap</option>
                    <option value="Heart">❤ Heart</option>
                    <option value="Award">🏆 Award</option>
                    <option value="Gem">💎 Gem</option>
                    <option value="Smile">😊 Smile</option>
                    <option value="ShoppingBag">🛍 Shopping Bag</option>
                    <option value="HelpCircle">❓ Help Circle</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Type</label>
                  <select
                    value={benefitType}
                    onChange={(e) => setBenefitType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Discount">Discount</option>
                    <option value="Service">Service</option>
                    <option value="Access">Access</option>
                    <option value="Offer">Offer</option>
                    <option value="Gift">Gift</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Alteration">Alteration</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="benefitStatus"
                    checked={benefitStatus === 'active'}
                    onChange={(e) => setBenefitStatus(e.target.checked ? 'active' : 'inactive')}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="benefitStatus" className="text-[10px] text-slate-300 uppercase font-bold cursor-pointer select-none">
                    Active Status
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="benefitShowOnCard"
                    checked={benefitShowOnCard}
                    onChange={(e) => setBenefitShowOnCard(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="benefitShowOnCard" className="text-[10px] text-slate-300 uppercase font-bold cursor-pointer select-none">
                    Show On Card
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBenefitModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-lg uppercase tracking-wider text-[10px] font-bold text-slate-400 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gold-gradient text-slate-950 font-bold px-4 py-2 rounded-lg uppercase tracking-wider text-[10px] shadow-md hover:opacity-90 cursor-pointer transition"
                >
                  {editingBenefit ? 'Save Changes' : 'Create Benefit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
