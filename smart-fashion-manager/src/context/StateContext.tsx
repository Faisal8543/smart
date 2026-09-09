/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { hashPin } from '../utils/crypto';
import { safeLocalStorage, safeSessionStorage } from '../utils/safeStorage';
import { evaluateOffers } from '../utils/offerEvaluator';
import { calculateCreditSummary, getPreviousOutstandingForCustomer } from '../utils/creditUtils';
import { UserRole, ModuleName, ActionName, hasUserPermission, getPermissionDeniedReason } from '../utils/rbac';

const localStorage = safeLocalStorage;
const sessionStorage = safeSessionStorage;
import {
  Product,
  Customer,
  Supplier,
  Invoice,
  CreditPayment,
  Expense,
  Offer,
  StoreProfile,
  AppSettings,
  InventoryHistory,
  DiscountCard,
  StoreBranding,
  MembershipType,
  MembershipDiscountRule,
  MembershipCustomer,
  MembershipBenefit,
  CategoryMaster,
  BrandMaster,
  SizeMaster,
  ColorMaster,
  Gift,
  CustomerCoupon,
  CartItem,
  CouponValidationResult,
  CouponValidationEngine,
  CouponDeliveryLog,
  CouponAutomationSettings,
  SystemUser,
  AuditLog,
  ExchangeRecord,
  ExchangePolicySettings,
  Fabric,
  FabricLedgerEntry,
  FabricBill,
  FabricBillItem,
} from '../types';
import {
  DEFAULT_STORE_PROFILE,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_OFFERS,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_INVENTORY_HISTORY,
  INITIAL_DISCOUNT_CARDS,
  INITIAL_GIFTS,
  INITIAL_FABRICS,
  INITIAL_FABRIC_LEDGER,
} from '../data/mockData';

interface StateContextType {
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
  loginWithCredentials: (username: string, password: string) => { success: boolean; message?: string; user?: SystemUser };
  auditLogs: AuditLog[];
  addAuditLog: (action: string, details: string, operator?: string) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  checkPermission: (module: ModuleName, action: ActionName) => boolean;
  systemUsers: SystemUser[];
  addSystemUser: (user: Omit<SystemUser, 'id' | 'createdAt'>) => { success: boolean; message?: string };
  updateSystemUser: (id: string, updates: Partial<Omit<SystemUser, 'id'>>) => { success: boolean; message?: string };
  resetUserPassword: (id: string, newPassword: string) => { success: boolean; message?: string };
  deleteSystemUser: (id: string) => { success: boolean; message?: string };
  toggleUserStatus: (id: string) => { success: boolean; message?: string };
  products: Product[];
  fabrics: Fabric[];
  fabricLedger: FabricLedgerEntry[];
  fabricBills: FabricBill[];
  addFabric: (fabric: Omit<Fabric, 'id' | 'createdAt'>) => Fabric;
  updateFabric: (id: string, updates: Partial<Fabric>) => void;
  deleteFabric: (id: string) => void;
  adjustFabricStock: (
    fabricId: string,
    meters: number,
    type: 'add' | 'remove' | 'damaged',
    reason: string,
    refNo?: string
  ) => void;
  createFabricBill: (billData: {
    customerName?: string;
    customerPhone?: string;
    items: { fabricId: string; meters: number; ratePerMeter: number }[];
    paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
    discountAmount?: number;
    amountPaid?: number;
    notes?: string;
  }) => FabricBill;
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  expenses: Expense[];
  offers: Offer[];
  inventoryHistory: InventoryHistory[];
  settings: AppSettings;
  isAuthenticated: boolean;
  adminPin: string;
  login: (pin: string) => boolean;
  verifyPin: (pin: string) => boolean;
  logout: () => void;
  changePin: (oldPin: string, newPin: string) => boolean;
  changeAdminPin: (oldPin: string, newPin: string) => boolean;
  updateInvoicePrefix: (prefix: string) => void;
  resetDatabase: () => void;
  restoreDatabaseState: (data: any) => void;
  gifts: Gift[];
  addGift: (gift: Omit<Gift, 'id' | 'createdAt'>) => void;
  updateGift: (id: string, updates: Partial<Gift>) => void;
  deleteGift: (id: string) => void;
  adjustGiftStock: (
    giftId: string,
    quantity: number,
    type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged',
    reason: string
  ) => void;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (
    productId: string,
    quantity: number,
    type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged',
    reason: string
  ) => void;
  addCustomer: (name: string, phone: string, notes?: string) => Customer;
  findCustomerByPhone: (phone: string, excludeId?: string) => Customer | undefined;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addOffer: (offer: Omit<Offer, 'id'>) => Offer;
  updateOffer: (id: string, updates: Partial<Offer>) => void;
  deleteOffer: (id: string) => void;
  toggleOffer: (id: string) => void;
  customerCoupons: CustomerCoupon[];
  addCustomerCoupon: (coupon: Omit<CustomerCoupon, 'id'>) => CustomerCoupon;
  updateCustomerCoupon: (id: string, updates: Partial<CustomerCoupon>) => void;
  deleteCustomerCoupon: (id: string) => void;
  generateUniqueCouponCode: (prefix?: string) => string;
  couponDeliveryLogs: CouponDeliveryLog[];
  setCouponDeliveryLogs: React.Dispatch<React.SetStateAction<CouponDeliveryLog[]>>;
  addCouponDeliveryLog: (log: Omit<CouponDeliveryLog, 'id'>) => void;
  updateCouponDeliveryLogStatus: (id: string, status: 'Sent' | 'Pending' | 'Failed') => void;
  updateCouponAutomationSettings: (automationSettings: CouponAutomationSettings) => void;
  completeSale: (
    customerPhone: string,
    customerName: string,
    cartItems: { product: Product; quantity: number; discount: number; discountType: 'percentage' | 'flat' }[],
    paymentMethod: 'cash' | 'upi' | 'card' | 'credit',
    appliedCouponCode?: string,
    discountCardNumber?: string,
    amountPaid?: number,
    creditDetails?: {
      dueDate: string;
      reason?: string;
      remarks?: string;
    },
    previousDueDetails?: {
      collectPreviousDue: boolean;
    }
  ) => Invoice;
  recordCreditPayment: (
    invoiceId: string,
    amount: number,
    paymentMethod?: 'cash' | 'upi' | 'card',
    notes?: string,
    date?: string
  ) => void;
  markCreditInvoiceAsPaid: (
    invoiceId: string,
    paymentMethod?: 'cash' | 'upi' | 'card',
    notes?: string
  ) => void;
  triggerPostPrintAutomation: (invoice: Invoice) => void;
  ensureCouponGeneratedForInvoice: (invoice: Invoice) => CustomerCoupon | null;
  updateStoreProfile: (profile: StoreProfile) => void;
  updateStoreBranding: (branding: StoreBranding) => void;
  updateTheme: (theme: 'luxury' | 'light') => void;
  resetToDefaults: () => void;
  backupData: () => string;
  restoreData: (jsonStr: string) => { success: boolean; error?: string };
  discountCards: DiscountCard[];
  addDiscountCard: (card: Omit<DiscountCard, 'id' | 'usageLogs' | 'totalSavings'>) => DiscountCard;
  updateDiscountCard: (id: string, updates: Partial<DiscountCard>) => void;
  deleteDiscountCard: (id: string) => void;
  lastMembershipSerial: number;
  updateLastMembershipSerial: (val: number) => void;
  membershipTypes: MembershipType[];
  membershipDiscountRules: MembershipDiscountRule[];
  membershipCustomers: MembershipCustomer[];
  updateMembershipType: (id: string, updates: Partial<MembershipType>) => void;
  addMembershipDiscountRule: (rule: Omit<MembershipDiscountRule, 'id'>) => void;
  updateMembershipDiscountRule: (id: string, updates: Partial<MembershipDiscountRule>) => void;
  deleteMembershipDiscountRule: (id: string) => void;
  reorderMembershipDiscountRules: (membershipTypeId: string, rules: MembershipDiscountRule[]) => void;
  calculateMembershipDiscount: (cardType: string, subtotal: number, usageLogs?: any[]) => { discountPercentage: number; discountAmount: number; reason?: string };
  addMembershipCustomer: (cust: Omit<MembershipCustomer, 'id'>) => MembershipCustomer;
  updateMembershipCustomer: (id: string, updates: Partial<MembershipCustomer>) => void;
  deleteMembershipCustomer: (id: string) => void;
  membershipBenefits: MembershipBenefit[];
  addMembershipBenefit: (benefit: Omit<MembershipBenefit, 'id' | 'createdAt' | 'updatedAt'>) => MembershipBenefit;
  updateMembershipBenefit: (id: string, updates: Partial<MembershipBenefit>) => void;
  deleteMembershipBenefit: (id: string) => void;
  reorderMembershipBenefits: (tierId: string, benefits: MembershipBenefit[]) => void;
  categoriesList: CategoryMaster[];
  brandsList: BrandMaster[];
  sizesList: SizeMaster[];
  colorsList: ColorMaster[];
  addCategory: (name: string, status?: 'active' | 'inactive') => CategoryMaster;
  updateCategory: (id: string, updates: Partial<CategoryMaster>) => void;
  deleteCategory: (id: string) => void;
  addBrand: (name: string, status?: 'active' | 'inactive') => BrandMaster;
  updateBrand: (id: string, updates: Partial<BrandMaster>) => void;
  deleteBrand: (id: string) => void;
  addSize: (name: string, status?: 'active' | 'inactive') => SizeMaster;
  updateSize: (id: string, updates: Partial<SizeMaster>) => void;
  deleteSize: (id: string) => void;
  addColor: (name: string, status?: 'active' | 'inactive') => ColorMaster;
  updateColor: (id: string, updates: Partial<ColorMaster>) => void;
  deleteColor: (id: string) => void;
  dateFilter: {
    preset: string;
    fromDate: string;
    toDate: string;
    startTime?: string;
    endTime?: string;
  };
  setDateFilter: (filter: {
    preset: string;
    fromDate: string;
    toDate: string;
    startTime?: string;
    endTime?: string;
  }) => void;
  couponValidationEngine: CouponValidationEngine;
  exchanges: ExchangeRecord[];
  updateExchangePolicySettings: (policy: ExchangePolicySettings) => void;
  addExchangeRecord: (record: Omit<ExchangeRecord, 'id' | 'date'>) => { success: boolean; message: string; exchange?: ExchangeRecord };
}

export const getOpeningDatePrefix = (openingDate?: string) => {
  if (!openingDate) return '1503 2026'; // fallback
  // Handle standard date picker YYYY-MM-DD
  if (openingDate.includes('-')) {
    const parts = openingDate.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD
      const yyyy = parts[0];
      const mm = parts[1];
      const dd = parts[2];
      return `${dd}${mm} ${yyyy}`;
    }
  }
  // Handle DD/MM/YYYY
  if (openingDate.includes('/')) {
    const parts = openingDate.split('/');
    if (parts.length === 3) {
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2];
      return `${dd}${mm} ${yyyy}`;
    }
  }
  // Fallback: strip non-digits and try to extract 8 digits
  const digits = openingDate.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
  }
  return '1503 2026';
};

export const formatMembershipCardNumber = (openingDate?: string, serial?: number | string): string => {
  const prefix = getOpeningDatePrefix(openingDate);
  let serialNum = 1;
  if (typeof serial === 'number') {
    serialNum = serial;
  } else if (typeof serial === 'string') {
    const clean = serial.trim().replace(/\s+/g, '');
    const last4 = clean.slice(-4);
    const parsed = parseInt(last4, 10);
    if (!isNaN(parsed)) {
      serialNum = parsed;
    }
  }
  const seqStr = String(serialNum).padStart(4, '0');
  return `${prefix} 0000 ${seqStr}`;
};

const StateContext = createContext<StateContextType | undefined>(undefined);

const DEFAULT_MEMBERSHIP_TYPES: MembershipType[] = [
  {
    id: 'Silver',
    name: 'Silver Card',
    color: '#94a3b8',
    status: 'active',
    validityMonths: 12,
    maxDiscountPerBill: 2000,
    maxMonthlyDiscount: 10000,
    maxYearlyDiscount: 100000,
    minPurchaseAmount: 999,
    festivalDiscount: true,
    birthdayDiscount: true,
    anniversaryDiscount: false,
    specialMemberDiscount: false,
    exclusiveSaleAccess: false,
    freeAlteration: false,
    freeDelivery: true,
    priorityBilling: false,
  },
  {
    id: 'Gold',
    name: 'Gold Card',
    color: '#f59e0b',
    status: 'active',
    validityMonths: 24,
    maxDiscountPerBill: 5000,
    maxMonthlyDiscount: 25000,
    maxYearlyDiscount: 250000,
    minPurchaseAmount: 1499,
    festivalDiscount: true,
    birthdayDiscount: true,
    anniversaryDiscount: true,
    specialMemberDiscount: false,
    exclusiveSaleAccess: true,
    freeAlteration: true,
    freeDelivery: true,
    priorityBilling: false,
  },
  {
    id: 'PLATINUM',
    name: 'Platinum Card',
    color: '#d97706',
    status: 'active',
    validityMonths: 36,
    maxDiscountPerBill: 10000,
    maxMonthlyDiscount: 50000,
    maxYearlyDiscount: 500000,
    minPurchaseAmount: 1999,
    festivalDiscount: true,
    birthdayDiscount: true,
    anniversaryDiscount: true,
    specialMemberDiscount: true,
    exclusiveSaleAccess: true,
    freeAlteration: true,
    freeDelivery: true,
    priorityBilling: true,
  },
];

const DEFAULT_DISCOUNT_RULES: MembershipDiscountRule[] = [
  // Silver
  { id: 'rule_s1', membershipTypeId: 'Silver', minPurchase: 1999, discountPercentage: 5, maxDiscountAmount: 500, order: 0 },
  { id: 'rule_s2', membershipTypeId: 'Silver', minPurchase: 2999, discountPercentage: 7, maxDiscountAmount: 750, order: 1 },
  { id: 'rule_s3', membershipTypeId: 'Silver', minPurchase: 4999, discountPercentage: 10, maxDiscountAmount: 1000, order: 2 },
  
  // Gold
  { id: 'rule_g1', membershipTypeId: 'Gold', minPurchase: 1999, discountPercentage: 7, maxDiscountAmount: 750, order: 0 },
  { id: 'rule_g2', membershipTypeId: 'Gold', minPurchase: 2999, discountPercentage: 10, maxDiscountAmount: 1000, order: 1 },
  { id: 'rule_g3', membershipTypeId: 'Gold', minPurchase: 4999, discountPercentage: 12, maxDiscountAmount: 1500, order: 2 },
  
  // Platinum
  { id: 'rule_v1', membershipTypeId: 'PLATINUM', minPurchase: 1999, discountPercentage: 10, maxDiscountAmount: 1000, order: 0 },
  { id: 'rule_v2', membershipTypeId: 'PLATINUM', minPurchase: 2999, discountPercentage: 15, maxDiscountAmount: 2000, order: 1 },
  { id: 'rule_v3', membershipTypeId: 'PLATINUM', minPurchase: 4999, discountPercentage: 20, maxDiscountAmount: 5000, order: 2 },
];

const DEFAULT_MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  // Silver
  {
    id: 'benefit_s1',
    tierId: 'Silver',
    benefitName: 'Festival Special Offers',
    description: 'Get special discounts during major festive seasons',
    icon: 'Flame',
    type: 'Discount',
    status: 'active',
    showOnCard: true,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_s2',
    tierId: 'Silver',
    benefitName: 'Birthday Benefit',
    description: 'Exclusive birthday gift vouchers or additional discounts',
    icon: 'Gift',
    type: 'Gift',
    status: 'active',
    showOnCard: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_s3',
    tierId: 'Silver',
    benefitName: 'Complimentary White-glove Home Delivery',
    description: 'Complimentary home delivery with high-end safety packaging',
    icon: 'Truck',
    type: 'Delivery',
    status: 'active',
    showOnCard: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Gold
  {
    id: 'benefit_g1',
    tierId: 'Gold',
    benefitName: 'Festival Special Offers',
    description: 'Get special discounts during major festive seasons',
    icon: 'Flame',
    type: 'Discount',
    status: 'active',
    showOnCard: true,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_g2',
    tierId: 'Gold',
    benefitName: 'Birthday Benefit',
    description: 'Exclusive birthday gift vouchers or additional discounts',
    icon: 'Gift',
    type: 'Gift',
    status: 'active',
    showOnCard: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_g3',
    tierId: 'Gold',
    benefitName: 'Anniversary Celebration Voucher',
    description: 'Complimentary custom voucher on your anniversary',
    icon: 'Sparkles',
    type: 'Offer',
    status: 'active',
    showOnCard: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_g4',
    tierId: 'Gold',
    benefitName: 'Complimentary Custom Alterations',
    description: 'Complimentary bespoke tailoring alteration services',
    icon: 'Scissors',
    type: 'Alteration',
    status: 'active',
    showOnCard: true,
    displayOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_g5',
    tierId: 'Gold',
    benefitName: 'Complimentary White-glove Home Delivery',
    description: 'Complimentary home delivery with high-end safety packaging',
    icon: 'Truck',
    type: 'Delivery',
    status: 'active',
    showOnCard: true,
    displayOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Platinum
  {
    id: 'benefit_p1',
    tierId: 'PLATINUM',
    benefitName: 'Festival Special Offers',
    description: 'Get special discounts during major festive seasons',
    icon: 'Flame',
    type: 'Discount',
    status: 'active',
    showOnCard: true,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p2',
    tierId: 'PLATINUM',
    benefitName: 'Birthday Benefit',
    description: 'Exclusive birthday gift vouchers or additional discounts',
    icon: 'Gift',
    type: 'Gift',
    status: 'active',
    showOnCard: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p3',
    tierId: 'PLATINUM',
    benefitName: 'Anniversary Celebration Voucher',
    description: 'Complimentary custom voucher on your anniversary',
    icon: 'Sparkles',
    type: 'Offer',
    status: 'active',
    showOnCard: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p4',
    tierId: 'PLATINUM',
    benefitName: 'Elite Club Member Privileges',
    description: 'Access to private member lounges and tailored events',
    icon: 'Crown',
    type: 'Access',
    status: 'active',
    showOnCard: true,
    displayOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p5',
    tierId: 'PLATINUM',
    benefitName: 'Exclusive Sale Early Access',
    description: 'Shop our collections before public access sales open',
    icon: 'Ticket',
    type: 'Access',
    status: 'active',
    showOnCard: true,
    displayOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p6',
    tierId: 'PLATINUM',
    benefitName: 'Complimentary Custom Alterations',
    description: 'Complimentary bespoke tailoring alteration services',
    icon: 'Scissors',
    type: 'Alteration',
    status: 'active',
    showOnCard: true,
    displayOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p7',
    tierId: 'PLATINUM',
    benefitName: 'Complimentary White-glove Home Delivery',
    description: 'Complimentary home delivery with high-end safety packaging',
    icon: 'Truck',
    type: 'Delivery',
    status: 'active',
    showOnCard: true,
    displayOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'benefit_p8',
    tierId: 'PLATINUM',
    benefitName: 'Priority Showroom Billing Checkout',
    description: 'Bypass the main billing queue with a dedicated billing executive',
    icon: 'Zap',
    type: 'Service',
    status: 'active',
    showOnCard: true,
    displayOrder: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const StateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Database tables
  const [products, setProducts] = useState<Product[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [fabricLedger, setFabricLedger] = useState<FabricLedgerEntry[]>([]);
  const [fabricBills, setFabricBills] = useState<FabricBill[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistory[]>([]);
  const [discountCards, setDiscountCards] = useState<DiscountCard[]>([]);
  const [customerCoupons, setCustomerCoupons] = useState<CustomerCoupon[]>([]);
  const [couponDeliveryLogs, setCouponDeliveryLogs] = useState<CouponDeliveryLog[]>([]);
  const [appliedCoupons, setAppliedCouponsState] = useState<CustomerCoupon[]>([]);
  const [cashierOverrideCouponCode, setCashierOverrideCouponCodeState] = useState<string | null>(null);

  const lastFinalizedInvoiceRef = React.useRef<Invoice | null>(null);
  const processedInvoiceAutomationRef = React.useRef<Set<string>>(new Set());

  const setAppliedCoupons = React.useCallback((newCoupons: CustomerCoupon[]) => {
    setAppliedCouponsState((prev) => {
      if (prev.length === newCoupons.length && prev.every((c, i) => c.id === newCoupons[i].id)) {
        return prev;
      }
      return newCoupons;
    });
  }, []);

  const setCashierOverrideCouponCode = React.useCallback((code: string | null) => {
    setCashierOverrideCouponCodeState((prev) => {
      if (prev === code) {
        return prev;
      }
      return code;
    });
  }, []);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [membershipDiscountRules, setMembershipDiscountRules] = useState<MembershipDiscountRule[]>([]);
  const [membershipCustomers, setMembershipCustomers] = useState<MembershipCustomer[]>([]);
  const [membershipBenefits, setMembershipBenefits] = useState<MembershipBenefit[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryMaster[]>([]);
  const [brandsList, setBrandsList] = useState<BrandMaster[]>([]);
  const [sizesList, setSizesList] = useState<SizeMaster[]>([]);
  const [colorsList, setColorsList] = useState<ColorMaster[]>([]);
  const [lastMembershipSerial, setLastMembershipSerial] = useState<number>(() => {
    const storedSettings = localStorage.getItem('sf_settings');
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        if (parsed?.storeProfile?.lastMembershipSerial !== undefined) {
          const val = parseInt(parsed.storeProfile.lastMembershipSerial, 10);
          if (!isNaN(val)) return val;
        }
      } catch (e) {
        // ignore
      }
    }
    const stored = localStorage.getItem('sf_last_membership_serial');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 0; // Start at 0 for first installation
  });
  const [lastInvoiceSerial, setLastInvoiceSerial] = useState<number>(() => {
    const stored = localStorage.getItem('sf_last_invoice_serial');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    // Scan stored invoices to find highest serial if existing
    const storedInvoices = localStorage.getItem('sf_invoices');
    if (storedInvoices) {
      try {
        const parsedInvoices: Invoice[] = JSON.parse(storedInvoices);
        let maxS = 0;
        for (const inv of parsedInvoices) {
          if (!inv.invoiceNo) continue;
          const match10 = inv.invoiceNo.match(/^SF\d{4}(\d{4})$/i);
          if (match10) {
            const num = parseInt(match10[1], 10);
            if (!isNaN(num) && num > maxS) maxS = num;
          }
        }
        if (maxS > 0) return maxS;
      } catch (e) {
        // ignore
      }
    }
    return 0;
  });
  const DEFAULT_EXCHANGE_POLICY = {
    enabled: true,
    exchangePeriodDays: 7,
    originalInvoiceRequired: true,
    originalTagsRequired: true,
    productMustBeUnused: true,
    discountedProductsExchange: false,
    promotionalProductsExchange: false,
    refundAllowed: false,
    exchangeOnly: true,
    productsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange.",
    fabricsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nFabric must be uncut, unused and have original tags.\nDiscounted/promotional fabrics are not eligible for exchange.",
    customPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange."
  };

  const [settings, setSettings] = useState<AppSettings>({
    storeProfile: DEFAULT_STORE_PROFILE,
    theme: 'luxury',
    storeBranding: {
      showLogoOnInvoice: true,
      showLogoOnCard: true,
      printLogoSize: 'medium',
    },
    exchangePolicy: {
      enabled: true,
      exchangePeriodDays: 7,
      originalInvoiceRequired: true,
      originalTagsRequired: true,
      productMustBeUnused: true,
      discountedProductsExchange: false,
      promotionalProductsExchange: false,
      refundAllowed: false,
      exchangeOnly: true,
      productsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange.",
      fabricsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nFabric must be uncut, unused and have original tags.\nDiscounted/promotional fabrics are not eligible for exchange.",
      customPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange."
    }
  });

  const [exchanges, setExchanges] = useState<ExchangeRecord[]>(() => {
    const stored = localStorage.getItem('sf_exchanges');
    return stored ? JSON.parse(stored) : [];
  });

  // Auth & RBAC state
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(() => {
    return localStorage.getItem('sf_current_user_id') || null;
  });

  const setCurrentUserId = (userId: string | null) => {
    setCurrentUserIdState(userId);
    if (userId) {
      localStorage.setItem('sf_current_user_id', userId);
    } else {
      localStorage.removeItem('sf_current_user_id');
    }
  };

  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    const stored = localStorage.getItem('sf_current_role');
    if (stored === 'admin' || stored === 'manager' || stored === 'cashier') {
      return stored as UserRole;
    }
    return 'admin';
  });

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    localStorage.setItem('sf_current_role', role);
  };

  const checkPermission = (module: ModuleName, action: ActionName): boolean => {
    const activeUser = (currentUserId ? systemUsers.find((u) => u.id === currentUserId && u.status === 'active') : null)
      || systemUsers.find((u) => u.role === currentRole && u.status === 'active')
      || systemUsers.find((u) => u.role === currentRole)
      || { role: currentRole };
    return hasUserPermission(activeUser, module, action);
  };

  // System Users state for User Management - No hardcoded demo users
  const DEFAULT_SYSTEM_USERS: SystemUser[] = [];

  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(() => {
    const stored = localStorage.getItem('sf_system_users');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Remove any legacy seeded demo users
          const realUsers = parsed.filter((u: any) => {
            if (u.fullName === 'Store Administrator' && u.username === 'admin' && u.password === 'password123') return false;
            if (u.fullName === 'Showroom Manager' && u.username === 'manager') return false;
            if (u.fullName === 'Head Cashier' && u.username === 'cashier') return false;
            return true;
          });

          let migrated = false;
          const migratedUsers = realUsers.map((u: any) => {
            // Hash any passwords that are plain text (not exactly 16 character hashes)
            if (u.password && u.password.length !== 16) {
              migrated = true;
              return { ...u, password: hashPin(u.password) };
            }
            return u;
          });

          if (migrated) {
            localStorage.setItem('sf_system_users', JSON.stringify(migratedUsers));
          }

          return migratedUsers;
        }
      } catch (e) {
        console.error('Failed to parse system users', e);
      }
    }
    return [];
  });

  const saveSystemUsers = (users: SystemUser[]) => {
    setSystemUsers(users);
    saveToStorage('sf_system_users', users);
  };

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const stored = localStorage.getItem('sf_security_audit_logs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse security audit logs', e);
      }
    }
    return [];
  });

  const addAuditLog = (action: string, details: string, operator?: string) => {
    const currentOperator = operator || (currentUserId ? systemUsers.find(u => u.id === currentUserId)?.username : null) || 'System';
    const newLog: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      action,
      details,
      user: currentOperator,
    };
    setAuditLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 500);
      localStorage.setItem('sf_security_audit_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const addSystemUser = (userData: Omit<SystemUser, 'id' | 'createdAt'> & { id?: string }) => {
    const cleanUsername = userData.username.trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, message: 'Username cannot be empty.' };
    }
    const exists = systemUsers.some(
      (u) => (u.username || '').toLowerCase() === cleanUsername
    );
    if (exists) {
      return { success: false, message: `Username "${cleanUsername}" is already taken.` };
    }

    if (userData.role === 'admin') {
      const hasAdmin = systemUsers.some((u) => u.role === 'admin');
      if (hasAdmin) {
        return { success: false, message: 'Only one Admin account is allowed in the system. Second Admin cannot be created.' };
      }
    }

    const newUser: SystemUser = {
      ...userData,
      password: userData.password ? hashPin(userData.password) : undefined,
      id: userData.id || ('usr_' + Date.now()),
      username: cleanUsername,
      createdAt: new Date().toISOString(),
    };
    const updated = [...systemUsers, newUser];
    saveSystemUsers(updated);

    addAuditLog('User Created', `Created user account: "${newUser.fullName}" (@${newUser.username}) with role: ${newUser.role}.`);

    return { success: true, message: `User "${newUser.fullName}" added successfully.` };
  };

  const updateSystemUser = (id: string, updates: Partial<Omit<SystemUser, 'id'>>) => {
    const targetUser = systemUsers.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (updates.username) {
      const cleanUsername = updates.username.trim().toLowerCase();
      if (!cleanUsername) {
        return { success: false, message: 'Username cannot be empty.' };
      }
      const duplicate = systemUsers.some(
        (u) => u.id !== id && (u.username || '').toLowerCase() === cleanUsername
      );
      if (duplicate) {
        return { success: false, message: `Username "${cleanUsername}" is already taken.` };
      }
    }

    if (targetUser.role === 'admin') {
      if (updates.role && updates.role !== 'admin') {
        return { success: false, message: 'The Admin account cannot be demoted to another role.' };
      }
      if (updates.status && updates.status !== 'active') {
        return { success: false, message: 'The Admin account cannot be deactivated or disabled.' };
      }
    }

    if (updates.role === 'admin' && targetUser.role !== 'admin') {
      return { success: false, message: 'Cannot elevate a user to Admin role. Only one Admin is allowed.' };
    }

    const updated = systemUsers.map((u) => {
      if (u.id === id) {
        const nextPassword = updates.password ? hashPin(updates.password) : u.password;
        return {
          ...u,
          ...updates,
          password: nextPassword,
          username: updates.username ? updates.username.trim().toLowerCase() : u.username,
          updatedAt: new Date().toISOString(),
        };
      }
      return u;
    });

    saveSystemUsers(updated);

    const changedFields = Object.keys(updates).filter((k) => k !== 'password').join(', ');
    addAuditLog('User Edited', `Edited user account "${targetUser.fullName}" (@${targetUser.username}). Changed fields: ${changedFields || 'none'}.`);

    return { success: true, message: 'User account updated successfully.' };
  };

  const resetUserPassword = (id: string, newPassword: string) => {
    const targetUser = systemUsers.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }
    if (!newPassword || newPassword.length < 3) {
      return { success: false, message: 'Password must be at least 3 characters.' };
    }

    const updated = systemUsers.map((u) => {
      if (u.id === id) {
        return {
          ...u,
          password: hashPin(newPassword),
          updatedAt: new Date().toISOString(),
        };
      }
      return u;
    });

    saveSystemUsers(updated);

    addAuditLog('Password Reset', `Administrative password reset performed for user "${targetUser.fullName}" (@${targetUser.username}).`);

    return { success: true, message: `Password for "${targetUser.fullName}" reset successfully.` };
  };

  const toggleUserStatus = (id: string) => {
    const targetUser = systemUsers.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.role === 'admin') {
      return { success: false, message: 'The Admin account cannot be deactivated or disabled.' };
    }

    const nextStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    const updated = systemUsers.map((u) => {
      if (u.id === id) {
        return {
          ...u,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return u;
    });

    saveSystemUsers(updated);

    addAuditLog('User Status Toggle', `Toggled account status for "${targetUser.fullName}" (@${targetUser.username}) to ${nextStatus}.`);

    return { success: true, message: `User "${targetUser.fullName}" is now ${nextStatus}.` };
  };

  const deleteSystemUser = (id: string, operatorId?: string) => {
    const targetUser = systemUsers.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    const actualOperatorId = operatorId || currentUserId;
    if (actualOperatorId && (targetUser.id === actualOperatorId || targetUser.username === actualOperatorId)) {
      return { success: false, message: 'The currently logged-in Admin cannot delete their own account.' };
    }

    if (targetUser.role === 'admin') {
      return { success: false, message: 'The Admin account cannot be deleted.' };
    }

    const updated = systemUsers.filter((u) => u.id !== id);
    saveSystemUsers(updated);

    addAuditLog('User Deleted', `Deleted user account: "${targetUser.fullName}" (@${targetUser.username}) with role: ${targetUser.role}.`);

    return { success: true, message: `User "${targetUser.fullName}" deleted successfully.` };
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminPinHash, setAdminPinHash] = useState<string>(() => {
    const stored = localStorage.getItem('sf_admin_pin_encrypted');
    if (stored) return stored;
    
    // Default 6-digit PIN is "123456"
    const defaultHash = hashPin('123456');
    localStorage.setItem('sf_admin_pin_encrypted', defaultHash);
    return defaultHash;
  });

  // Date & Time Filter state
  const [dateFilter, setDateFilterState] = useState<{
    preset: string;
    fromDate: string;
    toDate: string;
    startTime?: string;
    endTime?: string;
  }>(() => {
    const stored = localStorage.getItem('sf_date_filter');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // ignore
      }
    }
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      preset: 'today',
      fromDate: todayStr,
      toDate: todayStr,
      startTime: '',
      endTime: '',
    };
  });

  const setDateFilter = (filter: typeof dateFilter) => {
    setDateFilterState(filter);
    localStorage.setItem('sf_date_filter', JSON.stringify(filter));
  };

  // Hydrate state from localStorage
  useEffect(() => {
    try {
      const storedProducts = localStorage.getItem('sf_products');
      const storedGifts = localStorage.getItem('sf_gifts');
      const storedCustomers = localStorage.getItem('sf_customers');
      const storedSuppliers = localStorage.getItem('sf_suppliers');
      const storedInvoices = localStorage.getItem('sf_invoices');
      const storedExpenses = localStorage.getItem('sf_expenses');
      const storedOffers = localStorage.getItem('sf_offers');
      const storedHistory = localStorage.getItem('sf_inventory_history');
      const storedDiscountCards = localStorage.getItem('sf_discount_cards');
      const storedSettings = localStorage.getItem('sf_settings');
      const storedPinEncrypted = localStorage.getItem('sf_admin_pin_encrypted');
      const storedAuth = sessionStorage.getItem('sf_authenticated');

      if (storedProducts) setProducts(JSON.parse(storedProducts));
      else {
        setProducts(INITIAL_PRODUCTS);
        localStorage.setItem('sf_products', JSON.stringify(INITIAL_PRODUCTS));
      }

      const storedFabrics = localStorage.getItem('sf_fabrics');
      if (storedFabrics) setFabrics(JSON.parse(storedFabrics));
      else {
        setFabrics(INITIAL_FABRICS);
        localStorage.setItem('sf_fabrics', JSON.stringify(INITIAL_FABRICS));
      }

      const storedFabricLedger = localStorage.getItem('sf_fabric_ledger');
      if (storedFabricLedger) setFabricLedger(JSON.parse(storedFabricLedger));
      else {
        setFabricLedger(INITIAL_FABRIC_LEDGER);
        localStorage.setItem('sf_fabric_ledger', JSON.stringify(INITIAL_FABRIC_LEDGER));
      }

      const storedFabricBills = localStorage.getItem('sf_fabric_bills');
      if (storedFabricBills) setFabricBills(JSON.parse(storedFabricBills));
      else {
        setFabricBills([]);
        localStorage.setItem('sf_fabric_bills', JSON.stringify([]));
      }

      if (storedGifts) setGifts(JSON.parse(storedGifts));
      else {
        setGifts(INITIAL_GIFTS);
        localStorage.setItem('sf_gifts', JSON.stringify(INITIAL_GIFTS));
      }

      if (storedCustomers) {
        try {
          const parsed = JSON.parse(storedCustomers);
          const migrated = parsed.map((cust: any) => {
            const updated = { ...cust };
            if (updated.name) {
              const cleaned = updated.name.replace(/\s+/g, '').toUpperCase();
              if (cleaned === 'SOHAILAKHTAR') updated.name = 'SOHAIL AKHTAR';
              else if (cleaned === 'FAISALAHMED') updated.name = 'FAISAL AHMED';
              else if (cleaned === 'MOHAMMADSHAHALAM') updated.name = 'MOHAMMAD SHAH ALAM';
              else if (cleaned === 'ABUBAKARSIDDIQUE') updated.name = 'ABU BAKAR SIDDIQUE';
            }
            return updated;
          });
          setCustomers(migrated);
          localStorage.setItem('sf_customers', JSON.stringify(migrated));
        } catch {
          setCustomers(INITIAL_CUSTOMERS);
          localStorage.setItem('sf_customers', JSON.stringify(INITIAL_CUSTOMERS));
        }
      } else {
        setCustomers(INITIAL_CUSTOMERS);
        localStorage.setItem('sf_customers', JSON.stringify(INITIAL_CUSTOMERS));
      }

      if (storedSuppliers) setSuppliers(JSON.parse(storedSuppliers));
      else {
        setSuppliers(INITIAL_SUPPLIERS);
        localStorage.setItem('sf_suppliers', JSON.stringify(INITIAL_SUPPLIERS));
      }

      if (storedInvoices) {
        try {
          const parsed = JSON.parse(storedInvoices);
          const migrated = parsed.map((inv: any) => {
            const updated = { ...inv };
            if (updated.customerName) {
              const cleaned = updated.customerName.replace(/\s+/g, '').toUpperCase();
              if (cleaned === 'SOHAILAKHTAR') updated.customerName = 'SOHAIL AKHTAR';
              else if (cleaned === 'FAISALAHMED') updated.customerName = 'FAISAL AHMED';
              else if (cleaned === 'MOHAMMADSHAHALAM') updated.customerName = 'MOHAMMAD SHAH ALAM';
              else if (cleaned === 'ABUBAKARSIDDIQUE') updated.customerName = 'ABU BAKAR SIDDIQUE';
            }
            return updated;
          });
          setInvoices(migrated);
          localStorage.setItem('sf_invoices', JSON.stringify(migrated));
        } catch {
          setInvoices(INITIAL_INVOICES);
          localStorage.setItem('sf_invoices', JSON.stringify(INITIAL_INVOICES));
        }
      } else {
        setInvoices(INITIAL_INVOICES);
        localStorage.setItem('sf_invoices', JSON.stringify(INITIAL_INVOICES));
      }

      if (storedExpenses) {
        try {
          const parsed = JSON.parse(storedExpenses);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map((item: any) => {
              if (item && typeof item === 'object') {
                return {
                  id: item.id || 'exp_' + Math.random().toString(36).substr(2, 9),
                  category: item.category || 'Others',
                  amount: typeof item.amount === 'number' && !isNaN(item.amount) ? item.amount : Number(item.amount) || 0,
                  description: item.description || item.title || 'Expense',
                  title: item.title || item.description || 'Expense',
                  notes: item.notes || item.description || '',
                  date: item.date || new Date().toISOString()
                };
              }
              return null;
            }).filter(Boolean);
            setExpenses(sanitized as Expense[]);
          } else {
            setExpenses(INITIAL_EXPENSES);
          }
        } catch {
          setExpenses(INITIAL_EXPENSES);
        }
      } else {
        setExpenses(INITIAL_EXPENSES);
        localStorage.setItem('sf_expenses', JSON.stringify(INITIAL_EXPENSES));
      }

      if (storedOffers) setOffers(JSON.parse(storedOffers));
      else {
        setOffers(INITIAL_OFFERS);
        localStorage.setItem('sf_offers', JSON.stringify(INITIAL_OFFERS));
      }

      if (storedHistory) setInventoryHistory(JSON.parse(storedHistory));
      else {
        setInventoryHistory(INITIAL_INVENTORY_HISTORY);
        localStorage.setItem('sf_inventory_history', JSON.stringify(INITIAL_INVENTORY_HISTORY));
      }

      if (storedDiscountCards) {
        try {
          const parsed = JSON.parse(storedDiscountCards);

          // Second pass: migrate card numbers if they are invalid (has letters or isn't 16 digits/spaced format)
          const upgraded = parsed.map((card: any) => {
            const updatedCard = { ...card };
            
            // Auto-migrate cardType from vip to platinum
            if (updatedCard.cardType === 'vip' || updatedCard.cardType === 'VIP') {
              updatedCard.cardType = 'platinum';
            }

            // Migrate customer/member name spaces
            if (updatedCard.customerName) {
              const cleaned = updatedCard.customerName.replace(/\s+/g, '').toUpperCase();
              if (cleaned === 'SOHAILAKHTAR') updatedCard.customerName = 'SOHAIL AKHTAR';
              else if (cleaned === 'FAISALAHMED') updatedCard.customerName = 'FAISAL AHMED';
              else if (cleaned === 'MOHAMMADSHAHALAM') updatedCard.customerName = 'MOHAMMAD SHAH ALAM';
              else if (cleaned === 'ABUBAKARSIDDIQUE') updatedCard.customerName = 'ABU BAKAR SIDDIQUE';
            }

            // Check if cardNumber is invalid (empty, has letters, or doesn't match the 16 digit/spaced format)
            const cleanNum = (updatedCard.cardNumber || '').trim().replace(/\s+/g, '');
            const hasLetters = /[a-zA-Z]/.test(updatedCard.cardNumber || '');
            const isNumeric16 = /^\d{16}$/.test(cleanNum);
            
            if (!updatedCard.cardNumber || hasLetters || !isNumeric16) {
              // Standardize to a default format without scanning or guessing
              updatedCard.cardNumber = `1503 2026 0000 0001`;
            } else {
              // Standardize formatting with spaces if it's 16 digits without spaces
              if (cleanNum.length === 16 && !updatedCard.cardNumber.includes(' ')) {
                updatedCard.cardNumber = `${cleanNum.slice(0, 4)} ${cleanNum.slice(4, 8)} ${cleanNum.slice(8, 12)} ${cleanNum.slice(12, 16)}`;
              }
            }

            // Also ensure barcodeText exists and conforms to standard
            if (!updatedCard.barcodeText) {
              const cleanName = (updatedCard.customerName || 'SOHAIL AKHTAR').trim();
              const names = cleanName.split(/\s+/);
              const firstLetter = names[0] ? names[0].charAt(0).toUpperCase() : 'S';
              const lastLetter = names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : 'X';
              let ddmm = '2706';
              let yyyy = '2008';
              const dobStr = updatedCard.dob || '27/06/2008';
              const digits = dobStr.replace(/\D/g, '');
              if (digits.length >= 8) {
                if (dobStr.includes('-') && dobStr.split('-')[0].length === 4) {
                  const parts = dobStr.split('-');
                  ddmm = parts[2].padStart(2, '0') + parts[1].padStart(2, '0');
                  yyyy = parts[0];
                } else {
                  ddmm = digits.slice(0, 4);
                  yyyy = digits.slice(4, 8);
                }
              }
              updatedCard.barcodeText = `SF${firstLetter}${lastLetter} 2026 ${ddmm} ${yyyy}`;
            }
            return updatedCard;
          });
          setDiscountCards(upgraded);
          localStorage.setItem('sf_discount_cards', JSON.stringify(upgraded));
        } catch {
          setDiscountCards(INITIAL_DISCOUNT_CARDS);
          localStorage.setItem('sf_discount_cards', JSON.stringify(INITIAL_DISCOUNT_CARDS));
        }
      } else {
        setDiscountCards(INITIAL_DISCOUNT_CARDS);
        localStorage.setItem('sf_discount_cards', JSON.stringify(INITIAL_DISCOUNT_CARDS));
      }

      const storedMembershipTypes = localStorage.getItem('sf_membership_types');
      const storedMembershipRules = localStorage.getItem('sf_membership_discount_rules');
      const storedMembershipCustomers = localStorage.getItem('sf_membership_customers');

      let activeTypes = DEFAULT_MEMBERSHIP_TYPES;
      if (storedMembershipTypes) {
        try {
          const parsed = JSON.parse(storedMembershipTypes);
          activeTypes = parsed.map((t: any) => {
            if (t.id === 'VIP' || t.id === 'vip') {
              return { ...t, id: 'PLATINUM', name: 'Platinum Card' };
            }
            return t;
          });
          if (!activeTypes.some(t => t.id === 'PLATINUM')) {
            const defaultPlat = DEFAULT_MEMBERSHIP_TYPES.find(t => t.id === 'PLATINUM');
            if (defaultPlat) activeTypes.push(defaultPlat);
          }
          activeTypes = activeTypes.filter(t => t.id !== 'VIP' && t.id !== 'vip');
          localStorage.setItem('sf_membership_types', JSON.stringify(activeTypes));
        } catch {
          activeTypes = DEFAULT_MEMBERSHIP_TYPES;
          localStorage.setItem('sf_membership_types', JSON.stringify(DEFAULT_MEMBERSHIP_TYPES));
        }
      } else {
        localStorage.setItem('sf_membership_types', JSON.stringify(DEFAULT_MEMBERSHIP_TYPES));
      }
      setMembershipTypes(activeTypes);

      let activeRules = DEFAULT_DISCOUNT_RULES;
      if (storedMembershipRules) {
        try {
          const parsed = JSON.parse(storedMembershipRules);
          activeRules = parsed.map((r: any) => {
            if (r.membershipTypeId === 'VIP' || r.membershipTypeId === 'vip') {
              return { ...r, membershipTypeId: 'PLATINUM' };
            }
            return r;
          });
          localStorage.setItem('sf_membership_discount_rules', JSON.stringify(activeRules));
        } catch {
          activeRules = DEFAULT_DISCOUNT_RULES;
          localStorage.setItem('sf_membership_discount_rules', JSON.stringify(DEFAULT_DISCOUNT_RULES));
        }
      } else {
        localStorage.setItem('sf_membership_discount_rules', JSON.stringify(DEFAULT_DISCOUNT_RULES));
      }
      setMembershipDiscountRules(activeRules);

      let activeCusts: MembershipCustomer[] = [];
      if (storedMembershipCustomers) {
        try {
          const parsed = JSON.parse(storedMembershipCustomers);
          activeCusts = parsed.map((c: any) => {
            const updated = { ...c };
            if (updated.customerName) {
              const cleaned = updated.customerName.replace(/\s+/g, '').toUpperCase();
              if (cleaned === 'SOHAILAKHTAR') updated.customerName = 'SOHAIL AKHTAR';
              else if (cleaned === 'FAISALAHMED') updated.customerName = 'FAISAL AHMED';
              else if (cleaned === 'MOHAMMADSHAHALAM') updated.customerName = 'MOHAMMAD SHAH ALAM';
              else if (cleaned === 'ABUBAKARSIDDIQUE') updated.customerName = 'ABU BAKAR SIDDIQUE';
            }
            if (updated.membershipType === 'VIP' || updated.membershipType === 'vip' || updated.membershipType === 'VIP Card' || updated.membershipType === 'vip_card') {
              updated.membershipType = 'PLATINUM';
              if (updated.discountRules) {
                try {
                  const rulesParsed = JSON.parse(updated.discountRules);
                  const rulesMigrated = rulesParsed.map((r: any) => {
                    if (r.membershipTypeId === 'VIP' || r.membershipTypeId === 'vip') {
                      return { ...r, membershipTypeId: 'PLATINUM' };
                    }
                    return r;
                  });
                  updated.discountRules = JSON.stringify(rulesMigrated);
                } catch {
                  // Keep as is
                }
              }
            }
            return updated;
          });
          localStorage.setItem('sf_membership_customers', JSON.stringify(activeCusts));
        } catch {
          activeCusts = [];
        }
      } else {
        const initialCusts: MembershipCustomer[] = INITIAL_DISCOUNT_CARDS.map(card => {
          const mType = (card.cardType || 'PLATINUM').toUpperCase();
          const cleanType = mType.includes('SILVER') ? 'Silver' : mType.includes('GOLD') ? 'Gold' : 'PLATINUM';
          return {
            id: card.id,
            customerName: card.customerName,
            mobileNumber: card.mobileNumber,
            cardNumber: card.cardNumber,
            barcode: card.barcodeText || '',
            membershipType: cleanType,
            discountRules: JSON.stringify(DEFAULT_DISCOUNT_RULES.filter(r => r.membershipTypeId === cleanType)),
            issueDate: card.issueDate || new Date().toISOString(),
            expiryDate: card.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: card.status as any || 'active',
          };
        });
        activeCusts = initialCusts;
        localStorage.setItem('sf_membership_customers', JSON.stringify(initialCusts));
      }
      setMembershipCustomers(activeCusts);

      const storedMembershipBenefits = localStorage.getItem('sf_membership_benefits');
      let activeBenefits = DEFAULT_MEMBERSHIP_BENEFITS;
      if (storedMembershipBenefits) {
        try {
          activeBenefits = JSON.parse(storedMembershipBenefits);
        } catch {
          activeBenefits = DEFAULT_MEMBERSHIP_BENEFITS;
          localStorage.setItem('sf_membership_benefits', JSON.stringify(DEFAULT_MEMBERSHIP_BENEFITS));
        }
      } else {
        localStorage.setItem('sf_membership_benefits', JSON.stringify(DEFAULT_MEMBERSHIP_BENEFITS));
      }
      setMembershipBenefits(activeBenefits);

      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (!parsed.storeBranding) {
          parsed.storeBranding = {
            showLogoOnInvoice: true,
            showLogoOnCard: true,
            printLogoSize: 'medium',
          };
        }
        if (!parsed.couponAutomation) {
          parsed.couponAutomation = {
            enabled: false,
            minPurchaseAmount: 3000,
            discountType: 'percentage',
            discountValue: 10,
            validityDays: 30,
            autoGenerate: true,
            autoWhatsAppDelivery: true,
            autoCouponDetection: true,
            autoApplyOnNextVisit: true,
          };
        } else {
          if (parsed.couponAutomation.discountType === undefined) parsed.couponAutomation.discountType = 'percentage';
          if (parsed.couponAutomation.discountValue === undefined) parsed.couponAutomation.discountValue = 10;
          if (parsed.couponAutomation.autoApplyOnNextVisit === undefined) parsed.couponAutomation.autoApplyOnNextVisit = true;
          if (parsed.couponAutomation.autoGenerate === undefined) parsed.couponAutomation.autoGenerate = true;
          if (parsed.couponAutomation.autoWhatsAppDelivery === undefined) parsed.couponAutomation.autoWhatsAppDelivery = true;
          if (parsed.couponAutomation.autoCouponDetection === undefined) parsed.couponAutomation.autoCouponDetection = true;
        }
        if (!parsed.exchangePolicy) {
          parsed.exchangePolicy = {
            enabled: true,
            exchangePeriodDays: 7,
            originalInvoiceRequired: true,
            originalTagsRequired: true,
            productMustBeUnused: true,
            discountedProductsExchange: false,
            promotionalProductsExchange: false,
            refundAllowed: false,
            exchangeOnly: true,
            productsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange.",
            fabricsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nFabric must be uncut, unused and have original tags.\nDiscounted/promotional fabrics are not eligible for exchange.",
            customPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange."
          };
        } else {
          if (parsed.exchangePolicy.productsPolicyText === undefined) {
            parsed.exchangePolicy.productsPolicyText = parsed.exchangePolicy.customPolicyText ?? "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange.";
          }
          if (parsed.exchangePolicy.fabricsPolicyText === undefined) {
            parsed.exchangePolicy.fabricsPolicyText = "Exchange within 7 days from the purchase date with original invoice.\nFabric must be uncut, unused and have original tags.\nDiscounted/promotional fabrics are not eligible for exchange.";
          }
        }
        

        setSettings(parsed);
      } else {
        const defaultSettings = { 
          storeProfile: DEFAULT_STORE_PROFILE, 
          theme: 'luxury' as const,
          storeBranding: {
            showLogoOnInvoice: true,
            showLogoOnCard: true,
            printLogoSize: 'medium',
          },
          couponAutomation: {
            enabled: false,
            minPurchaseAmount: 3000,
            discountType: 'percentage' as const,
            discountValue: 10,
            validityDays: 30,
            autoGenerate: true,
            autoWhatsAppDelivery: true,
            autoCouponDetection: true,
            autoApplyOnNextVisit: true,
          },
          exchangePolicy: {
            enabled: true,
            exchangePeriodDays: 7,
            originalInvoiceRequired: true,
            originalTagsRequired: true,
            productMustBeUnused: true,
            discountedProductsExchange: false,
            promotionalProductsExchange: false,
            refundAllowed: false,
            exchangeOnly: true,
            productsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange.",
            fabricsPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nFabric must be uncut, unused and have original tags.\nDiscounted/promotional fabrics are not eligible for exchange.",
            customPolicyText: "Exchange within 7 days from the purchase date with original invoice.\nProduct must be unused and have original tags.\nDiscounted/promotional products are not eligible for exchange."
          }
        };
        setSettings(defaultSettings);
        localStorage.setItem('sf_settings', JSON.stringify(defaultSettings));
      }

      if (storedPinEncrypted) {
        setAdminPinHash(storedPinEncrypted);
      } else {
        // Check if there was an old unencrypted PIN and migrate it
        const oldPin = localStorage.getItem('sf_admin_pin');
        if (oldPin) {
          const migratedHash = hashPin(oldPin);
          setAdminPinHash(migratedHash);
          localStorage.setItem('sf_admin_pin_encrypted', migratedHash);
          localStorage.removeItem('sf_admin_pin');
        }
      }

      if (storedAuth === 'true') {
        setIsAuthenticated(true);
      }

      // Hydrate Category, Brand, Size, and Color masters
      const storedCategories = localStorage.getItem('sf_categories');
      let loadedCategories: CategoryMaster[] = [];
      if (storedCategories) {
        loadedCategories = JSON.parse(storedCategories);
      }
      const defaultCategories: CategoryMaster[] = [
        { id: 'cat_1', name: 'Suits & Blazers', status: 'active' },
        { id: 'cat_2', name: 'Shirts', status: 'active' },
        { id: 'cat_3', name: 'Trousers', status: 'active' },
        { id: 'cat_4', name: 'Footwear', status: 'active' },
        { id: 'cat_5', name: 'Accessories', status: 'active' },
        { id: 'cat_6', name: 'Casual Wear', status: 'active' },
        { id: 'cat_g_bottle', name: 'Bottle', status: 'active' },
        { id: 'cat_g_wallet', name: 'Wallet', status: 'active' },
        { id: 'cat_g_cap', name: 'Cap', status: 'active' },
        { id: 'cat_g_perfume', name: 'Perfume', status: 'active' },
        { id: 'cat_g_belt', name: 'Belt', status: 'active' },
        { id: 'cat_g_socks', name: 'Socks', status: 'active' },
        { id: 'cat_g_keychain', name: 'Keychain', status: 'active' },
        { id: 'cat_g_mug', name: 'Coffee Mug', status: 'active' },
        { id: 'cat_g_bag', name: 'Bag', status: 'active' },
        { id: 'cat_g_hankey', name: 'Handkerchief', status: 'active' },
        { id: 'cat_g_voucher', name: 'Gift Voucher', status: 'active' },
        { id: 'cat_g_promo', name: 'Promotional Merchandise', status: 'active' }
      ];
      const finalCategories = [...loadedCategories];
      defaultCategories.forEach(def => {
        const exists = finalCategories.some(c => c.id === def.id || (c.name || '').toLowerCase() === (def.name || '').toLowerCase());
        if (!exists) {
          finalCategories.push(def);
        }
      });
      setCategoriesList(finalCategories);
      localStorage.setItem('sf_categories', JSON.stringify(finalCategories));

      const storedBrands = localStorage.getItem('sf_brands');
      let loadedBrands: BrandMaster[] = [];
      if (storedBrands) {
        loadedBrands = JSON.parse(storedBrands);
      }
      const defaultBrands: BrandMaster[] = [
        { id: 'br_1', name: 'Cavalli & Co.', status: 'active' },
        { id: 'br_2', name: 'Albin Mill', status: 'active' },
        { id: 'br_3', name: 'Marchesi', status: 'active' },
        { id: 'br_4', name: 'Savile Row', status: 'active' },
        { id: 'br_5', name: 'Monarque', status: 'active' },
        { id: 'br_raymond', name: 'Raymond', status: 'active' },
        { id: 'br_g_hydrofit', name: 'HydroFit', status: 'active' },
        { id: 'br_g_aura', name: 'Aura Leathers', status: 'active' },
        { id: 'br_g_vogue', name: 'Vogue Threads', status: 'active' },
        { id: 'br_g_smart', name: 'Smart Fashion', status: 'active' }
      ];
      const finalBrands = [...loadedBrands];
      defaultBrands.forEach(def => {
        const exists = finalBrands.some(b => b.id === def.id || (b.name || '').toLowerCase() === (def.name || '').toLowerCase());
        if (!exists) {
          finalBrands.push(def);
        }
      });
      setBrandsList(finalBrands);
      localStorage.setItem('sf_brands', JSON.stringify(finalBrands));

      const storedSizes = localStorage.getItem('sf_sizes');
      if (storedSizes) {
        setSizesList(JSON.parse(storedSizes));
      } else {
        const initialSizes: SizeMaster[] = [
          { id: 'sz_1', name: '34', status: 'active' },
          { id: 'sz_2', name: '36', status: 'active' },
          { id: 'sz_3', name: '38', status: 'active' },
          { id: 'sz_4', name: '40', status: 'active' },
          { id: 'sz_5', name: '42L', status: 'active' },
          { id: 'sz_6', name: 'One Size', status: 'active' }
        ];
        setSizesList(initialSizes);
        localStorage.setItem('sf_sizes', JSON.stringify(initialSizes));
      }

      const storedColors = localStorage.getItem('sf_colors');
      if (storedColors) {
        setColorsList(JSON.parse(storedColors));
      } else {
        const initialColors: ColorMaster[] = [
          { id: 'col_1', name: 'Midnight Blue / Gold Lining', status: 'active' },
          { id: 'col_2', name: 'Ivory White', status: 'active' },
          { id: 'col_3', name: 'Saddle Tan', status: 'active' },
          { id: 'col_4', name: 'Charcoal Grey', status: 'active' },
          { id: 'col_5', name: 'Midnight Black', status: 'active' },
        { id: 'col_6', name: 'White', status: 'active' },
        { id: 'col_7', name: 'Navy Blue', status: 'active' },
        { id: 'col_8', name: 'Royal Blue', status: 'active' },
        { id: 'col_9', name: 'Beige', status: 'active' }
        ];
        setColorsList(initialColors);
        localStorage.setItem('sf_colors', JSON.stringify(initialColors));
      }

      const storedCustomerCoupons = localStorage.getItem('sf_customer_coupons');
      if (storedCustomerCoupons) {
        setCustomerCoupons(JSON.parse(storedCustomerCoupons));
      } else {
        setCustomerCoupons([]);
        localStorage.setItem('sf_customer_coupons', JSON.stringify([]));
      }

      const storedDeliveryLogs = localStorage.getItem('sf_coupon_delivery_logs');
      if (storedDeliveryLogs) {
        setCouponDeliveryLogs(JSON.parse(storedDeliveryLogs));
      } else {
        setCouponDeliveryLogs([]);
        localStorage.setItem('sf_coupon_delivery_logs', JSON.stringify([]));
      }
    } catch (e) {
      console.error('Error hydrating App State from localStorage', e);
    }
  }, []);

  // Save changes to localStorage on state updates
  const saveToStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving key ${key} to storage:`, e);
    }
  };

  // Auth Operations
  const loginWithCredentials = (
    username: string,
    password: string
  ): { success: boolean; message?: string; user?: SystemUser } => {
    const cleanUsername = username.trim().toLowerCase();
    const user = systemUsers.find(
      (u) => (u.username || '').toLowerCase() === cleanUsername && u.status === 'active'
    );

    if (!user || user.password !== hashPin(password)) {
      addAuditLog('Login Failed', `Failed login attempt for username: "${username}".`, 'System');
      return { success: false, message: 'Invalid username or password.' };
    }

    setCurrentRole(user.role);
    setCurrentUserId(user.id);
    setIsAuthenticated(true);
    sessionStorage.setItem('sf_authenticated', 'true');

    addAuditLog('Login Success', `User logged in successfully as ${user.role}.`, user.username);

    return { success: true, user };
  };

  const login = (pinOrUsername: string): boolean => {
    const clean = pinOrUsername.trim().toLowerCase();
    const user = systemUsers.find((u) => (u.username || '').toLowerCase() === clean && u.status === 'active');
    if (user) {
      setCurrentRole(user.role);
      setCurrentUserId(user.id);
      setIsAuthenticated(true);
      sessionStorage.setItem('sf_authenticated', 'true');
      addAuditLog('Login Success', `User logged in via fallback as ${user.role}.`, user.username);
      return true;
    }
    return false;
  };

  const verifyPin = (pin: string): boolean => {
    return false;
  };

  const logout = () => {
    const operator = currentUserId ? systemUsers.find(u => u.id === currentUserId)?.username : null;
    addAuditLog('Logout', 'User signed out securely.', operator || 'System');
    setIsAuthenticated(false);
    setCurrentUserId(null);
    sessionStorage.removeItem('sf_authenticated');
    localStorage.removeItem('sf_current_user_id');
  };

  const changePin = (oldPin: string, newPin: string): boolean => {
    if (!currentUserId) return false;
    const targetUser = systemUsers.find(u => u.id === currentUserId);
    if (!targetUser) return false;

    // Check if old password matches the hashed old pin/password
    if (targetUser.password === hashPin(oldPin)) {
      const updated = systemUsers.map(u => {
        if (u.id === currentUserId) {
          return {
            ...u,
            password: hashPin(newPin),
            updatedAt: new Date().toISOString()
          };
        }
        return u;
      });
      saveSystemUsers(updated);
      addAuditLog('Password Changed', `User "@${targetUser.username}" changed their own password securely.`, targetUser.username);
      return true;
    }
    return false;
  };

  const changeAdminPin = (oldPin: string, newPin: string): boolean => {
    return changePin(oldPin, newPin);
  };

  const updateInvoicePrefix = (prefix: string) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        storeProfile: {
          ...prev.storeProfile,
          invoicePrefix: prefix,
        },
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
  };

  const resetDatabase = () => {
    resetToDefaults();
  };

  const restoreDatabaseState = (data: any) => {
    const res = restoreData(JSON.stringify(data));
    if (!res.success) {
      throw new Error(res.error || 'Failed to restore database');
    }
  };

  // Product Operations
  const addProduct = (p: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...p,
      id: 'prod_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updated = [newProduct, ...products];
    setProducts(updated);
    saveToStorage('sf_products', updated);

    // Also log stock-in in inventory history
    if (p.currentStock > 0) {
      logInventoryChange(newProduct.id, newProduct.name, 'stock-in', p.currentStock, 'Initial product setup stock entry', 0, p.currentStock);
    }
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const updated = products.map((p) => {
      if (p.id === id) {
        const merged = { ...p, ...updates };
        // Check stock changes to log history if stock is modified directly
        if (updates.currentStock !== undefined && updates.currentStock !== p.currentStock) {
          const diff = updates.currentStock - p.currentStock;
          const type = diff > 0 ? 'stock-in' : 'stock-out';
          logInventoryChange(
            p.id,
            p.name,
            type,
            Math.abs(diff),
            updates.currentStock > p.currentStock ? 'Manual restock' : 'Manual stock reduction',
            p.currentStock,
            updates.currentStock
          );
        }
        return merged;
      }
      return p;
    });
    setProducts(updated);
    saveToStorage('sf_products', updated);
  };

  const deleteProduct = (id: string) => {
    if (!checkPermission('products', 'delete')) {
      alert(getPermissionDeniedReason(currentRole, 'products', 'delete'));
      return;
    }
    const updated = products.filter((p) => p.id !== id);
    setProducts(updated);
    saveToStorage('sf_products', updated);
  };

  const adjustStock = (
    productId: string,
    quantity: number, // positive for addition, negative for subtraction
    type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged',
    reason: string
  ) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        const prev = p.currentStock;
        const next = Math.max(0, prev + quantity);
        logInventoryChange(p.id, p.name, type, Math.abs(quantity), reason, prev, next);
        return { ...p, currentStock: next };
      }
      return p;
    });
    setProducts(updated);
    saveToStorage('sf_products', updated);
  };

  const logInventoryChange = (
    productId: string,
    productName: string,
    type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged',
    quantity: number,
    reason: string,
    prevStock: number,
    newStock: number
  ) => {
    const log: InventoryHistory = {
      id: 'ih_' + Math.random().toString(36).substr(2, 9),
      productId,
      productName,
      type,
      quantity,
      reason,
      date: new Date().toISOString(),
      prevStock,
      newStock,
    };
    setInventoryHistory((prev) => {
      const updated = [log, ...prev];
      saveToStorage('sf_inventory_history', updated);
      return updated;
    });
  };

  const logGiftInventoryChange = (
    giftId: string,
    giftName: string,
    type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged',
    quantity: number,
    reason: string,
    prevStock: number,
    newStock: number
  ) => {
    const log: InventoryHistory = {
      id: 'ih_gft_' + Math.random().toString(36).substr(2, 9),
      productId: '',
      productName: '',
      giftId,
      giftName,
      isGift: true,
      type,
      quantity,
      reason,
      date: new Date().toISOString(),
      prevStock,
      newStock,
    };
    setInventoryHistory((prev) => {
      const updated = [log, ...prev];
      saveToStorage('sf_inventory_history', updated);
      return updated;
    });
  };

  const addGift = (g: Omit<Gift, 'id' | 'createdAt'>) => {
    const newGift: Gift = {
      ...g,
      id: 'gift_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updated = [newGift, ...gifts];
    setGifts(updated);
    saveToStorage('sf_gifts', updated);

    if (g.currentStock > 0) {
      logGiftInventoryChange(newGift.id, newGift.name, 'stock-in', g.currentStock, 'Initial gift setup stock entry', 0, g.currentStock);
    }
  };

  const updateGift = (id: string, updates: Partial<Gift>) => {
    const updated = gifts.map((g) => {
      if (g.id === id) {
        const merged = { ...g, ...updates };
        if (updates.currentStock !== undefined && updates.currentStock !== g.currentStock) {
          const diff = updates.currentStock - g.currentStock;
          const type = diff > 0 ? 'stock-in' : 'stock-out';
          logGiftInventoryChange(
            g.id,
            g.name,
            type,
            Math.abs(diff),
            'Manual stock overwrite adjustment',
            g.currentStock,
            updates.currentStock
          );
        }
        return merged;
      }
      return g;
    });
    setGifts(updated);
    saveToStorage('sf_gifts', updated);
  };

  const deleteGift = (id: string) => {
    const updated = gifts.filter((g) => g.id !== id);
    setGifts(updated);
    saveToStorage('sf_gifts', updated);
  };

  const adjustGiftStock = (
    giftId: string,
    quantity: number,
    type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged',
    reason: string
  ) => {
    const updated = gifts.map((g) => {
      if (g.id === giftId) {
        const prev = g.currentStock;
        const next = Math.max(0, prev + quantity);
        logGiftInventoryChange(g.id, g.name, type, Math.abs(quantity), reason, prev, next);
        return { ...g, currentStock: next };
      }
      return g;
    });
    setGifts(updated);
    saveToStorage('sf_gifts', updated);
  };

  // Fabric Directory Operations (Meter-Based)
  const addFabric = (f: Omit<Fabric, 'id' | 'createdAt'>): Fabric => {
    const cat = categoriesList.find(c => c.id === f.categoryId);
    const br = brandsList.find(b => b.id === f.brandId);
    const col = colorsList.find(c => c.id === f.colorId);

    const newFabric: Fabric = {
      ...f,
      id: 'fab_' + Math.random().toString(36).substr(2, 9),
      categoryName: cat?.name || f.categoryName || '',
      brandName: br?.name || f.brandName || '',
      colorName: col?.name || f.colorName || '',
      stockMeters: Number(f.stockMeters) || 0,
      purchaseRate: Number(f.purchaseRate) || 0,
      retailRate: Number(f.retailRate) || 0,
      minStockAlertMeters: Number(f.minStockAlertMeters) || 10,
      createdAt: new Date().toISOString(),
    };
    const updated = [newFabric, ...fabrics];
    setFabrics(updated);
    saveToStorage('sf_fabrics', updated);

    if (newFabric.stockMeters > 0) {
      const ledgerEntry: FabricLedgerEntry = {
        id: 'fled_' + Math.random().toString(36).substr(2, 9),
        fabricId: newFabric.id,
        fabricName: newFabric.name,
        date: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refNo: 'OPN-STOCK',
        type: 'opening',
        metersAdded: Number(newFabric.stockMeters),
        metersRemoved: 0,
        balanceMeters: Number(newFabric.stockMeters),
        reason: 'Initial opening meter stock entry',
        operator: 'Admin',
      };
      const updatedLedger = [ledgerEntry, ...fabricLedger];
      setFabricLedger(updatedLedger);
      saveToStorage('sf_fabric_ledger', updatedLedger);
    }
    return newFabric;
  };

  const updateFabric = (id: string, updates: Partial<Fabric>) => {
    const target = fabrics.find(f => f.id === id);
    const cat = updates.categoryId ? categoriesList.find(c => c.id === updates.categoryId) : undefined;
    const br = updates.brandId ? brandsList.find(b => b.id === updates.brandId) : undefined;
    const col = updates.colorId ? colorsList.find(c => c.id === updates.colorId) : undefined;

    const updated = fabrics.map((f) => {
      if (f.id === id) {
        const merged = { 
          ...f, 
          ...updates,
          categoryName: cat?.name || (updates.categoryName !== undefined ? updates.categoryName : f.categoryName),
          brandName: br?.name || (updates.brandName !== undefined ? updates.brandName : f.brandName),
          colorName: col?.name || (updates.colorName !== undefined ? updates.colorName : f.colorName),
        };
        if (updates.stockMeters !== undefined && Number(updates.stockMeters) !== Number(f.stockMeters)) {
          const diff = Number(updates.stockMeters) - Number(f.stockMeters);
          const ledgerEntry: FabricLedgerEntry = {
            id: 'fled_' + Math.random().toString(36).substr(2, 9),
            fabricId: f.id,
            fabricName: updates.name || f.name,
            date: new Date().toISOString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            refNo: 'ADJ-EDIT',
            type: diff > 0 ? 'adjustment-add' : 'adjustment-remove',
            metersAdded: diff > 0 ? diff : 0,
            metersRemoved: diff < 0 ? Math.abs(diff) : 0,
            balanceMeters: Number(updates.stockMeters),
            reason: 'Manual stock meter update from directory edit',
            operator: 'Admin',
          };
          const updatedLedger = [ledgerEntry, ...fabricLedger];
          setFabricLedger(updatedLedger);
          saveToStorage('sf_fabric_ledger', updatedLedger);
        }
        return merged;
      }
      return f;
    });
    setFabrics(updated);
    saveToStorage('sf_fabrics', updated);
  };

  const deleteFabric = (id: string) => {
    const updated = fabrics.filter((f) => f.id !== id);
    setFabrics(updated);
    saveToStorage('sf_fabrics', updated);
  };

  const adjustFabricStock = (
    fabricId: string,
    meters: number,
    type: 'add' | 'remove' | 'damaged',
    reason: string,
    refNo?: string
  ) => {
    const target = fabrics.find(f => f.id === fabricId);
    if (!target) return;
    const prev = Number(target.stockMeters) || 0;
    const delta = Math.abs(Number(meters));
    const next = type === 'add' ? prev + delta : Math.max(0, prev - delta);
    
    const updatedFabrics = fabrics.map(f => f.id === fabricId ? { ...f, stockMeters: next } : f);
    setFabrics(updatedFabrics);
    saveToStorage('sf_fabrics', updatedFabrics);

    const ledgerEntry: FabricLedgerEntry = {
      id: 'fled_' + Math.random().toString(36).substr(2, 9),
      fabricId: target.id,
      fabricName: target.name,
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      refNo: refNo || (type === 'add' ? 'STK-IN' : type === 'damaged' ? 'DMG-OUT' : 'STK-OUT'),
      type: type === 'add' ? 'adjustment-add' : type === 'damaged' ? 'damaged' : 'adjustment-remove',
      metersAdded: type === 'add' ? delta : 0,
      metersRemoved: type !== 'add' ? delta : 0,
      balanceMeters: next,
      reason: reason || (type === 'add' ? 'Manual stock meter addition' : 'Manual meter cut/reduction'),
      operator: 'Staff',
    };
    const updatedLedger = [ledgerEntry, ...fabricLedger];
    setFabricLedger(updatedLedger);
    saveToStorage('sf_fabric_ledger', updatedLedger);
  };

  const createFabricBill = (billData: {
    customerName?: string;
    customerPhone?: string;
    items: { fabricId: string; meters: number; ratePerMeter: number }[];
    paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
    discountAmount?: number;
    amountPaid?: number;
    notes?: string;
  }): FabricBill => {
    const billSerial = (fabricBills.length + 1).toString().padStart(4, '0');
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const billNo = `FB${timeStr}${billSerial}`;

    let subtotal = 0;
    const processedItems: FabricBillItem[] = [];

    let curFabrics = [...fabrics];
    let curLedger = [...fabricLedger];

    (billData.items || []).forEach(item => {
      const fab = curFabrics.find(f => f.id === item.fabricId);
      if (!fab) return;
      const cat = categoriesList.find(c => c.id === fab.categoryId);
      const br = brandsList.find(b => b.id === fab.brandId);
      const col = colorsList.find(c => c.id === fab.colorId);

      const m = Number(item.meters) || 0;
      const rate = Number(item.ratePerMeter) || fab.retailRate || 0;
      const lineTotal = m * rate;
      subtotal += lineTotal;

      processedItems.push({
        fabricId: fab.id,
        fabricSku: fab.sku,
        fabricName: fab.name,
        categoryName: cat?.name || fab.categoryName || '',
        brandName: br?.name || fab.brandName || '',
        colorName: col?.name || fab.colorName || '',
        width: fab.width,
        meters: m,
        ratePerMeter: rate,
        totalAmount: lineTotal,
      });

      const prevStock = Number(fab.stockMeters) || 0;
      const nextStock = Math.max(0, prevStock - m);
      curFabrics = curFabrics.map(f => f.id === fab.id ? { ...f, stockMeters: nextStock } : f);

      curLedger = [{
        id: 'fled_' + Math.random().toString(36).substr(2, 9),
        fabricId: fab.id,
        fabricName: fab.name,
        date: now.toISOString(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refNo: billNo,
        type: 'bill',
        metersAdded: 0,
        metersRemoved: m,
        balanceMeters: nextStock,
        reason: `Fabric Meter Bill sale to ${billData.customerName || 'Customer'}`,
        operator: 'Cashier',
      }, ...curLedger];
    });

    const discount = Number(billData.discountAmount) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    const paid = billData.amountPaid !== undefined ? Number(billData.amountPaid) : grandTotal;
    const due = Math.max(0, grandTotal - paid);

    const newBill: FabricBill = {
      id: 'f_bill_' + Math.random().toString(36).substr(2, 9),
      billNo,
      customerName: billData.customerName || '',
      customerPhone: billData.customerPhone || '',
      items: processedItems,
      subtotal,
      discountAmount: discount,
      grandTotal,
      paymentMethod: billData.paymentMethod,
      amountPaid: paid,
      dueAmount: due,
      date: now.toISOString(),
      status: 'Completed',
      notes: billData.notes,
    };

    const updatedBills = [newBill, ...fabricBills];
    setFabrics(curFabrics);
    setFabricLedger(curLedger);
    setFabricBills(updatedBills);

    saveToStorage('sf_fabrics', curFabrics);
    saveToStorage('sf_fabric_ledger', curLedger);
    saveToStorage('sf_fabric_bills', updatedBills);

    return newBill;
  };

  // Customer Operations
  const findCustomerByPhone = (phone: string, excludeId?: string): Customer | undefined => {
    if (!phone) return undefined;
    const clean = phone.replace(/\D/g, '');
    if (!clean) return undefined;
    return customers.find((c) => {
      if (excludeId && c.id === excludeId) return false;
      const cClean = (c.phone || '').replace(/\D/g, '');
      if (!cClean) return false;
      if (cClean === clean) return true;
      if (clean.length >= 10 && cClean.length >= 10 && clean.slice(-10) === cClean.slice(-10)) return true;
      return false;
    });
  };

  const addCustomer = (name: string, phone: string, notes?: string): Customer => {
    const existing = findCustomerByPhone(phone);
    if (existing) return existing;

    const newCustomer: Customer = {
      id: 'cust_' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      phone: phone.trim(),
      notes,
      createdAt: new Date().toISOString(),
    };
    const updated = [newCustomer, ...customers];
    setCustomers(updated);
    saveToStorage('sf_customers', updated);
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    if (updates.phone) {
      const existing = findCustomerByPhone(updates.phone, id);
      if (existing) {
        throw new Error('Customer already exists with this mobile number.');
      }
    }
    const updated = customers.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setCustomers(updated);
    saveToStorage('sf_customers', updated);
  };

  const deleteCustomer = (id: string) => {
    if (!checkPermission('customers', 'delete')) {
      alert(getPermissionDeniedReason(currentRole, 'customers', 'delete'));
      return;
    }
    const updated = customers.filter((c) => c.id !== id);
    setCustomers(updated);
    saveToStorage('sf_customers', updated);
  };

  // Customer Coupon Operations
  const addCustomerCoupon = (coupon: Omit<CustomerCoupon, 'id'>): CustomerCoupon => {
    const newCoupon: CustomerCoupon = {
      ...coupon,
      id: 'coupon_' + Math.random().toString(36).substr(2, 9),
    };
    const updated = [newCoupon, ...customerCoupons];
    setCustomerCoupons(updated);
    saveToStorage('sf_customer_coupons', updated);
    return newCoupon;
  };

  const updateCustomerCoupon = (id: string, updates: Partial<CustomerCoupon>) => {
    const updated = customerCoupons.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setCustomerCoupons(updated);
    saveToStorage('sf_customer_coupons', updated);
  };

  const deleteCustomerCoupon = (id: string) => {
    const updated = customerCoupons.filter((c) => c.id !== id);
    setCustomerCoupons(updated);
    saveToStorage('sf_customer_coupons', updated);
  };

  const addCouponDeliveryLog = (log: Omit<CouponDeliveryLog, 'id'>) => {
    const newLog: CouponDeliveryLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substr(2, 9),
    };
    setCouponDeliveryLogs((prev) => {
      const updated = [newLog, ...prev];
      saveToStorage('sf_coupon_delivery_logs', updated);
      return updated;
    });
  };

  const updateCouponDeliveryLogStatus = (id: string, status: 'Sent' | 'Pending' | 'Failed') => {
    setCouponDeliveryLogs((prev) => {
      const updated = prev.map((log) => log.id === id ? { ...log, status } : log);
      saveToStorage('sf_coupon_delivery_logs', updated);
      return updated;
    });
  };

  const updateCouponAutomationSettings = (automationSettings: CouponAutomationSettings) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        couponAutomation: automationSettings,
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
  };

  const generateUniqueCouponCode = (prefix = ''): string => {
    const existingCodes = new Set(customerCoupons.map((c) => (c.code || '').toUpperCase()));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXY23456789';
    let attempts = 0;
    while (attempts < 1000) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const fullCode = prefix ? `${prefix.trim().toUpperCase()}${code}` : code;
      if (!existingCodes.has(fullCode)) {
        return fullCode;
      }
      attempts++;
    }
    return (prefix ? prefix.trim().toUpperCase() : '') + Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  // Supplier Operations
  const addSupplier = (s: Omit<Supplier, 'id' | 'createdAt'>) => {
    const newSupplier: Supplier = {
      ...s,
      id: 'supp_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updated = [newSupplier, ...suppliers];
    setSuppliers(updated);
    saveToStorage('sf_suppliers', updated);
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    const updated = suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s));
    setSuppliers(updated);
    saveToStorage('sf_suppliers', updated);
  };

  const deleteSupplier = (id: string) => {
    if (!checkPermission('suppliers', 'delete')) {
      alert(getPermissionDeniedReason(currentRole, 'suppliers', 'delete'));
      return;
    }
    const updated = suppliers.filter((s) => s.id !== id);
    setSuppliers(updated);
    saveToStorage('sf_suppliers', updated);
  };

  // Expense Operations
  const addExpense = (e: any, catArg?: string, amtArg?: number, notesArg?: string) => {
    let newExpense: Expense;
    if (typeof e === 'string') {
      newExpense = {
        id: 'exp_' + Math.random().toString(36).substr(2, 9),
        title: e,
        description: e,
        category: catArg || 'Others',
        amount: Number(amtArg) || 0,
        notes: notesArg || '',
        date: new Date().toISOString(),
      };
    } else {
      newExpense = {
        ...e,
        id: 'exp_' + Math.random().toString(36).substr(2, 9),
        title: e.title || e.description || 'Expense',
        description: e.description || e.title || 'Expense',
        category: e.category || 'Others',
        amount: Number(e.amount) || 0,
        notes: e.notes || e.description || '',
        date: e.date || new Date().toISOString(),
      };
    }
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    saveToStorage('sf_expenses', updated);
  };

  const deleteExpense = (id: string) => {
    if (!checkPermission('expenses', 'delete')) {
      alert(getPermissionDeniedReason(currentRole, 'expenses', 'delete'));
      return;
    }
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    saveToStorage('sf_expenses', updated);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const updated = expenses.map((e) => {
      if (e.id === id) {
        const merged = { ...e, ...updates };
        if (updates.title) merged.description = updates.title;
        if (updates.description) merged.title = updates.description;
        return merged;
      }
      return e;
    });
    setExpenses(updated);
    saveToStorage('sf_expenses', updated);
  };

  // Offers Operations
  const addOffer = (o: Omit<Offer, 'id'>): Offer => {
    const newOffer: Offer = {
      ...o,
      id: 'off_' + Math.random().toString(36).substr(2, 9),
      createdAt: o.createdAt || new Date().toISOString(),
    };
    const updated = [newOffer, ...offers];
    setOffers(updated);
    saveToStorage('sf_offers', updated);
    return newOffer;
  };

  const updateOffer = (id: string, updates: Partial<Offer>) => {
    const updated = offers.map((o) => (o.id === id ? { ...o, ...updates } : o));
    setOffers(updated);
    saveToStorage('sf_offers', updated);
  };

  const toggleOffer = (id: string) => {
    const updated = offers.map((o) => (o.id === id ? { ...o, isActive: !o.isActive } : o));
    setOffers(updated);
    saveToStorage('sf_offers', updated);
  };

  const deleteOffer = (id: string) => {
    const updated = offers.filter((o) => o.id !== id);
    setOffers(updated);
    saveToStorage('sf_offers', updated);
  };

  // Complete POS Sale
  const completeSale = (
    customerPhone: string,
    customerName: string,
    cartItems: { product: Product; quantity: number; discount: number; discountType: 'percentage' | 'flat' }[],
    paymentMethod: 'cash' | 'upi' | 'card' | 'credit',
    appliedCouponCode?: string,
    discountCardNumber?: string,
    amountPaid?: number,
    creditDetails?: {
      dueDate: string;
      reason?: string;
      remarks?: string;
    },
    previousDueDetails?: {
      collectPreviousDue: boolean;
    }
  ): Invoice => {
    // Generate Invoice number: SF + HHMM + SERIAL (exactly 10 characters)
    // 1. Calculate next sequential serial (monotonically increasing)
    let nextSerial = Math.max(lastInvoiceSerial + 1, 1);

    // 2. Exact current bill generation time in 24-hour format: HHMM
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeHHMM = `${hh}${mm}`;

    let serialStr = String(nextSerial).padStart(4, '0');
    let invoiceNo = `SF${timeHHMM}${serialStr}`;

    // 3. Ensure absolute uniqueness against any existing invoices in state
    while (invoices.some((inv) => inv.invoiceNo === invoiceNo)) {
      nextSerial++;
      serialStr = String(nextSerial).padStart(4, '0');
      invoiceNo = `SF${timeHHMM}${serialStr}`;
    }

    setLastInvoiceSerial(nextSerial);
    saveToStorage('sf_last_invoice_serial', nextSerial);

    // Calculate items data and reduce stock
    const itemDetails = cartItems.map((item) => {
      const originalPrice = item.product.sellingPrice;
      let finalPrice = originalPrice;

      // Apply product-specific discount at checkout
      if (item.discount > 0) {
        if (item.discountType === 'percentage') {
          finalPrice = originalPrice * (1 - item.discount / 100);
        } else {
          finalPrice = Math.max(0, originalPrice - item.discount);
        }
      }

      // Calculate GST included in finalPrice
      const gstRate = settings.storeProfile.defaultGstRate;
      const basePrice = finalPrice / (1 + gstRate / 100);
      const gstAmount = finalPrice - basePrice;

      // Adjust product stock
      adjustStock(
        item.product.id,
        -item.quantity,
        'stock-out',
        `POS Checkout Order #${invoiceNo}`
      );

      return {
        productId: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        size: item.product.size,
        color: item.product.color,
        quantity: item.quantity,
        purchasePrice: item.product.purchasePrice,
        sellingPrice: Number(finalPrice.toFixed(2)),
        originalSellingPrice: originalPrice,
        discount: item.discount,
        discountType: item.discountType,
        gstAmount: Number((gstAmount * item.quantity).toFixed(2)),
        total: Number((finalPrice * item.quantity).toFixed(2)),
      };
    });

    const subtotal = itemDetails.reduce((sum, item) => sum + item.total, 0);

    // Apply Coupon/Offer discount
    const evaluationCartItems = cartItems.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      customDiscount: item.discount,
      customDiscountType: item.discountType,
    }));

    const activeOffersForPOS = offers.map((o) => {
      const isCoupon = !o.offerCategory || o.offerCategory === 'coupon';
      if (isCoupon) {
        return {
          ...o,
          isActive: o.isActive && appliedCouponCode?.trim().toUpperCase() === (o.code || '').toUpperCase(),
        };
      }
      return o;
    });

    const activeDiscountCard = discountCardNumber
      ? discountCards.find((c) => c.cardNumber === discountCardNumber && c.status === 'active')
      : null;

    const offerEval = evaluateOffers(
      evaluationCartItems,
      activeOffersForPOS,
      products,
      customerPhone ? { phone: customerPhone, name: customerName } : null,
      invoices,
      gifts,
      activeDiscountCard,
      calculateMembershipDiscount
    );

    const giftSavings = offerEval.freeProducts
      .filter(fp => fp.isGift)
      .reduce((sum, fp) => sum + (fp.product.sellingPrice - fp.price) * fp.quantity, 0);

    const giftPromoPrice = offerEval.freeProducts
      .filter(fp => fp.isGift)
      .reduce((sum, fp) => sum + fp.price * fp.quantity, 0);

    const cardDiscount = offerEval.appliedOffers.find(ao => ao.offer.id === 'membership-card')?.savings ?? 0;
    const couponDiscountWithoutGiftSavings = Math.max(0, offerEval.totalSavings - giftSavings - cardDiscount);

    // Construct details for automatically added free/promo products (BOGO / GWP)
    const freeItemDetails = offerEval.freeProducts.map((fp) => {
      const originalPrice = fp.product.sellingPrice;
      const finalPrice = fp.price;
      const discount = originalPrice - finalPrice;

      const gstRate = settings.storeProfile.defaultGstRate;
      const basePrice = finalPrice / (1 + gstRate / 100);
      const gstAmount = finalPrice - basePrice;

      if (fp.isGift) {
        adjustGiftStock(
          fp.product.id,
          -fp.quantity,
          'stock-out',
          `POS Checkout Reward #${invoiceNo} (${fp.offerCode})`
        );
      } else {
        adjustStock(
          fp.product.id,
          -fp.quantity,
          'stock-out',
          `POS Checkout Reward #${invoiceNo} (${fp.offerCode})`
        );
      }

      return {
        productId: fp.product.id,
        sku: fp.product.sku,
        name: fp.product.name,
        size: fp.product.size || 'OS',
        color: fp.product.color || 'Default',
        quantity: fp.quantity,
        purchasePrice: fp.product.purchasePrice,
        sellingPrice: Number(finalPrice.toFixed(2)),
        originalSellingPrice: originalPrice,
        discount: Number(discount.toFixed(2)),
        discountType: 'flat' as const,
        gstAmount: Number((gstAmount * fp.quantity).toFixed(2)),
        total: Number((finalPrice * fp.quantity).toFixed(2)),
        isGift: fp.isGift,
      };
    });

    const allItemDetails = [...itemDetails, ...freeItemDetails];

    // Increment usage count and revenue of applied offers
    if (offerEval.appliedOffers.length > 0) {
      const updatedOffers = offers.map((o) => {
        const found = offerEval.appliedOffers.find((ap) => ap.offer.id === o.id);
        if (found) {
          return {
            ...o,
            usageCount: (o.usageCount || 0) + 1,
            revenueGenerated: (o.revenueGenerated || 0) + found.savings,
          };
        }
        return o;
      });
      setOffers(updatedOffers);
      saveToStorage('sf_offers', updatedOffers);
    }

    // Apply Discount Card and Checkout Amount from Offer Evaluation
    const finalCheckoutAmount = offerEval.checkoutAmount;

    // Dynamic overall GST calculations on the checkout amount
    const overallGstRate = settings.storeProfile.defaultGstRate;
    const overallBase = finalCheckoutAmount / (1 + overallGstRate / 100);
    const overallGstAmount = finalCheckoutAmount - overallBase;

    const grandTotal = Number(finalCheckoutAmount.toFixed(2));

    // Previous outstanding check
    const prevOutstanding = getPreviousOutstandingForCustomer(customerPhone, undefined, invoices);
    const isCollectingPreviousDue = Boolean(previousDueDetails?.collectPreviousDue && prevOutstanding > 0);

    let changeVal = 0;
    let finalAmountPaidForCurrent = grandTotal;
    let effectivePaymentMethod: 'cash' | 'upi' | 'card' | 'credit' = paymentMethod;
    let initialCreditPayments: CreditPayment[] = [];
    let initialCreditStatus: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue' | undefined = undefined;
    let totalReceivedToday = 0;
    let amountPaidForPreviousDue = 0;
    const priorInvoicesToUpdateMap: { [id: string]: Invoice } = {};

    if (isCollectingPreviousDue) {
      const totalPayable = grandTotal + prevOutstanding;
      if (paymentMethod === 'cash') {
        totalReceivedToday = amountPaid !== undefined ? Math.max(0, amountPaid) : totalPayable;
      } else if (paymentMethod === 'upi' || paymentMethod === 'card') {
        totalReceivedToday = totalPayable;
      } else {
        totalReceivedToday = amountPaid !== undefined ? Math.max(0, amountPaid) : 0;
      }

      // Priority 1: Clear Previous Outstanding first
      amountPaidForPreviousDue = Math.min(prevOutstanding, totalReceivedToday);

      // Priority 2: Apply remaining amount to Current Invoice
      const amountForCurrentInvoice = Math.max(0, totalReceivedToday - amountPaidForPreviousDue);

      changeVal = (paymentMethod === 'cash' && totalReceivedToday > totalPayable)
        ? Math.max(0, totalReceivedToday - totalPayable)
        : 0;

      // Settle prior credit invoices in state
      if (amountPaidForPreviousDue > 0) {
        let remToSettle = amountPaidForPreviousDue;
        const cleanPhone = customerPhone.replace(/\D/g, '');

        const sortedPriors = [...invoices].filter((inv) => {
          if (!inv.customerPhone) return false;
          const invPhone = inv.customerPhone.replace(/\D/g, '');
          if (invPhone !== cleanPhone) return false;
          if (inv.paymentMethod !== 'credit') return false;
          const summary = calculateCreditSummary(inv);
          return summary.balanceDue > 0.01;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const priorInv of sortedPriors) {
          if (remToSettle <= 0) break;
          const summary = calculateCreditSummary(priorInv);
          const payAmt = Math.min(remToSettle, summary.balanceDue);
          if (payAmt > 0) {
            const pmtDate = new Date().toISOString();
            const newPayment: CreditPayment = {
              id: 'pmt_prev_' + Math.random().toString(36).substr(2, 9),
              amount: Number(payAmt.toFixed(2)),
              date: pmtDate,
              paymentMethod: paymentMethod === 'credit' ? 'cash' : paymentMethod,
              notes: `Settlement of Previous Due via POS Invoice #${invoiceNo}`,
            };
            const existingPayments = priorInv.payments || [];
            const updatedPayments = [newPayment, ...existingPayments];
            const updatedSummary = calculateCreditSummary({ ...priorInv, payments: updatedPayments });

            priorInvoicesToUpdateMap[priorInv.id] = {
              ...priorInv,
              payments: updatedPayments,
              creditStatus: updatedSummary.status,
            };
            remToSettle -= payAmt;
          }
        }
      }

      // Current Invoice Settlement
      finalAmountPaidForCurrent = Math.min(grandTotal, amountForCurrentInvoice);
      const isCurrentInvoiceFullyPaid = amountForCurrentInvoice >= (grandTotal - 0.01);

      if (isCurrentInvoiceFullyPaid) {
        effectivePaymentMethod = paymentMethod === 'credit' ? 'cash' : paymentMethod;
        initialCreditStatus = 'Paid';
        if (paymentMethod === 'credit') {
          initialCreditPayments = [
            {
              id: 'pmt_init_' + Date.now(),
              amount: Number(finalAmountPaidForCurrent.toFixed(2)),
              date: new Date().toISOString(),
              paymentMethod: 'cash',
              notes: 'Full Payment at Checkout',
            },
          ];
        }
      } else {
        effectivePaymentMethod = 'credit';
        if (finalAmountPaidForCurrent > 0) {
          initialCreditPayments = [
            {
              id: 'pmt_init_' + Date.now(),
              amount: Number(finalAmountPaidForCurrent.toFixed(2)),
              date: new Date().toISOString(),
              paymentMethod: paymentMethod === 'credit' ? 'cash' : (paymentMethod as any),
              notes: 'Initial Down Payment at Checkout',
            },
          ];
          initialCreditStatus = 'Partially Paid';
        } else {
          initialCreditStatus = 'Unpaid';
        }
      }
    } else {
      // Standard checkout without collecting previous due
      totalReceivedToday = paymentMethod === 'cash' && amountPaid !== undefined
        ? amountPaid
        : (paymentMethod === 'credit' ? (amountPaid ?? 0) : grandTotal);
      amountPaidForPreviousDue = 0;

      if (paymentMethod === 'credit') {
        changeVal = 0;
        finalAmountPaidForCurrent = Math.min(grandTotal, Math.max(0, amountPaid ?? 0));
        if (finalAmountPaidForCurrent > 0) {
          initialCreditPayments = [
            {
              id: 'pmt_init_' + Date.now(),
              amount: Number(finalAmountPaidForCurrent.toFixed(2)),
              date: new Date().toISOString(),
              paymentMethod: 'cash',
              notes: 'Initial Down Payment at Checkout',
            },
          ];
        }
        if (grandTotal - finalAmountPaidForCurrent <= 0.01) {
          initialCreditStatus = 'Paid';
        } else if (finalAmountPaidForCurrent > 0) {
          initialCreditStatus = 'Partially Paid';
        } else {
          initialCreditStatus = 'Unpaid';
        }
      } else {
        changeVal = paymentMethod === 'cash' && amountPaid !== undefined ? Math.max(0, amountPaid - grandTotal) : 0;
        finalAmountPaidForCurrent = paymentMethod === 'cash' && amountPaid !== undefined ? Math.min(grandTotal, amountPaid) : grandTotal;
      }
    }

    const defaultDueDateStr = creditDetails?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create Invoice
    const invoice: Invoice = {
      id: 'inv_' + Math.random().toString(36).substr(2, 9),
      invoiceNo,
      customerPhone: customerPhone || undefined,
      customerName: customerPhone ? (customerName || 'Customer') : 'Walk-in Customer',
      items: allItemDetails,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(couponDiscountWithoutGiftSavings.toFixed(2)),
      discountCardNumber: discountCardNumber || undefined,
      discountCardDiscount: cardDiscount > 0 ? Number(cardDiscount.toFixed(2)) : undefined,
      gstRate: overallGstRate,
      gstAmount: Number(overallGstAmount.toFixed(2)),
      grandTotal,
      paymentMethod: effectivePaymentMethod,
      date: new Date().toISOString(),
      exchangeValidUntil: new Date(Date.now() + (settings.exchangePolicy?.exchangePeriodDays ?? 7) * 24 * 60 * 60 * 1000).toISOString(),
      amountPaid: Number(finalAmountPaidForCurrent.toFixed(2)),
      changeReturned: Number(changeVal.toFixed(2)),
      previousOutstanding: prevOutstanding > 0 ? prevOutstanding : 0,
      collectedPreviousDue: isCollectingPreviousDue,
      totalPaidToday: Number(totalReceivedToday.toFixed(2)),
      amountPaidForPreviousDue: Number(amountPaidForPreviousDue.toFixed(2)),
      dueDate: (effectivePaymentMethod === 'credit' || paymentMethod === 'credit') ? defaultDueDateStr : undefined,
      creditReason: (effectivePaymentMethod === 'credit' || paymentMethod === 'credit') ? creditDetails?.reason : undefined,
      creditRemarks: (effectivePaymentMethod === 'credit' || paymentMethod === 'credit') ? creditDetails?.remarks : undefined,
      creditStatus: initialCreditStatus,
      payments: (effectivePaymentMethod === 'credit' || initialCreditPayments.length > 0) ? initialCreditPayments : undefined,
      appliedOffers: offerEval.appliedOffers,
      freeProducts: offerEval.freeProducts,
    };

    // Save invoice & updated prior invoices in list
    const updatedInvoices = [
      invoice,
      ...invoices.map((inv) => priorInvoicesToUpdateMap[inv.id] || inv),
    ];
    setInvoices(updatedInvoices);
    saveToStorage('sf_invoices', updatedInvoices);

    // Record Usage Log and stats on the Discount Card
    if (discountCardNumber && cardDiscount > 0) {
      const updatedCards = discountCards.map((c) => {
        if (c.cardNumber === discountCardNumber) {
          const newUsageLog = {
            id: 'u_' + Math.random().toString(36).substr(2, 9),
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            date: invoice.date,
            originalAmount: subtotal,
            discountGiven: Number(cardDiscount.toFixed(2)),
            finalAmount: grandTotal,
          };
          return {
            ...c,
            totalSavings: Number((c.totalSavings + cardDiscount).toFixed(2)),
            usageLogs: [newUsageLog, ...c.usageLogs],
          };
        }
        return c;
      });
      setDiscountCards(updatedCards);
      saveToStorage('sf_discount_cards', updatedCards);
    }

    // Add or Update Customer if customer is linked
    if (customerPhone) {
      const existingCustIndex = customers.findIndex((c) => c.phone === customerPhone);
      if (existingCustIndex > -1) {
        const updatedCusts = [...customers];
        updatedCusts[existingCustIndex] = {
          ...updatedCusts[existingCustIndex],
          name: customerName || updatedCusts[existingCustIndex].name,
        };
        setCustomers(updatedCusts);
        saveToStorage('sf_customers', updatedCusts);
      } else {
        addCustomer(customerName || 'Customer', customerPhone);
      }

      // 1. Mark Coupon as Redeemed
      if (appliedCouponCode) {
        const cleanCouponCode = appliedCouponCode.trim().toUpperCase();
        const matchingCouponIndex = customerCoupons.findIndex(
          (c) => (c.code || '').toUpperCase() === cleanCouponCode && c.status === 'active'
        );
        if (matchingCouponIndex > -1) {
          const updatedCoupons = [...customerCoupons];
          updatedCoupons[matchingCouponIndex] = {
            ...updatedCoupons[matchingCouponIndex],
            status: 'redeemed',
            redeemedAt: new Date().toISOString(),
            redeemedInvoiceNo: invoiceNo,
            redeemedBillAmount: grandTotal,
            redeemedDiscount: Number(couponDiscountWithoutGiftSavings.toFixed(2)),
          };
          setCustomerCoupons(updatedCoupons);
          saveToStorage('sf_customer_coupons', updatedCoupons);
        }
      }
    }

    lastFinalizedInvoiceRef.current = invoice;
    ensureCouponGeneratedForInvoice(invoice);
    return invoice;
  };

  const ensureCouponGeneratedForInvoice = React.useCallback((invoice: Invoice): CustomerCoupon | null => {
    if (!invoice) return null;
    const customerPhone = invoice.customerPhone;
    if (!customerPhone || customerPhone.trim().length < 7) {
      return null;
    }

    // Check if we already have a coupon for this invoice
    const existingCoupon = customerCoupons.find((c) => c.invoiceNo === invoice.invoiceNo);
    if (existingCoupon) {
      return existingCoupon;
    }

    const autoConfig = settings?.couponAutomation || {
      enabled: true,
      minPurchaseAmount: 3000,
      discountType: 'percentage',
      discountValue: 10,
      validityDays: 30,
      autoGenerate: true,
      autoWhatsAppDelivery: true,
      autoCouponDetection: true,
      autoApplyOnNextVisit: true,
    };

    if (autoConfig.enabled === false) {
      return null;
    }

    if (invoice.grandTotal < (autoConfig.minPurchaseAmount || 0)) {
      return null;
    }

    const validity = autoConfig.validityDays || 30;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + validity);

    // Generate unique 8 character code
    const existingCodes = new Set(customerCoupons.map((c) => (c.code || '').toUpperCase()));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXY23456789';
    let code = '';
    let attempts = 0;
    while (attempts < 1000) {
      let tempCode = '';
      for (let i = 0; i < 8; i++) {
        tempCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!existingCodes.has(tempCode)) {
        code = tempCode;
        break;
      }
      attempts++;
    }
    if (!code) {
      code = 'CP' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const newCoupon: CustomerCoupon = {
      id: 'coupon_' + Math.random().toString(36).substr(2, 9),
      code: code,
      customerPhone: customerPhone,
      customerName: invoice.customerName || 'Customer',
      invoiceNo: invoice.invoiceNo,
      offerId: 'auto_automation_offer',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: expDate.toISOString().split('T')[0],
      status: 'active',
      discountType: autoConfig.discountType || 'percentage',
      discountValue: autoConfig.discountValue !== undefined ? autoConfig.discountValue : 10,
      minPurchaseAmount: autoConfig.minPurchaseAmount !== undefined ? autoConfig.minPurchaseAmount : 3000,
      autoApplyOnNextVisit: autoConfig.autoApplyOnNextVisit !== undefined ? autoConfig.autoApplyOnNextVisit : true,
    };

    setCustomerCoupons((prev) => {
      if (prev.some((c) => c.invoiceNo === invoice.invoiceNo)) return prev;
      const updated = [newCoupon, ...prev];
      saveToStorage('sf_customer_coupons', updated);
      return updated;
    });

    const deliveryLog: CouponDeliveryLog = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      customerName: invoice.customerName || 'Customer',
      customerPhone: customerPhone,
      couponCode: code,
      invoiceNo: invoice.invoiceNo,
      date: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: 'Pending',
    };

    setCouponDeliveryLogs((prev) => {
      if (prev.some((log) => log.invoiceNo === invoice.invoiceNo)) return prev;
      const updated = [deliveryLog, ...prev];
      saveToStorage('sf_coupon_delivery_logs', updated);
      return updated;
    });

    return newCoupon;
  }, [settings, customerCoupons]);

  const runPostPrintAutomation = React.useCallback((invoice: Invoice) => {
    if (!invoice) return;
    if (processedInvoiceAutomationRef.current.has(invoice.invoiceNo)) return;
    processedInvoiceAutomationRef.current.add(invoice.invoiceNo);
    ensureCouponGeneratedForInvoice(invoice);
  }, [ensureCouponGeneratedForInvoice]);

  const triggerPostPrintAutomation = React.useCallback((invoice: Invoice) => {
    runPostPrintAutomation(invoice);
  }, [runPostPrintAutomation]);

  const recordCreditPayment = (
    invoiceId: string,
    amount: number,
    paymentMethod: 'cash' | 'upi' | 'card' = 'cash',
    notes?: string,
    date?: string
  ) => {
    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === invoiceId) {
        const pmtDate = date || new Date().toISOString();
        const newPayment: CreditPayment = {
          id: 'pmt_' + Math.random().toString(36).substr(2, 9),
          amount: Number(amount.toFixed(2)),
          date: pmtDate,
          paymentMethod,
          notes,
        };
        const existingPayments = inv.payments || [];
        const updatedPayments = [newPayment, ...existingPayments];

        const summary = calculateCreditSummary({ ...inv, payments: updatedPayments });

        return {
          ...inv,
          payments: updatedPayments,
          creditStatus: summary.status,
        };
      }
      return inv;
    });
    setInvoices(updatedInvoices);
    saveToStorage('sf_invoices', updatedInvoices);
  };

  const markCreditInvoiceAsPaid = (
    invoiceId: string,
    paymentMethod: 'cash' | 'upi' | 'card' = 'cash',
    notes: string = 'Marked as paid in full'
  ) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const summary = calculateCreditSummary(inv);
    if (summary.balanceDue <= 0) return;
    recordCreditPayment(invoiceId, summary.balanceDue, paymentMethod, notes);
  };

  const updateStoreProfile = (profile: StoreProfile) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        storeProfile: profile,
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
  };

  const updateStoreBranding = (branding: StoreBranding) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        storeBranding: branding,
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
  };

  const updateTheme = (theme: 'luxury' | 'light') => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        theme,
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
  };

  const updateExchangePolicySettings = (policy: ExchangePolicySettings) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        exchangePolicy: policy,
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
    addAuditLog('Exchange Policy', `Updated Exchange Policy settings. Period: ${policy.exchangePeriodDays} days.`);
  };

  const addExchangeRecord = (record: Omit<ExchangeRecord, 'id' | 'date'>) => {
    const newExchange: ExchangeRecord = {
      ...record,
      id: `EXC_${Date.now()}`,
      date: new Date().toISOString(),
    };

    // Process inventory updates for returned (exchanged) items
    newExchange.exchangedItems.forEach((item) => {
      // Returned item: add stock back (positive number adds stock)
      adjustStock(item.productId, item.quantity, 'stock-in', `Exchange Return (Orig Invoice: ${record.originalInvoiceNo})`);
    });

    // Process inventory updates for new items
    newExchange.newItems.forEach((item) => {
      // New item: deduct stock (negative number subtracts stock)
      adjustStock(item.productId, -item.quantity, 'stock-out', `Exchange Issued (Orig Invoice: ${record.originalInvoiceNo})`);
    });

    // Save exchange record
    const updatedExchanges = [newExchange, ...exchanges];
    setExchanges(updatedExchanges);
    saveToStorage('sf_exchanges', updatedExchanges);

    // Update original invoice's exchangeStatus if invoice exists
    const matchingInvoice = invoices.find(
      (inv) => inv.invoiceNo === record.originalInvoiceNo || inv.id === record.originalSaleId
    );
    if (matchingInvoice) {
      const totalPurchasedQty = matchingInvoice.items.reduce((s, it) => s + it.quantity, 0);
      const allExchangesForInvoice = updatedExchanges.filter(
        (e) => e.originalInvoiceNo === matchingInvoice.invoiceNo || e.originalSaleId === matchingInvoice.id
      );
      const totalExchangedQty = allExchangesForInvoice.reduce(
        (sum, e) => sum + e.exchangedItems.reduce((isum, item) => isum + item.quantity, 0),
        0
      );

      const updatedExchangeStatus: 'NO EXCHANGE' | 'PARTIALLY EXCHANGED' | 'FULLY EXCHANGED' =
        totalExchangedQty >= totalPurchasedQty
          ? 'FULLY EXCHANGED'
          : totalExchangedQty > 0
          ? 'PARTIALLY EXCHANGED'
          : 'NO EXCHANGE';

      const updatedInvoices = invoices.map((inv) =>
        inv.id === matchingInvoice.id ? { ...inv, exchangeStatus: updatedExchangeStatus } : inv
      );
      setInvoices(updatedInvoices);
      saveToStorage('sf_invoices', updatedInvoices);
    }

    // Log audit
    addAuditLog('Exchange Processed', `Processed exchange for invoice ${record.originalInvoiceNo}. Returned: ${record.exchangedItems.length} items, Issued: ${record.newItems.length} items.`);

    return { success: true, message: 'Exchange processed successfully!', exchange: newExchange };
  };

  const resetToDefaults = () => {
    setProducts(INITIAL_PRODUCTS);
    setFabrics(INITIAL_FABRICS);
    setFabricLedger(INITIAL_FABRIC_LEDGER);
    setFabricBills([]);
    saveToStorage('sf_fabrics', INITIAL_FABRICS);
    saveToStorage('sf_fabric_ledger', INITIAL_FABRIC_LEDGER);
    saveToStorage('sf_fabric_bills', []);
    setGifts(INITIAL_GIFTS);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setInvoices(INITIAL_INVOICES);
    setExpenses(INITIAL_EXPENSES);
    setOffers(INITIAL_OFFERS);
    setInventoryHistory(INITIAL_INVENTORY_HISTORY);
    setDiscountCards(INITIAL_DISCOUNT_CARDS);
    setLastMembershipSerial(0);
    setLastInvoiceSerial(0);
    saveToStorage('sf_last_invoice_serial', 0);
    const defaultSettings = { storeProfile: DEFAULT_STORE_PROFILE, theme: 'luxury' as const };
    setSettings(defaultSettings);
    
    // Default 6-digit PIN is "123456"
    const defaultHash = hashPin('123456');
    setAdminPinHash(defaultHash);

    setMembershipTypes(DEFAULT_MEMBERSHIP_TYPES);
    setMembershipDiscountRules(DEFAULT_DISCOUNT_RULES);
    const initialCusts: MembershipCustomer[] = INITIAL_DISCOUNT_CARDS.map(card => {
      const mType = (card.cardType || 'PLATINUM').toUpperCase();
      const cleanType = mType.includes('SILVER') ? 'Silver' : mType.includes('GOLD') ? 'Gold' : 'PLATINUM';
      return {
        id: card.id,
        customerName: card.customerName,
        mobileNumber: card.mobileNumber,
        cardNumber: card.cardNumber,
        barcode: card.barcodeText || '',
        membershipType: cleanType,
        discountRules: JSON.stringify(DEFAULT_DISCOUNT_RULES.filter(r => r.membershipTypeId === cleanType)),
        issueDate: card.issueDate || new Date().toISOString(),
        expiryDate: card.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: card.status as any || 'active',
      };
    });
    setMembershipCustomers(initialCusts);

    const defaultCategories: CategoryMaster[] = [
      { id: 'cat_1', name: 'Suits & Blazers', status: 'active' },
      { id: 'cat_2', name: 'Shirts', status: 'active' },
      { id: 'cat_3', name: 'Trousers', status: 'active' },
      { id: 'cat_4', name: 'Footwear', status: 'active' },
      { id: 'cat_5', name: 'Accessories', status: 'active' },
      { id: 'cat_6', name: 'Casual Wear', status: 'active' },
      { id: 'cat_g_bottle', name: 'Bottle', status: 'active' },
      { id: 'cat_g_wallet', name: 'Wallet', status: 'active' },
      { id: 'cat_g_cap', name: 'Cap', status: 'active' },
      { id: 'cat_g_perfume', name: 'Perfume', status: 'active' },
      { id: 'cat_g_belt', name: 'Belt', status: 'active' },
      { id: 'cat_g_socks', name: 'Socks', status: 'active' },
      { id: 'cat_g_keychain', name: 'Keychain', status: 'active' },
      { id: 'cat_g_mug', name: 'Coffee Mug', status: 'active' },
      { id: 'cat_g_bag', name: 'Bag', status: 'active' },
      { id: 'cat_g_hankey', name: 'Handkerchief', status: 'active' },
      { id: 'cat_g_voucher', name: 'Gift Voucher', status: 'active' },
      { id: 'cat_g_promo', name: 'Promotional Merchandise', status: 'active' }
    ];
    setCategoriesList(defaultCategories);
    saveToStorage('sf_categories', defaultCategories);

    const defaultBrands: BrandMaster[] = [
      { id: 'br_1', name: 'Cavalli & Co.', status: 'active' },
      { id: 'br_2', name: 'Albin Mill', status: 'active' },
      { id: 'br_3', name: 'Marchesi', status: 'active' },
      { id: 'br_4', name: 'Savile Row', status: 'active' },
      { id: 'br_5', name: 'Monarque', status: 'active' },
      { id: 'br_g_hydrofit', name: 'HydroFit', status: 'active' },
      { id: 'br_g_aura', name: 'Aura Leathers', status: 'active' },
      { id: 'br_g_vogue', name: 'Vogue Threads', status: 'active' },
      { id: 'br_g_smart', name: 'Smart Fashion', status: 'active' }
    ];
    setBrandsList(defaultBrands);
    saveToStorage('sf_brands', defaultBrands);

    const defaultSizes: SizeMaster[] = [
      { id: 'sz_1', name: '34', status: 'active' },
      { id: 'sz_2', name: '36', status: 'active' },
      { id: 'sz_3', name: '38', status: 'active' },
      { id: 'sz_4', name: '40', status: 'active' },
      { id: 'sz_5', name: '42L', status: 'active' },
      { id: 'sz_6', name: 'One Size', status: 'active' }
    ];
    setSizesList(defaultSizes);
    saveToStorage('sf_sizes', defaultSizes);

    const defaultColors: ColorMaster[] = [
      { id: 'col_1', name: 'Midnight Blue / Gold Lining', status: 'active' },
      { id: 'col_2', name: 'Ivory White', status: 'active' },
      { id: 'col_3', name: 'Saddle Tan', status: 'active' },
      { id: 'col_4', name: 'Charcoal Grey', status: 'active' },
      { id: 'col_5', name: 'Midnight Black', status: 'active' }
    ];
    setColorsList(defaultColors);
    saveToStorage('sf_colors', defaultColors);

    saveToStorage('sf_products', INITIAL_PRODUCTS);
    saveToStorage('sf_gifts', INITIAL_GIFTS);
    saveToStorage('sf_customers', INITIAL_CUSTOMERS);
    saveToStorage('sf_suppliers', INITIAL_SUPPLIERS);
    saveToStorage('sf_invoices', INITIAL_INVOICES);
    saveToStorage('sf_expenses', INITIAL_EXPENSES);
    saveToStorage('sf_offers', INITIAL_OFFERS);
    saveToStorage('sf_inventory_history', INITIAL_INVENTORY_HISTORY);
    saveToStorage('sf_discount_cards', INITIAL_DISCOUNT_CARDS);
    localStorage.setItem('sf_last_membership_serial', '0');
    saveToStorage('sf_settings', defaultSettings);
    localStorage.setItem('sf_admin_pin_encrypted', defaultHash);
    localStorage.removeItem('sf_admin_pin');

    saveToStorage('sf_membership_types', DEFAULT_MEMBERSHIP_TYPES);
    saveToStorage('sf_membership_discount_rules', DEFAULT_DISCOUNT_RULES);
    saveToStorage('sf_membership_customers', initialCusts);
    setCustomerCoupons([]);
    saveToStorage('sf_customer_coupons', []);
  };

  const backupData = (): string => {
    const fullBackup = {
      products,
      gifts,
      customers,
      suppliers,
      invoices,
      expenses,
      offers,
      inventoryHistory,
      discountCards,
      settings,
      adminPinHash,
      membershipTypes,
      membershipDiscountRules,
      membershipCustomers,
      categoriesList,
      brandsList,
      sizesList,
      colorsList,
      customerCoupons,
    };
    return JSON.stringify(fullBackup, null, 2);
  };

  const restoreData = (jsonStr: string): { success: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(jsonStr);

      // Simple validation of parsed contents
      if (
        parsed.products &&
        Array.isArray(parsed.products) &&
        parsed.settings &&
        parsed.settings.storeProfile
      ) {
        setProducts(parsed.products);
        saveToStorage('sf_products', parsed.products);

        if (parsed.gifts && Array.isArray(parsed.gifts)) {
          setGifts(parsed.gifts);
          saveToStorage('sf_gifts', parsed.gifts);
        } else {
          setGifts(INITIAL_GIFTS);
          saveToStorage('sf_gifts', INITIAL_GIFTS);
        }

        if (parsed.customers && Array.isArray(parsed.customers)) {
          setCustomers(parsed.customers);
          saveToStorage('sf_customers', parsed.customers);
        }
        if (parsed.suppliers && Array.isArray(parsed.suppliers)) {
          setSuppliers(parsed.suppliers);
          saveToStorage('sf_suppliers', parsed.suppliers);
        }
        if (parsed.invoices && Array.isArray(parsed.invoices)) {
          setInvoices(parsed.invoices);
          saveToStorage('sf_invoices', parsed.invoices);
        }
        if (parsed.expenses && Array.isArray(parsed.expenses)) {
          setExpenses(parsed.expenses);
          saveToStorage('sf_expenses', parsed.expenses);
        }
        if (parsed.offers && Array.isArray(parsed.offers)) {
          setOffers(parsed.offers);
          saveToStorage('sf_offers', parsed.offers);
        }
        if (parsed.inventoryHistory && Array.isArray(parsed.inventoryHistory)) {
          setInventoryHistory(parsed.inventoryHistory);
          saveToStorage('sf_inventory_history', parsed.inventoryHistory);
        }
        if (parsed.discountCards && Array.isArray(parsed.discountCards)) {
          setDiscountCards(parsed.discountCards);
          saveToStorage('sf_discount_cards', parsed.discountCards);
        }
        if (parsed.settings) {
          setSettings(parsed.settings);
          saveToStorage('sf_settings', parsed.settings);
        }
        if (parsed.adminPinHash) {
          setAdminPinHash(parsed.adminPinHash);
          localStorage.setItem('sf_admin_pin_encrypted', parsed.adminPinHash);
        } else if (parsed.adminPin) {
          const newHash = hashPin(parsed.adminPin);
          setAdminPinHash(newHash);
          localStorage.setItem('sf_admin_pin_encrypted', newHash);
        }

        if (parsed.membershipTypes && Array.isArray(parsed.membershipTypes)) {
          setMembershipTypes(parsed.membershipTypes);
          saveToStorage('sf_membership_types', parsed.membershipTypes);
        }
        if (parsed.membershipDiscountRules && Array.isArray(parsed.membershipDiscountRules)) {
          setMembershipDiscountRules(parsed.membershipDiscountRules);
          saveToStorage('sf_membership_discount_rules', parsed.membershipDiscountRules);
        }
        if (parsed.membershipCustomers && Array.isArray(parsed.membershipCustomers)) {
          setMembershipCustomers(parsed.membershipCustomers);
          saveToStorage('sf_membership_customers', parsed.membershipCustomers);
        }
        if (parsed.customerCoupons && Array.isArray(parsed.customerCoupons)) {
          setCustomerCoupons(parsed.customerCoupons);
          saveToStorage('sf_customer_coupons', parsed.customerCoupons);
        } else {
          setCustomerCoupons([]);
          saveToStorage('sf_customer_coupons', []);
        }
        if (parsed.fabrics && Array.isArray(parsed.fabrics)) {
          setFabrics(parsed.fabrics);
          saveToStorage('sf_fabrics', parsed.fabrics);
        }
        if (parsed.fabricLedger && Array.isArray(parsed.fabricLedger)) {
          setFabricLedger(parsed.fabricLedger);
          saveToStorage('sf_fabric_ledger', parsed.fabricLedger);
        }
        if (parsed.fabricBills && Array.isArray(parsed.fabricBills)) {
          setFabricBills(parsed.fabricBills);
          saveToStorage('sf_fabric_bills', parsed.fabricBills);
        }
        if (parsed.categoriesList && Array.isArray(parsed.categoriesList)) {
          setCategoriesList(parsed.categoriesList);
          saveToStorage('sf_categories', parsed.categoriesList);
        }
        if (parsed.brandsList && Array.isArray(parsed.brandsList)) {
          setBrandsList(parsed.brandsList);
          saveToStorage('sf_brands', parsed.brandsList);
        }
        if (parsed.sizesList && Array.isArray(parsed.sizesList)) {
          setSizesList(parsed.sizesList);
          saveToStorage('sf_sizes', parsed.sizesList);
        }
        if (parsed.colorsList && Array.isArray(parsed.colorsList)) {
          setColorsList(parsed.colorsList);
          saveToStorage('sf_colors', parsed.colorsList);
        }

        return { success: true };
      } else {
        return { success: false, error: 'Invalid backup file structure. Missing key tables.' };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to parse backup JSON.' };
    }
  };

  const updateLastMembershipSerial = (val: number) => {
    setLastMembershipSerial(val);
    localStorage.setItem('sf_last_membership_serial', String(val));
    setSettings((prev) => {
      const updated = {
        ...prev,
        storeProfile: {
          ...prev.storeProfile,
          lastMembershipSerial: val
        }
      };
      saveToStorage('sf_settings', updated);
      return updated;
    });
  };

  const updateMembershipType = (id: string, updates: Partial<MembershipType>) => {
    const updated = membershipTypes.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setMembershipTypes(updated);
    saveToStorage('sf_membership_types', updated);
  };

  const addMembershipDiscountRule = (rule: Omit<MembershipDiscountRule, 'id'>) => {
    const newRule: MembershipDiscountRule = {
      ...rule,
      id: 'rule_' + Math.random().toString(36).substr(2, 9),
    };
    const updated = [...membershipDiscountRules, newRule];
    setMembershipDiscountRules(updated);
    saveToStorage('sf_membership_discount_rules', updated);
  };

  const updateMembershipDiscountRule = (id: string, updates: Partial<MembershipDiscountRule>) => {
    const updated = membershipDiscountRules.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setMembershipDiscountRules(updated);
    saveToStorage('sf_membership_discount_rules', updated);
  };

  const deleteMembershipDiscountRule = (id: string) => {
    const updated = membershipDiscountRules.filter((r) => r.id !== id);
    setMembershipDiscountRules(updated);
    saveToStorage('sf_membership_discount_rules', updated);
  };

  const reorderMembershipDiscountRules = (membershipTypeId: string, rules: MembershipDiscountRule[]) => {
    const otherRules = membershipDiscountRules.filter((r) => r.membershipTypeId !== membershipTypeId);
    const updated = [...otherRules, ...rules.map((r, idx) => ({ ...r, order: idx }))];
    setMembershipDiscountRules(updated);
    saveToStorage('sf_membership_discount_rules', updated);
  };

  const calculateMembershipDiscount = React.useCallback((cardType: string, subtotal: number, usageLogs: any[] = []) => {
    const standardType = (cardType || '').trim();
    const mType = membershipTypes.find(t => (t.id || '').toLowerCase() === standardType.toLowerCase() || (t.name || '').toLowerCase() === standardType.toLowerCase());
    if (!mType || mType.status === 'inactive') {
      return { discountPercentage: 0, discountAmount: 0 };
    }
    
    if (subtotal < mType.minPurchaseAmount) {
      return { discountPercentage: 0, discountAmount: 0, reason: `Subtotal is below card's minimum purchase of ₹${mType.minPurchaseAmount}` };
    }

    const rules = membershipDiscountRules
      .filter(r => Boolean(r.membershipTypeId && mType.id) && (r.membershipTypeId || '').toLowerCase() === (mType.id || '').toLowerCase())
      .sort((a, b) => b.minPurchase - a.minPurchase);
      
    const matchingRule = rules.find(r => subtotal >= r.minPurchase);
    if (!matchingRule) {
      return { discountPercentage: 0, discountAmount: 0 };
    }

    const pct = matchingRule.discountPercentage;
    let discount = subtotal * (pct / 100);

    if (matchingRule.maxDiscountAmount && discount > matchingRule.maxDiscountAmount) {
      discount = matchingRule.maxDiscountAmount;
    }

    if (mType.maxDiscountPerBill && discount > mType.maxDiscountPerBill) {
      discount = mType.maxDiscountPerBill;
    }

    if (mType.maxMonthlyDiscount) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const monthlySpent = usageLogs.reduce((sum, log) => {
        const logDate = new Date(log.date);
        if (logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth) {
          return sum + (log.discountGiven || 0);
        }
        return sum;
      }, 0);
      const availableMonthly = Math.max(0, mType.maxMonthlyDiscount - monthlySpent);
      if (discount > availableMonthly) {
        discount = availableMonthly;
      }
    }

    if (mType.maxYearlyDiscount) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const yearlySpent = usageLogs.reduce((sum, log) => {
        const logDate = new Date(log.date);
        if (logDate.getFullYear() === currentYear) {
          return sum + (log.discountGiven || 0);
        }
        return sum;
      }, 0);
      const availableYearly = Math.max(0, mType.maxYearlyDiscount - yearlySpent);
      if (discount > availableYearly) {
        discount = availableYearly;
      }
    }

    return {
      discountPercentage: pct,
      discountAmount: Number(discount.toFixed(2)),
    };
  }, [membershipTypes, membershipDiscountRules]);

  const validateCoupon = React.useCallback((
    codeOrCoupon: string | CustomerCoupon,
    customerPhone: string = '',
    cart: CartItem[] = []
  ): CouponValidationResult => {
    let code = '';
    let targetPhone = customerPhone;

    if (typeof codeOrCoupon === 'string') {
      code = codeOrCoupon;
    } else if (codeOrCoupon && typeof codeOrCoupon === 'object') {
      code = codeOrCoupon.code;
      if (!targetPhone) {
        targetPhone = codeOrCoupon.customerPhone;
      }
    }

    if (!code || !code.trim()) {
      return { isValid: false, coupon: null, offer: null, savings: 0, error: 'Empty coupon code' };
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanPhone = targetPhone.replace(/\D/g, '');
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Try to find a personalized coupon in customerCoupons matching the code
    const personalCoupon = customerCoupons.find(
      (c) => (c.code || '').toUpperCase() === cleanCode
    );

    let finalOffer: Offer | null = null;
    let finalCoupon: CustomerCoupon | null = null;

    if (personalCoupon) {
      finalCoupon = personalCoupon;
      // Validate customer phone number
      const couponPhoneClean = personalCoupon.customerPhone.replace(/\D/g, '');
      if (cleanPhone && couponPhoneClean !== cleanPhone) {
        return {
          isValid: false,
          coupon: personalCoupon,
          offer: null,
          savings: 0,
          error: `Coupon is registered to another phone number: ${personalCoupon.customerPhone}`,
        };
      }

      // Validate status
      if (personalCoupon.status !== 'active') {
        return {
          isValid: false,
          coupon: personalCoupon,
          offer: null,
          savings: 0,
          error: `Coupon is already ${personalCoupon.status}`,
        };
      }

      // Validate expiry
      if (personalCoupon.expiryDate < todayStr) {
        return {
          isValid: false,
          coupon: personalCoupon,
          offer: null,
          savings: 0,
          error: `Coupon expired on ${personalCoupon.expiryDate}`,
        };
      }

      // Find the associated offer
      let associatedOffer = offers.find((o) => o.id === personalCoupon.offerId);
      if (!associatedOffer && (personalCoupon.offerId === 'auto_automation_offer' || personalCoupon.discountType)) {
        associatedOffer = {
          id: personalCoupon.offerId || 'auto_automation_offer',
          name: personalCoupon.discountType === 'percentage' 
            ? `${personalCoupon.discountValue}% OFF` 
            : `₹${personalCoupon.discountValue} OFF`,
          code: personalCoupon.code,
          type: personalCoupon.discountType === 'percentage' ? 'percentage' : 'flat',
          value: personalCoupon.discountValue ?? 0,
          offerCategory: 'coupon',
          requireCoupon: true,
          isActive: true,
          minPurchaseAmount: personalCoupon.minPurchaseAmount ?? 0,
          minBillAmount: personalCoupon.minPurchaseAmount ?? 0,
          alwaysActive: true,
        };
      }
      if (!associatedOffer) {
        return {
          isValid: false,
          coupon: personalCoupon,
          offer: null,
          savings: 0,
          error: 'Associated coupon campaign offer not found',
        };
      }
      finalOffer = associatedOffer;
    } else {
      // 2. Try to find a generic/reusable coupon in offers matching the code
      const genericOffer = offers.find(
        (o) =>
          (o.code || '').toUpperCase() === cleanCode &&
          (o.offerCategory === 'coupon' || o.requireCoupon === true)
      );

      if (!genericOffer) {
        return {
          isValid: false,
          coupon: null,
          offer: null,
          savings: 0,
          error: `Invalid coupon code: "${code}"`,
        };
      }

      finalOffer = genericOffer;

      // Validate active status of the generic offer
      if (!genericOffer.isActive) {
        return {
          isValid: false,
          coupon: null,
          offer: genericOffer,
          savings: 0,
          error: 'Coupon campaign is currently inactive',
        };
      }

      // Validate general campaign dates if any
      if (genericOffer.endDate && genericOffer.endDate < todayStr) {
        return {
          isValid: false,
          coupon: null,
          offer: genericOffer,
          savings: 0,
          error: `Coupon campaign expired on ${genericOffer.endDate}`,
        };
      }
      if (genericOffer.expiryDate && genericOffer.expiryDate < todayStr) {
        return {
          isValid: false,
          coupon: null,
          offer: genericOffer,
          savings: 0,
          error: `Coupon campaign expired on ${genericOffer.expiryDate}`,
        };
      }

      // Validate customer eligibility rules on the offer if any
      if (genericOffer.customerEligibility && genericOffer.customerEligibility !== 'all') {
        // Find if this customer has a membership card matching the eligibility
        const card = discountCards.find(
          (c) => c.mobileNumber && c.mobileNumber.replace(/\D/g, '') === cleanPhone && c.status === 'active'
        );
        const cardType = card?.cardType?.toLowerCase();
        const ruleType = genericOffer.customerEligibility?.toLowerCase();

        if (!card || cardType !== ruleType) {
          return {
            isValid: false,
            coupon: null,
            offer: genericOffer,
            savings: 0,
            error: `Coupon only valid for ${(genericOffer.customerEligibility || '').toUpperCase()} members`,
          };
        }
      }
    }

    // Now, let's run evaluation on this coupon to check if it qualifies for the cart!
    if (cart.length === 0) {
      return {
        isValid: true,
        coupon: finalCoupon,
        offer: finalOffer,
        savings: 0,
      };
    }

    // Prepare active offers where ONLY this coupon/offer is allowed to apply if there's any other coupon
    const activeOffersForPOS = offers.map((o) => {
      const isCoupon = o.offerCategory === 'coupon' || o.requireCoupon;
      if (isCoupon) {
        // Only keep the targeted offer active as a coupon
        return {
          ...o,
          isActive: o.isActive && o.id === finalOffer!.id,
        };
      }
      return o;
    });

    const offerEval = evaluateOffers(
      cart,
      activeOffersForPOS,
      products,
      targetPhone ? { phone: targetPhone, name: '' } : null,
      invoices,
      gifts,
      null,
      calculateMembershipDiscount
    );

    // Let's find if finalOffer was applied and what savings it generated
    const appliedRecord = offerEval.appliedOffers.find((ao) => ao.offer.id === finalOffer!.id);
    const savings = appliedRecord ? appliedRecord.savings : 0;

    // Check if there's any minimum purchase or quantity requirements not met
    const minBill = finalOffer.minBillAmount || finalOffer.minPurchaseAmount || 0;
    const subtotal = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);

    if (minBill > 0 && subtotal < minBill) {
      return {
        isValid: false,
        coupon: finalCoupon,
        offer: finalOffer,
        savings: 0,
        error: `Minimum bill of ₹${minBill} required (Current subtotal: ₹${subtotal.toFixed(2)})`,
      };
    }

    return {
      isValid: true,
      coupon: finalCoupon,
      offer: finalOffer,
      savings,
    };
  }, [customerCoupons, offers, discountCards, products, invoices, gifts, calculateMembershipDiscount]);

  const getEligibleCoupons = React.useCallback((customerPhone: string): CustomerCoupon[] => {
    if (!customerPhone) return [];
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const todayStr = new Date().toISOString().split('T')[0];

    return customerCoupons.filter((c) => {
      const couponPhoneClean = c.customerPhone.replace(/\D/g, '');
      return couponPhoneClean === cleanPhone && c.status === 'active' && c.expiryDate >= todayStr;
    });
  }, [customerCoupons]);

  const getBestCouponForCart = React.useCallback((
    customerPhone: string,
    cart: CartItem[]
  ): {
    bestCoupon: CustomerCoupon | null;
    bestOffer: Offer | null;
    maxSavings: number;
  } | null => {
    const eligible = getEligibleCoupons(customerPhone);
    if (eligible.length === 0 || cart.length === 0) return null;

    let maxSavings = -1;
    let bestCoupon: CustomerCoupon | null = null;
    let bestOffer: Offer | null = null;

    eligible.forEach((coupon) => {
      const validation = validateCoupon(coupon.code, customerPhone, cart);
      if (validation.isValid && validation.savings > maxSavings) {
        maxSavings = validation.savings;
        bestCoupon = coupon;
        bestOffer = validation.offer;
      }
    });

    if (maxSavings <= 0) return null;

    return {
      bestCoupon,
      bestOffer,
      maxSavings,
    };
  }, [getEligibleCoupons, validateCoupon]);

  const autoDetectCoupons = React.useCallback((mobileNumber: string): CustomerCoupon[] => {
    return getEligibleCoupons(mobileNumber);
  }, [getEligibleCoupons]);

  const calculateBestSavings = React.useCallback((
    availableCoupons: CustomerCoupon[],
    billAmount: number
  ): {
    bestCoupon: CustomerCoupon | null;
    bestOffer: Offer | null;
    maxSavings: number;
  } | null => {
    if (!availableCoupons || availableCoupons.length === 0 || billAmount <= 0) return null;

    const dummyProduct: Product = {
      id: 'dummy_bill_product',
      sku: 'DUMMY_BILL',
      name: 'Dummy Bill Product',
      category: 'General',
      brand: '',
      size: '',
      color: '',
      purchasePrice: billAmount,
      sellingPrice: billAmount,
      discount: 0,
      discountType: 'percentage',
      currentStock: 9999,
      minStockAlert: 1,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const dummyCart: CartItem[] = [
      {
        product: dummyProduct,
        quantity: 1,
        customDiscount: 0,
        customDiscountType: 'percentage',
      },
    ];

    let maxSavings = -1;
    let bestCoupon: CustomerCoupon | null = null;
    let bestOffer: Offer | null = null;

    availableCoupons.forEach((coupon) => {
      const validation = validateCoupon(coupon.code, coupon.customerPhone, dummyCart);
      if (validation.isValid && validation.savings > maxSavings) {
        maxSavings = validation.savings;
        bestCoupon = coupon;
        bestOffer = validation.offer;
      }
    });

    if (maxSavings <= 0) return null;

    return {
      bestCoupon,
      bestOffer,
      maxSavings,
    };
  }, [validateCoupon]);

  const couponValidationEngine = React.useMemo(() => ({
    validateCoupon,
    getEligibleCoupons,
    getBestCouponForCart,
    autoDetectCoupons,
    calculateBestSavings,
    appliedCoupons,
    setAppliedCoupons,
    cashierOverrideCouponCode,
    setCashierOverrideCouponCode,
  }), [
    validateCoupon,
    getEligibleCoupons,
    getBestCouponForCart,
    autoDetectCoupons,
    calculateBestSavings,
    appliedCoupons,
    setAppliedCoupons,
    cashierOverrideCouponCode,
    setCashierOverrideCouponCode,
  ]);

  const addMembershipCustomer = (cust: Omit<MembershipCustomer, 'id'>): MembershipCustomer => {
    const newId = 'mc_' + Math.random().toString(36).substr(2, 9);
    const newCust: MembershipCustomer = {
      ...cust,
      id: newId,
    };
    const updatedCusts = [newCust, ...membershipCustomers];
    setMembershipCustomers(updatedCusts);
    saveToStorage('sf_membership_customers', updatedCusts);

    const mType = membershipTypes.find(t => t.id === cust.membershipType);
    const rulesForCard = membershipDiscountRules.filter(r => r.membershipTypeId === cust.membershipType);
    const highestRule = [...rulesForCard].sort((a, b) => b.discountPercentage - a.discountPercentage)[0];
    const defaultPct = highestRule ? highestRule.discountPercentage : 10;

    const newDiscountCard: DiscountCard = {
      id: newId,
      cardNumber: cust.cardNumber,
      barcodeText: cust.barcode,
      customerName: cust.customerName,
      mobileNumber: cust.mobileNumber,
      cardType: cust.membershipType as any,
      discountPercentage: defaultPct,
      maxDiscountLimit: mType ? mType.maxDiscountPerBill : undefined,
      issueDate: cust.issueDate,
      expiryDate: cust.expiryDate,
      status: cust.status as any,
      usageLogs: [],
      totalSavings: 0,
    };

    const updatedDiscountCards = [newDiscountCard, ...discountCards];
    setDiscountCards(updatedDiscountCards);
    saveToStorage('sf_discount_cards', updatedDiscountCards);

    return newCust;
  };

  const updateMembershipCustomer = (id: string, updates: Partial<MembershipCustomer>) => {
    const updatedCusts = membershipCustomers.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setMembershipCustomers(updatedCusts);
    saveToStorage('sf_membership_customers', updatedCusts);

    const updatedDiscountCards = discountCards.map((c) => {
      if (c.id === id) {
        const mCust = updatedCusts.find(mc => mc.id === id);
        if (mCust) {
          const mType = membershipTypes.find(t => t.id === mCust.membershipType);
          const rulesForCard = membershipDiscountRules.filter(r => r.membershipTypeId === mCust.membershipType);
          const highestRule = [...rulesForCard].sort((a, b) => b.discountPercentage - a.discountPercentage)[0];
          const defaultPct = highestRule ? highestRule.discountPercentage : 10;

          return {
            ...c,
            cardNumber: mCust.cardNumber,
            barcodeText: mCust.barcode,
            customerName: mCust.customerName,
            mobileNumber: mCust.mobileNumber,
            cardType: mCust.membershipType as any,
            discountPercentage: defaultPct,
            maxDiscountLimit: mType ? mType.maxDiscountPerBill : undefined,
            expiryDate: mCust.expiryDate,
            status: mCust.status as any,
          };
        }
      }
      return c;
    });
    setDiscountCards(updatedDiscountCards);
    saveToStorage('sf_discount_cards', updatedDiscountCards);
  };

  const deleteMembershipCustomer = (id: string) => {
    const updatedCusts = membershipCustomers.filter((c) => c.id !== id);
    setMembershipCustomers(updatedCusts);
    saveToStorage('sf_membership_customers', updatedCusts);

    const updatedDiscountCards = discountCards.filter((c) => c.id !== id);
    setDiscountCards(updatedDiscountCards);
    saveToStorage('sf_discount_cards', updatedDiscountCards);
  };

  const addMembershipBenefit = (benefit: Omit<MembershipBenefit, 'id' | 'createdAt' | 'updatedAt'>): MembershipBenefit => {
    const newId = 'benefit_' + Math.random().toString(36).substr(2, 9);
    const newBenefit: MembershipBenefit = {
      ...benefit,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...membershipBenefits, newBenefit];
    setMembershipBenefits(updated);
    saveToStorage('sf_membership_benefits', updated);
    return newBenefit;
  };

  const updateMembershipBenefit = (id: string, updates: Partial<MembershipBenefit>) => {
    const updated = membershipBenefits.map((b) =>
      b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
    );
    setMembershipBenefits(updated);
    saveToStorage('sf_membership_benefits', updated);
  };

  const deleteMembershipBenefit = (id: string) => {
    const updated = membershipBenefits.filter((b) => b.id !== id);
    setMembershipBenefits(updated);
    saveToStorage('sf_membership_benefits', updated);
  };

  const reorderMembershipBenefits = (tierId: string, orderedBenefits: MembershipBenefit[]) => {
    const otherBenefits = membershipBenefits.filter((b) => b.tierId !== tierId);
    const updatedOrdered = orderedBenefits.map((b, idx) => ({
      ...b,
      displayOrder: idx,
      updatedAt: new Date().toISOString(),
    }));
    const updated = [...otherBenefits, ...updatedOrdered];
    setMembershipBenefits(updated);
    saveToStorage('sf_membership_benefits', updated);
  };

  const addDiscountCard = (card: Omit<DiscountCard, 'id' | 'usageLogs' | 'totalSavings'>): DiscountCard => {
    const nextSerial = lastMembershipSerial + 1;
    updateLastMembershipSerial(nextSerial);

    const newId = 'dc_' + Math.random().toString(36).substr(2, 9);
    const newCard: DiscountCard = {
      ...card,
      id: newId,
      usageLogs: [],
      totalSavings: 0,
    };
    const updated = [newCard, ...discountCards];
    setDiscountCards(updated);
    saveToStorage('sf_discount_cards', updated);

    const mType = (card.cardType || 'PLATINUM').toUpperCase();
    const cleanType = mType.includes('SILVER') ? 'Silver' : mType.includes('GOLD') ? 'Gold' : 'PLATINUM';
    const rulesForCard = membershipDiscountRules.filter(r => r.membershipTypeId === cleanType);

    const newCust: MembershipCustomer = {
      id: newId,
      customerName: card.customerName,
      mobileNumber: card.mobileNumber,
      cardNumber: card.cardNumber,
      barcode: card.barcodeText || '',
      membershipType: cleanType,
      discountRules: JSON.stringify(rulesForCard),
      issueDate: card.issueDate || new Date().toISOString(),
      expiryDate: card.expiryDate,
      status: card.status as any || 'active',
    };

    const updatedCusts = [newCust, ...membershipCustomers];
    setMembershipCustomers(updatedCusts);
    saveToStorage('sf_membership_customers', updatedCusts);

    return newCard;
  };

  const updateDiscountCard = (id: string, updates: Partial<DiscountCard>) => {
    const updated = discountCards.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setDiscountCards(updated);
    saveToStorage('sf_discount_cards', updated);

    const updatedCusts = membershipCustomers.map((c) => {
      if (c.id === id) {
        const card = updated.find(d => d.id === id);
        if (card) {
          const mType = (card.cardType || 'PLATINUM').toUpperCase();
          const cleanType = mType.includes('SILVER') ? 'Silver' : mType.includes('GOLD') ? 'Gold' : 'PLATINUM';
          const rulesForCard = membershipDiscountRules.filter(r => r.membershipTypeId === cleanType);

          return {
            ...c,
            customerName: card.customerName,
            mobileNumber: card.mobileNumber,
            cardNumber: card.cardNumber,
            barcode: card.barcodeText,
            membershipType: cleanType,
            discountRules: JSON.stringify(rulesForCard),
            expiryDate: card.expiryDate,
            status: card.status as any,
          };
        }
      }
      return c;
    });
    setMembershipCustomers(updatedCusts);
    saveToStorage('sf_membership_customers', updatedCusts);
  };

  const deleteDiscountCard = (id: string) => {
    if (!checkPermission('discount-cards', 'delete')) {
      alert(getPermissionDeniedReason(currentRole, 'discount-cards', 'delete'));
      return;
    }
    const updated = discountCards.filter((c) => c.id !== id);
    setDiscountCards(updated);
    saveToStorage('sf_discount_cards', updated);

    const updatedCusts = membershipCustomers.filter((c) => c.id !== id);
    setMembershipCustomers(updatedCusts);
    saveToStorage('sf_membership_customers', updatedCusts);
  };

  // Category Master Operations
  const addCategory = (name: string, status?: 'active' | 'inactive'): CategoryMaster => {
    const newCat: CategoryMaster = {
      id: 'cat_' + Math.random().toString(36).substr(2, 9),
      name,
      status: status || 'active',
    };
    setCategoriesList((prev) => {
      const updated = [...prev, newCat];
      saveToStorage('sf_categories', updated);
      return updated;
    });
    return newCat;
  };

  const updateCategory = (id: string, updates: Partial<CategoryMaster>) => {
    setCategoriesList((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      saveToStorage('sf_categories', updated);
      return updated;
    });
  };

  const deleteCategory = (id: string) => {
    setCategoriesList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveToStorage('sf_categories', updated);
      return updated;
    });
  };

  // Brand Master Operations
  const addBrand = (name: string, status?: 'active' | 'inactive'): BrandMaster => {
    const newBrand: BrandMaster = {
      id: 'br_' + Math.random().toString(36).substr(2, 9),
      name,
      status: status || 'active',
    };
    setBrandsList((prev) => {
      const updated = [...prev, newBrand];
      saveToStorage('sf_brands', updated);
      return updated;
    });
    return newBrand;
  };

  const updateBrand = (id: string, updates: Partial<BrandMaster>) => {
    setBrandsList((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      saveToStorage('sf_brands', updated);
      return updated;
    });
  };

  const deleteBrand = (id: string) => {
    setBrandsList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveToStorage('sf_brands', updated);
      return updated;
    });
  };

  // Size Master Operations
  const addSize = (name: string, status?: 'active' | 'inactive'): SizeMaster => {
    const newSize: SizeMaster = {
      id: 'sz_' + Math.random().toString(36).substr(2, 9),
      name,
      status: status || 'active',
    };
    setSizesList((prev) => {
      const updated = [...prev, newSize];
      saveToStorage('sf_sizes', updated);
      return updated;
    });
    return newSize;
  };

  const updateSize = (id: string, updates: Partial<SizeMaster>) => {
    setSizesList((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      saveToStorage('sf_sizes', updated);
      return updated;
    });
  };

  const deleteSize = (id: string) => {
    setSizesList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveToStorage('sf_sizes', updated);
      return updated;
    });
  };

  // Color Master Operations
  const addColor = (name: string, status?: 'active' | 'inactive'): ColorMaster => {
    const newColor: ColorMaster = {
      id: 'col_' + Math.random().toString(36).substr(2, 9),
      name,
      status: status || 'active',
    };
    setColorsList((prev) => {
      const updated = [...prev, newColor];
      saveToStorage('sf_colors', updated);
      return updated;
    });
    return newColor;
  };

  const updateColor = (id: string, updates: Partial<ColorMaster>) => {
    setColorsList((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      saveToStorage('sf_colors', updated);
      return updated;
    });
  };

  const deleteColor = (id: string) => {
    setColorsList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveToStorage('sf_colors', updated);
      return updated;
    });
  };

  return (
    <StateContext.Provider
      value={{
        currentUserId,
        setCurrentUserId,
        loginWithCredentials,
        auditLogs,
        addAuditLog,
        currentRole,
        setCurrentRole,
        checkPermission,
        systemUsers,
        addSystemUser,
        updateSystemUser,
        resetUserPassword,
        deleteSystemUser,
        toggleUserStatus,
        products,
        fabrics,
        fabricLedger,
        fabricBills,
        addFabric,
        updateFabric,
        deleteFabric,
        adjustFabricStock,
        createFabricBill,
        customers,
        suppliers,
        invoices,
        expenses,
        offers,
        inventoryHistory,
        settings,
        isAuthenticated,
        adminPin: '******',
        login,
        verifyPin,
        logout,
        changePin,
        changeAdminPin,
        updateInvoicePrefix,
        resetDatabase,
        restoreDatabaseState,
        gifts,
        addGift,
        updateGift,
        deleteGift,
        adjustGiftStock,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        addCustomer,
        findCustomerByPhone,
        updateCustomer,
        deleteCustomer,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addExpense,
        updateExpense,
        deleteExpense,
        addOffer,
        updateOffer,
        deleteOffer,
        toggleOffer,
        customerCoupons,
        addCustomerCoupon,
        updateCustomerCoupon,
        deleteCustomerCoupon,
        generateUniqueCouponCode,
        couponDeliveryLogs,
        setCouponDeliveryLogs,
        addCouponDeliveryLog,
        updateCouponDeliveryLogStatus,
        updateCouponAutomationSettings,
        completeSale,
        recordCreditPayment,
        markCreditInvoiceAsPaid,
        triggerPostPrintAutomation,
        ensureCouponGeneratedForInvoice,
        updateStoreProfile,
        updateStoreBranding,
        updateTheme,
        resetToDefaults,
        backupData,
        restoreData,
        discountCards,
        addDiscountCard,
        updateDiscountCard,
        deleteDiscountCard,
        lastMembershipSerial,
        updateLastMembershipSerial,
        membershipTypes,
        membershipDiscountRules,
        membershipCustomers,
        updateMembershipType,
        addMembershipDiscountRule,
        updateMembershipDiscountRule,
        deleteMembershipDiscountRule,
        reorderMembershipDiscountRules,
        calculateMembershipDiscount,
        addMembershipCustomer,
        updateMembershipCustomer,
        deleteMembershipCustomer,
        membershipBenefits,
        addMembershipBenefit,
        updateMembershipBenefit,
        deleteMembershipBenefit,
        reorderMembershipBenefits,
        categoriesList,
        brandsList,
        sizesList,
        colorsList,
        addCategory,
        updateCategory,
        deleteCategory,
        addBrand,
        updateBrand,
        deleteBrand,
        addSize,
        updateSize,
        deleteSize,
        addColor,
        updateColor,
        deleteColor,
        dateFilter,
        setDateFilter,
        exchanges,
        updateExchangePolicySettings,
        addExchangeRecord,
        couponValidationEngine,
      }}
    >
      {children}
    </StateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
};
