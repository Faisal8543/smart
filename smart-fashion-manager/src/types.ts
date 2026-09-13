/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  sku: string; // Barcode / SKU
  name: string;
  category: string;
  brand: string;
  size: string; // e.g., "S", "M", "L", "XL", "XXL", "38", "40"
  sizes?: string[];
  color: string;
  colors?: string[];
  purchasePrice: number;
  sellingPrice: number;
  discount: number; // percentage or flat
  discountType: 'percentage' | 'flat';
  currentStock: number;
  minStockAlert: number; // threshold for alert
  status: 'active' | 'inactive';
  imageUrl?: string;
  createdAt: string;
}

export interface InventoryHistory {
  id: string;
  productId: string;
  productName: string;
  giftId?: string;
  giftName?: string;
  isGift?: boolean;
  type: 'stock-in' | 'stock-out' | 'adjustment' | 'damaged';
  quantity: number;
  reason: string;
  date: string;
  prevStock: number;
  newStock: number;
}

export interface Gift {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand?: string;
  mrp: number;
  sellingPrice: number; // promotional/customer pays
  purchasePrice: number; // purchase cost
  currentStock: number;
  minStockAlert: number;
  supplier: string;
  imageUrl?: string;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  customDiscount: number; // custom discount at POS
  customDiscountType: 'percentage' | 'flat';
}

export interface CreditPayment {
  id: string;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'upi' | 'card';
  notes?: string;
  receivedBy?: string;
}

export interface Invoice {
  id: string; // Order ID
  invoiceNo: string; // e.g., SF13250001 (SF + HHMM + 4-digit SERIAL)
  customerPhone?: string;
  customerName?: string;
  items: {
    productId: string;
    sku: string;
    name: string;
    size: string;
    color: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    originalSellingPrice: number;
    discount: number;
    discountType: 'percentage' | 'flat';
    gstAmount: number;
    total: number;
  }[];
  subtotal: number;
  discountAmount: number; // overall coupon/offer discount
  discountCardNumber?: string;
  discountCardDiscount?: number;
  gstRate: number; // Default overall or dynamic
  gstAmount: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
  date: string;
  amountPaid?: number;
  changeReturned?: number;
  previousOutstanding?: number;
  collectedPreviousDue?: boolean;
  totalPaidToday?: number;
  amountPaidForPreviousDue?: number;
  dueDate?: string; // YYYY-MM-DD
  creditReason?: string;
  creditRemarks?: string;
  creditStatus?: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  payments?: CreditPayment[];
  appliedOffers?: {
    offer: Offer;
    savings: number;
    description: string;
  }[];
  freeProducts?: {
    product: Product;
    quantity: number;
    offerName: string;
    offerCode: string;
    isGift: boolean;
    price: number;
    giftType?: 'free' | 'discounted';
  }[];
  status?: 'Completed' | 'Cancelled' | 'Returned';
  exchangeValidUntil?: string;
  exchangeStatus?: 'NO EXCHANGE' | 'PARTIALLY EXCHANGED' | 'FULLY EXCHANGED';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company: string;
  email?: string;
  outstandingBalance: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  items: {
    productName: string;
    quantity: number;
    costPrice: number;
  }[];
  totalAmount: number;
  paidAmount: number;
  status: 'ordered' | 'received' | 'cancelled';
  date: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  title?: string;
  notes?: string;
  date: string;
}

export interface Offer {
  id: string;
  code: string; // e.g. FESTIVAL10
  name: string;
  type: 'flat' | 'percentage' | 'bogo' | string; // expanded to string to support many offer types
  value: number; // e.g., 10 for percentage/flat
  minPurchaseAmount: number;
  isActive: boolean;
  expiryDate?: string;

  // Retail Offer Management System extended fields
  description?: string;
  offerCategory?: 'coupon' | 'product-specific';
  scope?: 'entire-store' | 'category' | 'brand' | 'product' | 'sku' | 'multiple-products';
  selectedCategories?: string[];
  selectedBrands?: string[];
  selectedProducts?: string[];
  selectedSkus?: string[];
  excludeProducts?: string[];

  // Buy X Get Y parameters
  buyQty?: number;
  freeQty?: number;
  freeProductSelectionType?: 'same' | 'different' | 'cheapest' | 'selected';
  freeProductId?: string;
  freeProductIds?: string[];
  freeQtyLimit?: number;
  allowCustomerChoice?: boolean;
  repeatPromotion?: boolean;
  maxFreeQty?: number;
  freeItemRule?: 'lowest' | 'highest' | 'same' | 'specific';

  // Buy Above Amount parameters
  minBillAmount?: number;
  giftProductId?: string;
  giftPrice?: number;
  giftType?: 'free' | 'discounted';
  fallbackGiftProductId?: string;

  // Buy Quantity Discount tiers
  buyQtyTiers?: { quantity: number; discountValue: number; discountType: 'percentage' | 'flat' }[];

  // Combo Offer & Bundle parameters
  comboProductIds?: string[];
  comboPrice?: number;

  // Customer Eligibility Rules
  customerEligibility?: 'all' | 'vip' | 'silver' | 'gold' | 'wholesale' | 'staff';
  eligibilityFirstPurchase?: boolean;
  eligibilityBirthdayMonth?: boolean;
  minCustomerAge?: number;
  eligibleGender?: 'all' | 'male' | 'female';

  // Purchase Conditions limits
  minQuantity?: number;
  maxQuantity?: number;
  maxDiscountValue?: number;
  maxUsagePerCustomer?: number;
  totalCampaignLimit?: number;

  // Dates & Times
  startDate?: string;
  endDate?: string;
  alwaysActive?: boolean;
  startTime?: string;
  endTime?: string;
  repeatType?: 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  applicableDays?: string[];
  wholeDay?: boolean;

  // Priority & Stackable
  priority?: number; // e.g., 1 to 10 where higher is evaluated first
  isStackable?: boolean;
  canCombineWithCoupons?: boolean;
  canCombineWithOtherOffers?: boolean;
  highestDiscountWins?: boolean;
  stopProcessingAfterThis?: boolean;

  // Coupon Settings
  requireCoupon?: boolean;
  couponCode?: string;
  couponType?: 'single' | 'reusable';
  autoApply?: boolean;

  // Coupon Generation & Delivery Settings
  autoGenerateCoupon?: boolean;
  whatsappDeliveryEnabled?: boolean;
  couponValidityDays?: number;
  couponPrefix?: string;
  maxRedemption?: number;
  autoApplyOnNextVisit?: boolean;

  // Analytics
  usageCount?: number;
  revenueGenerated?: number;
  createdAt?: string;
}

export interface CustomerCoupon {
  id: string;
  code: string; // 8-character unique alphanumeric code, e.g. X7M2K8QP
  customerPhone: string;
  customerName?: string;
  invoiceNo?: string; // invoice that generated this coupon (if applicable)
  offerId: string; // offer/campaign ID that generated this coupon (can be "auto_automation_offer" for direct coupons)
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'redeemed' | 'expired';
  redeemedAt?: string;
  redeemedInvoiceNo?: string;
  redeemedBillAmount?: number;
  redeemedDiscount?: number;
  discountType?: 'percentage' | 'flat';
  discountValue?: number;
  minPurchaseAmount?: number;
  autoApplyOnNextVisit?: boolean;
}

export interface StoreProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string; // GST Identification Number
  invoicePrefix: string; // e.g. "SF/"
  defaultGstRate: number; // e.g. 12 (%)
  platinumDiscountPercentage: number; // Configurable discount percentage for Platinum cards
  tagline?: string;
  website?: string;
  openingDate?: string; // Store Opening Date, e.g. "15/03/2026"
  lastMembershipSerial?: number; // Last membership card serial number issued
  membershipValidityMonths?: number; // Configurable duration in months for membership cards
  upiId?: string;
  upiDisplayName?: string;
}

export interface StoreBranding {
  logoOriginal?: string; // base64 / permanent storage reference
  logo1024?: string;
  logo512?: string;
  logo256?: string;
  logo128?: string;
  showLogoOnInvoice: boolean;
  showLogoOnCard: boolean;
  printLogoSize: 'small' | 'medium' | 'large';
  showLogoOnBarcode?: boolean;
  showLogoOnReports?: boolean;
  showLogoOnLogin?: boolean;
  logoPosition?: 'left' | 'center' | 'right';
  headerAlignment?: 'left' | 'center' | 'right';
  watermarkLogo?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoFileName?: string;
  logoFileSize?: string;
  logoMimeType?: string;
  logoResolution?: string;
  logoUploadDate?: string;
  cardFrontTemplate?: string;
  cardBackTemplate?: string;
  cardFrontTemplateFileName?: string;
  cardBackTemplateFileName?: string;
  cardFrontTemplateFileSize?: string;
  cardBackTemplateFileSize?: string;
}

export interface CouponAutomationSettings {
  enabled: boolean;
  minPurchaseAmount: number;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  validityDays: number;
  autoGenerate: boolean;
  autoWhatsAppDelivery: boolean;
  autoCouponDetection: boolean;
  autoApplyOnNextVisit: boolean;
}

export interface CouponDeliveryLog {
  id: string;
  customerName: string;
  customerPhone: string;
  couponCode: string;
  invoiceNo: string;
  date: string;
  status: 'Sent' | 'Pending' | 'Failed';
  sentTime?: string;
  resentTime?: string;
}

export interface ExchangePolicySettings {
  enabled: boolean;
  exchangePeriodDays: number;
  originalInvoiceRequired: boolean;
  originalTagsRequired: boolean;
  productMustBeUnused: boolean;
  discountedProductsExchange: boolean;
  promotionalProductsExchange: boolean;
  refundAllowed: boolean;
  exchangeOnly: boolean;
  customPolicyText?: string;
  productsPolicyText?: string;
  fabricsPolicyText?: string;
}

export interface ExchangeRecord {
  id: string;
  originalInvoiceNo: string;
  originalSaleId?: string;
  date: string;
  exchangedItems: {
    productId: string;
    sku: string;
    name: string;
    size: string;
    color: string;
    quantity: number;
    sellingPrice: number;
  }[];
  newItems: {
    productId: string;
    sku: string;
    name: string;
    size: string;
    color: string;
    quantity: number;
    sellingPrice: number;
  }[];
  additionalAmountPaid: number;
  refundAmount?: number;
  cashierName: string;
  notes?: string;
  originalPurchaseDate?: string;
  customerName?: string;
  status?: string;
}

export interface AppSettings {
  storeProfile: StoreProfile;
  theme: 'luxury' | 'light';
  storeBranding?: StoreBranding;
  couponAutomation?: CouponAutomationSettings;
  exchangePolicy?: ExchangePolicySettings;
}

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface DiscountCardUsageLog {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  date: string;
  originalAmount: number;
  discountGiven: number;
  finalAmount: number;
}

export type DiscountCardType = 'platinum' | 'silver' | 'gold' | 'PLATINUM' | 'Silver' | 'Gold' | 'vip' | 'VIP';

export interface MembershipType {
  id: string; // 'Silver', 'Gold', 'Platinum'
  name: string;
  color: string;
  status: 'active' | 'inactive';
  validityMonths: number;
  maxDiscountPerBill: number;
  maxMonthlyDiscount: number;
  maxYearlyDiscount: number;
  minPurchaseAmount: number;
  festivalDiscount: boolean;
  birthdayDiscount: boolean;
  anniversaryDiscount: boolean;
  specialMemberDiscount: boolean;
  exclusiveSaleAccess: boolean;
  freeAlteration: boolean;
  freeDelivery: boolean;
  priorityBilling: boolean;
}

export interface MembershipDiscountRule {
  id: string;
  membershipTypeId: string; // 'Silver' | 'Gold' | 'Platinum'
  minPurchase: number;
  discountPercentage: number;
  maxDiscountAmount: number;
  order: number;
}

export interface MembershipCustomer {
  id: string;
  customerName: string;
  mobileNumber: string;
  cardNumber: string;
  barcode: string;
  membershipType: string; // 'Silver' | 'Gold' | 'Platinum'
  discountRules: string; // JSON-serialized snapshot of rules or simple notes
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'blocked' | 'expired';
}

export interface DiscountCard {
  id: string;
  cardNumber: string;
  barcodeText: string;
  customerName: string;
  mobileNumber: string;
  dob?: string;
  email?: string;
  address?: string;
  cardType: DiscountCardType;
  discountPercentage: number;
  maxDiscountLimit?: number;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'blocked' | 'expired';
  usageLogs: DiscountCardUsageLog[];
  totalSavings: number;
  notes?: string;
}

export interface MembershipBenefit {
  id: string;
  tierId: string; // 'Silver', 'Gold', 'PLATINUM'
  benefitName: string;
  description: string;
  icon: string;
  type: 'Discount' | 'Service' | 'Access' | 'Offer' | 'Gift' | 'Delivery' | 'Alteration' | 'Custom';
  status: 'active' | 'inactive';
  showOnCard: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryMaster {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface BrandMaster {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface SizeMaster {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface ColorMaster {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface Fabric {
  id: string;
  sku: string; // Fabric Code / SKU e.g. "FAB-COT-001"
  name: string; // Fabric Name e.g. "Premium Cotton"
  categoryId: string; // Foreign key from CategoryMaster
  brandId: string; // Foreign key from BrandMaster
  colorId: string; // Foreign key from ColorMaster
  categoryName?: string; // Resolved name for fallback/export
  brandName?: string; // Resolved name for fallback/export
  colorName?: string; // Resolved name for fallback/export
  width?: string; // e.g. "58 inch"
  purchaseRate: number; // Purchase Rate per Meter (₹ / M)
  retailRate: number; // Retail Rate per Meter (₹ / M)
  stockMeters: number; // Stored in decimal METERS, e.g. 125.50
  minStockAlertMeters: number; // threshold in meters, e.g. 20.00
  status: 'active' | 'inactive';
  description?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface FabricLedgerEntry {
  id: string;
  fabricId: string;
  fabricName: string;
  date: string; // ISO date string
  time?: string;
  refNo: string; // Reference / Bill No. / Note
  type: 'opening' | 'purchase' | 'bill' | 'adjustment-add' | 'adjustment-remove' | 'damaged' | 'return';
  metersAdded: number; // e.g. 25.50
  metersRemoved: number; // e.g. 12.50
  balanceMeters: number; // running balance after operation
  reason?: string;
  operator?: string;
}

export interface FabricBillItem {
  fabricId: string;
  fabricSku: string;
  fabricName: string;
  categoryName: string;
  brandName: string;
  colorName: string;
  width?: string;
  meters: number; // decimal meters, e.g. 12.50
  ratePerMeter: number; // ₹ / M, e.g. 280
  totalAmount: number; // meters * ratePerMeter
}

export interface FabricBill {
  id: string;
  billNo: string; // e.g. FB13250001
  customerName?: string;
  customerPhone?: string;
  items: FabricBillItem[];
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
  amountPaid: number;
  dueAmount?: number;
  date: string;
  status: 'Completed' | 'Cancelled';
  notes?: string;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon: CustomerCoupon | null;
  offer: Offer | null;
  savings: number;
  error?: string;
}

export interface CouponValidationEngine {
  validateCoupon: (
    codeOrCoupon: string | CustomerCoupon,
    customerPhone?: string,
    cart?: CartItem[]
  ) => CouponValidationResult;
  getEligibleCoupons: (customerPhone: string) => CustomerCoupon[];
  getBestCouponForCart: (
    customerPhone: string,
    cart: CartItem[]
  ) => {
    bestCoupon: CustomerCoupon | null;
    bestOffer: Offer | null;
    maxSavings: number;
  } | null;
  autoDetectCoupons: (mobileNumber: string) => CustomerCoupon[];
  calculateBestSavings: (
    availableCoupons: CustomerCoupon[],
    billAmount: number
  ) => {
    bestCoupon: CustomerCoupon | null;
    bestOffer: Offer | null;
    maxSavings: number;
  } | null;
  appliedCoupons: CustomerCoupon[];
  setAppliedCoupons: (coupons: CustomerCoupon[]) => void;
  cashierOverrideCouponCode: string | null;
  setCashierOverrideCouponCode: (code: string | null) => void;
}

export type PermissionModuleKey =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'customers'
  | 'discountCards'
  | 'promotions'
  | 'creditLedger'
  | 'suppliers'
  | 'reports'
  | 'expenses'
  | 'settings'
  | 'userManagement';

export type PermissionActionKey = 'view' | 'add' | 'edit' | 'delete';

export interface ModulePermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export type UserPermissions = Record<PermissionModuleKey, ModulePermissions>;

export interface SystemUser {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  role: 'admin' | 'manager' | 'cashier';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
  isCustomPermissions?: boolean;
  permissions?: UserPermissions;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}




