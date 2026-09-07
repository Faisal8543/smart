import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ArrowLeft, 
  Gift as GiftIcon, 
  Calendar, 
  Tag, 
  Info,
  Check,
  Search,
  Sliders,
  AlertTriangle,
  Zap,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Offer, Product, Gift } from '../types';
import { formatINR } from '../utils/currency';
import { evaluateOffers } from '../utils/offerEvaluator';

interface CreateProductOfferPageProps {
  editingId: string | null;
  offers: Offer[];
  addOffer: (offer: Omit<Offer, 'id'>) => Offer;
  updateOffer: (id: string, offer: Partial<Offer>) => void;
  deleteOffer?: (id: string) => void;
  products: Product[];
  gifts?: Gift[];
  showToast: (msg: string) => void;
}

export const CreateProductOfferPage: React.FC<CreateProductOfferPageProps> = ({
  editingId,
  offers,
  addOffer,
  updateOffer,
  deleteOffer,
  products,
  gifts = [],
  showToast,
}) => {
  const matchedOffer = useMemo(() => {
    return editingId ? offers.find((o) => o.id === editingId) : null;
  }, [editingId, offers]);

  // Wizard state
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form Fields State
  const [name, setName] = useState(matchedOffer?.name || '');
  const [code, setCode] = useState(matchedOffer?.code || '');
  const [description, setDescription] = useState(matchedOffer?.description || '');
  const [priorityType, setPriorityType] = useState<'low' | 'normal' | 'high'>(() => {
    const pri = matchedOffer?.priority || 50;
    if (pri >= 100) return 'high';
    if (pri >= 50) return 'normal';
    return 'low';
  });
  const [isActive, setIsActive] = useState<boolean>(matchedOffer !== null ? matchedOffer.isActive : true);
  const [isStackable, setIsStackable] = useState<boolean>(matchedOffer?.isStackable || false);

  // Coupon configuration states
  const [autoGenerateCoupon, setAutoGenerateCoupon] = useState<boolean>(matchedOffer?.autoGenerateCoupon || false);
  const [whatsappDeliveryEnabled, setWhatsappDeliveryEnabled] = useState<boolean>(matchedOffer?.whatsappDeliveryEnabled || false);
  const [couponValidityDays, setCouponValidityDays] = useState<number>(matchedOffer?.couponValidityDays || 30);
  const [couponPrefix, setCouponPrefix] = useState<string>(matchedOffer?.couponPrefix || '');
  const [maxRedemption, setMaxRedemption] = useState<number>(matchedOffer?.maxRedemption || 0);
  const [autoApplyOnNextVisit, setAutoApplyOnNextVisit] = useState<boolean>(matchedOffer?.autoApplyOnNextVisit || false);

  // Promotion Type
  const [type, setType] = useState<string>(() => {
    if (matchedOffer) {
      if (matchedOffer.offerCategory === 'coupon' || matchedOffer.requireCoupon) {
        return 'coupon';
      }
      return matchedOffer.type || 'percentage';
    }
    return 'percentage';
  });
  const [value, setValue] = useState<number>(matchedOffer?.value || 10);

  // Buy X Get Y Rules
  const [buyQty, setBuyQty] = useState<number>(matchedOffer?.buyQty || 2);
  const [freeQty, setFreeQty] = useState<number>(matchedOffer?.freeQty || 1);
  const [freeProductSelectionType, setFreeProductSelectionType] = useState<'same' | 'different'>(
    matchedOffer?.freeProductSelectionType === 'different' ? 'different' : 'same'
  );
  const [freeItemRule, setFreeItemRule] = useState<'lowest' | 'highest' | 'same' | 'specific'>(
    matchedOffer?.freeItemRule || 'lowest'
  );
  const [maxFreeQty, setMaxFreeQty] = useState<number>(matchedOffer?.maxFreeQty || 5);

  // Product Targeting / Scope
  const [scope, setScope] = useState<'entire-store' | 'category' | 'brand' | 'product'>(() => {
    const s = matchedOffer?.scope;
    if (s === 'category' || s === 'brand' || s === 'product') return s;
    return 'entire-store';
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(matchedOffer?.selectedCategories || []);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(matchedOffer?.selectedBrands || []);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(matchedOffer?.selectedProducts || []);

  // Free product selection
  const [freeProductId, setFreeProductId] = useState<string>(matchedOffer?.freeProductId || '');

  // Customer Eligibility & Purchase Limits
  const [customerEligibility, setCustomerEligibility] = useState<'all' | 'silver' | 'gold' | 'platinum' | 'birthday'>(() => {
    const el = matchedOffer?.customerEligibility;
    if (el === 'silver' || el === 'gold' || el === 'staff') return el as any;
    if (matchedOffer?.eligibilityBirthdayMonth) return 'birthday';
    return 'all';
  });

  const [minPurchaseAmount, setMinPurchaseAmount] = useState<number>(matchedOffer?.minPurchaseAmount || 0);
  const [minQuantity, setMinQuantity] = useState<number>(matchedOffer?.minQuantity || 0);

  // Dates & Schedule
  const [alwaysActive, setAlwaysActive] = useState<boolean>(matchedOffer !== null ? (matchedOffer.alwaysActive !== false) : true);
  const [startDate, setStartDate] = useState<string>(matchedOffer?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(matchedOffer?.endDate || matchedOffer?.expiryDate || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>(matchedOffer?.startTime || '09:00');
  const [endTime, setEndTime] = useState<string>(matchedOffer?.endTime || '22:00');

  // Coupon parameters
  const [couponCode, setCouponCode] = useState<string>(matchedOffer?.couponCode || '');

  // Combo Offer Parameters
  const [comboProductIds, setComboProductIds] = useState<string[]>(matchedOffer?.comboProductIds || []);
  const [comboPrice, setComboPrice] = useState<number>(matchedOffer?.comboPrice || 999);

  // Gift Offer parameters
  const [giftProductId, setGiftProductId] = useState<string>(matchedOffer?.giftProductId || '');
  const [giftPrice, setGiftPrice] = useState<number>(matchedOffer?.giftPrice || 0);
  const [minBillAmount, setMinBillAmount] = useState<number>(matchedOffer?.minBillAmount || 2999);
  const [giftType, setGiftType] = useState<'free' | 'discounted'>(matchedOffer?.giftType || 'free');
  const [fallbackGiftProductId, setFallbackGiftProductId] = useState<string>(matchedOffer?.fallbackGiftProductId || '');

  // Gift Offer helper functions to handle pricing mode and auto-fills
  const handleSelectGift = (pId: string) => {
    setGiftProductId(pId);
    if (giftType === 'discounted') {
      const selectedGift = gifts.find(g => g.id === pId);
      if (selectedGift) {
        setGiftPrice(selectedGift.sellingPrice);
      }
    }
  };

  const handleSetGiftType = (type: 'free' | 'discounted') => {
    setGiftType(type);
    if (type === 'free') {
      setGiftPrice(0);
    } else {
      if (giftProductId) {
        const selectedGift = gifts.find(g => g.id === giftProductId);
        if (selectedGift) {
          setGiftPrice(selectedGift.sellingPrice);
        }
      }
    }
  };

  // Search filter inside Targeting/Rules dropdowns
  const [productSearch, setProductSearch] = useState('');
  const [comboSearch, setComboSearch] = useState('');
  const [giftSearch, setGiftSearch] = useState('');
  const [fallbackGiftSearch, setFallbackGiftSearch] = useState('');
  const [freeSearch, setFreeSearch] = useState('');

  // Simulation State
  const [simProductId, setSimProductId] = useState<string>('');
  const [simQuantity, setSimQuantity] = useState<number>(3);
  const [simCouponInput, setSimCouponInput] = useState<string>('');

  // Extract all categories and brands from product catalog
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    return list.sort();
  }, [products]);

  const brands = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.brand))).filter(Boolean);
    return list.sort();
  }, [products]);

  // Set initial simulation product to first available
  useEffect(() => {
    if (products.length > 0 && !simProductId) {
      setSimProductId(products[0].id);
    }
  }, [products, simProductId]);

  // Real-time Auto Generation of Offer Code from Name
  useEffect(() => {
    if (!editingId && name) {
      const autoCode = name
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      setCode(autoCode);
    }
  }, [name, editingId]);

  // Compute Priority Value
  const computedPriority = useMemo(() => {
    if (priorityType === 'high') return 100;
    if (priorityType === 'normal') return 50;
    return 25;
  }, [priorityType]);

  // Compile draft payload for simulation
  const currentOfferPayload = useMemo<Omit<Offer, 'id'>>(() => {
    const finalType = type === 'coupon' ? 'percentage' : type; // evaluate coupons as percentage discounts
    return {
      name: name || 'Unnamed Offer Draft',
      code: code || 'DRAFT_CODE',
      type: finalType,
      value: Number(value) || 0,
      minPurchaseAmount: Number(minPurchaseAmount) || 0,
      isActive: true, // test active in simulation
      isStackable,
      description: description || `Retail Campaign: ${name}`,
      offerCategory: type === 'coupon' ? 'coupon' : 'product-specific',
      scope,
      selectedCategories: scope === 'category' ? selectedCategories : [],
      selectedBrands: scope === 'brand' ? selectedBrands : [],
      selectedProducts: scope === 'product' ? selectedProducts : [],
      buyQty: (finalType === 'bogo' || finalType === 'buy-x-get-y-discount') ? Number(buyQty) : undefined,
      freeQty: (finalType === 'bogo' || finalType === 'buy-x-get-y-discount') ? Number(freeQty) : undefined,
      freeProductSelectionType: (finalType === 'bogo' || finalType === 'buy-x-get-y-discount') ? (freeProductSelectionType === 'different' ? 'different' : 'same') : undefined,
      freeProductId: (finalType === 'bogo' || finalType === 'buy-x-get-y-discount') && freeProductSelectionType === 'different' ? freeProductId : undefined,
      freeItemRule: (finalType === 'bogo' || finalType === 'buy-x-get-y-discount') ? freeItemRule : undefined,
      maxFreeQty: (finalType === 'bogo' || finalType === 'buy-x-get-y-discount') ? Number(maxFreeQty) : undefined,
      customerEligibility: customerEligibility === 'birthday' ? 'all' : customerEligibility as any,
      eligibilityBirthdayMonth: customerEligibility === 'birthday',
      minQuantity: Number(minQuantity) || 0,
      alwaysActive,
      startDate: alwaysActive ? undefined : startDate,
      endDate: alwaysActive ? undefined : endDate,
      startTime: alwaysActive ? undefined : startTime,
      endTime: alwaysActive ? undefined : endTime,
      requireCoupon: type === 'coupon',
      couponCode: type === 'coupon' ? couponCode : undefined,
      comboProductIds: finalType === 'combo' ? comboProductIds : [],
      comboPrice: finalType === 'combo' ? Number(comboPrice) : undefined,
      giftProductId: (finalType === 'gift-with-purchase' || finalType === 'spend-x-get-gift') ? giftProductId : undefined,
      giftPrice: (finalType === 'gift-with-purchase' || finalType === 'spend-x-get-gift') ? Number(giftPrice) : undefined,
      minBillAmount: (finalType === 'gift-with-purchase' || finalType === 'spend-x-get-gift') ? Number(minBillAmount) : undefined,
      giftType: (finalType === 'gift-with-purchase' || finalType === 'spend-x-get-gift') ? giftType : undefined,
      fallbackGiftProductId: (finalType === 'gift-with-purchase' || finalType === 'spend-x-get-gift') ? fallbackGiftProductId : undefined,
      autoGenerateCoupon,
      whatsappDeliveryEnabled,
      couponValidityDays: Number(couponValidityDays) || 30,
      couponPrefix: couponPrefix ? couponPrefix.trim().toUpperCase() : undefined,
      maxRedemption: Number(maxRedemption) || undefined,
      autoApplyOnNextVisit,
    };
  }, [
    name, code, type, value, minPurchaseAmount, isStackable, description, scope,
    selectedCategories, selectedBrands, selectedProducts, buyQty, freeQty,
    freeProductSelectionType, freeProductId, freeItemRule, maxFreeQty, customerEligibility,
    minQuantity, alwaysActive, startDate, endDate, startTime, endTime,
    couponCode, comboProductIds, comboPrice, giftProductId, giftPrice, minBillAmount, giftType, fallbackGiftProductId,
    autoGenerateCoupon, whatsappDeliveryEnabled, couponValidityDays, couponPrefix, maxRedemption, autoApplyOnNextVisit
  ]);

  // POS Live Simulation calculation
  const simResult = useMemo(() => {
    const simProd = products.find((p) => p.id === simProductId);
    if (!simProd) return null;

    // Build local cart
    const cartItems = [
      {
        product: simProd,
        quantity: Number(simQuantity) || 1,
        customDiscount: 0,
        customDiscountType: 'percentage' as const,
      }
    ];

    // If combo, insert combo sibling items to trigger Combo evaluation
    if (type === 'combo' && comboProductIds.length > 0) {
      comboProductIds.forEach(id => {
        if (id !== simProductId) {
          const sibling = products.find(p => p.id === id);
          if (sibling) {
            cartItems.push({
              product: sibling,
              quantity: 1,
              customDiscount: 0,
              customDiscountType: 'percentage',
            });
          }
        }
      });
    }

    const couponRequired = type === 'coupon';
    const couponMatched = !couponRequired || (simCouponInput.trim().toUpperCase() === couponCode.trim().toUpperCase());

    // Build full state & evaluate draft offer (only if coupon is matched if required)
    const simulatedOfferList: Offer[] = couponMatched ? [
      {
        ...currentOfferPayload,
        id: 'simulated_offer',
        priority: computedPriority,
      }
    ] : [];

    const result = evaluateOffers(cartItems, simulatedOfferList, products, null, [], gifts);
    
    // Check if draft offer was actually applied
    const appliedSim = result.appliedOffers.find((ao) => ao.offer.id === 'simulated_offer');
    
    // Calculate non-offer subtotal
    const normalSubtotal = cartItems.reduce((acc, item) => acc + (item.product.sellingPrice * item.quantity), 0);

    return {
      applied: !!appliedSim,
      description: appliedSim ? appliedSim.description : couponRequired && !couponMatched ? 'Coupon Code required to trigger discount.' : 'Offer parameters not met on test items.',
      totalSavings: result.totalSavings,
      checkoutAmount: result.checkoutAmount,
      normalSubtotal,
      freeProducts: result.freeProducts,
      couponRequired,
      couponMatched,
    };
  }, [products, simProductId, simQuantity, simCouponInput, couponCode, currentOfferPayload, type, comboProductIds, computedPriority, gifts]);

  interface ConflictDetails {
    existingCampaign: Offer;
    overlappingItem: string;
    affectedProducts: Product[];
    isBothExclusive: boolean;
    isOneExclusive: boolean;
    severity: 'red' | 'yellow' | 'green';
    reason: string;
  }

  // Conflict Checking Engine
  const checkConflicts = (payload: Omit<Offer, 'id'>): ConflictDetails | null => {
    const activeOffers = offers.filter((o) => o.id !== editingId && o.isActive);
    if (!isActive) return null; // Drafts do not conflict

    for (const other of activeOffers) {
      // 1. Date range overlapping
      const otherAlways = other.alwaysActive !== false;
      const payloadAlways = alwaysActive;

      let datesOverlap = false;
      if (otherAlways || payloadAlways) {
        datesOverlap = true;
      } else {
        const startA = startDate || '';
        const endA = endDate || '';
        const startB = other.startDate || '';
        const endB = other.endDate || '';
        datesOverlap = (startA <= endB) && (startB <= endA);
      }

      if (!datesOverlap) continue;

      // 2. Product/Scope targeting overlapping
      let targetOverlap = false;
      let overlappingItem = '';
      let affectedProducts: Product[] = [];

      if (payload.scope === 'entire-store' || other.scope === 'entire-store') {
        targetOverlap = true;
        overlappingItem = 'Entire Store-wide range';
        affectedProducts = products.slice(0, 4);
      } else if (payload.scope === 'category' && other.scope === 'category') {
        const intersection = (payload.selectedCategories || []).filter((c) => (other.selectedCategories || []).includes(c));
        if (intersection.length > 0) {
          targetOverlap = true;
          overlappingItem = `Category → ${intersection[0]}`;
          affectedProducts = products.filter(p => p.category && String(p.category).toLowerCase() === String(intersection[0] || '').toLowerCase()).slice(0, 4);
        }
      } else if (payload.scope === 'brand' && other.scope === 'brand') {
        const intersection = (payload.selectedBrands || []).filter((b) => (other.selectedBrands || []).includes(b));
        if (intersection.length > 0) {
          targetOverlap = true;
          overlappingItem = `Brand → ${intersection[0]}`;
          affectedProducts = products.filter(p => p.brand && String(p.brand).toLowerCase() === String(intersection[0] || '').toLowerCase()).slice(0, 4);
        }
      } else {
        // Cross-scope resolution: Evaluate if any actual product falls inside both scopes
        const payloadProds = products.filter((p) => isProductInScopeLocal(p, payload));
        const otherProds = products.filter((p) => isProductInScopeLocal(p, other));
        const intersection = payloadProds.filter((p) => otherProds.some((op) => op.id === p.id));
        if (intersection.length > 0) {
          targetOverlap = true;
          overlappingItem = `Product Overlap: ${intersection[0].name}`;
          affectedProducts = intersection.slice(0, 4);
        }
      }

      if (!targetOverlap) continue;

      // 3. Stackable/Exclusive Logic
      const otherStackable = other.isStackable === true;
      const currentStackable = isStackable === true;

      let severity: 'red' | 'yellow' | 'green' = 'green';
      let isBothExclusive = false;
      let isOneExclusive = false;

      if (otherStackable && currentStackable) {
        severity = 'green';
      } else if (!otherStackable && !currentStackable) {
        severity = 'red';
        isBothExclusive = true;
      } else {
        severity = 'yellow';
        isOneExclusive = true;
      }

      return {
        existingCampaign: other,
        overlappingItem,
        affectedProducts,
        isBothExclusive,
        isOneExclusive,
        severity,
        reason: severity === 'red'
          ? 'Both campaigns are configured as Exclusive. Two exclusive pricing strategies targeting the same items during overlapping schedules cannot run concurrently.'
          : severity === 'yellow'
            ? 'At least one of these campaigns is configured as Exclusive. Standard retail policy recommends converting both campaigns to Stackable or adjusting scopes/schedules.'
            : 'No direct conflict blocks publishing. Both campaigns are marked Stackable and can run together.',
      };
    }
    return null;
  };

  const isProductInScopeLocal = (product: Product, off: Omit<Offer, 'id'> | Offer): boolean => {
    const s = off.scope || 'entire-store';
    if (s === 'entire-store') return true;
    if (s === 'category') {
      return (off.selectedCategories || []).some((c) => c && product.category && String(c).toLowerCase() === String(product.category).toLowerCase());
    }
    if (s === 'brand') {
      return (off.selectedBrands || []).some((b) => b && product.brand && String(b).toLowerCase() === String(product.brand).toLowerCase());
    }
    if (s === 'product') {
      return (off.selectedProducts || []).includes(product.id);
    }
    return false;
  };

  // Comprehensive Field-Specific Live Validators
  const fieldErrors = useMemo(() => {
    const errs: {
      name?: string;
      code?: string;
      targeting?: string;
      rules?: string;
      couponCode?: string;
      dateRange?: string;
      timeRange?: string;
      customerEligibility?: string;
      conflict?: string;
    } = {};

    // 1. Campaign Name Validation
    if (!name.trim()) {
      errs.name = 'Offer Name is required.';
    }

    // 2. Offer Code Validation
    if (!code.trim()) {
      errs.code = 'Offer Code is required.';
    }

    // 3. Targeting Validation
    if (scope === 'category' && selectedCategories.length === 0) {
      errs.targeting = 'At least one Category must be selected.';
    } else if (scope === 'brand' && selectedBrands.length === 0) {
      errs.targeting = 'At least one Brand must be selected.';
    } else if (scope === 'product' && selectedProducts.length === 0) {
      errs.targeting = 'At least one apparel item must be target selected.';
    }

    // 4. Offer Rules Validation
    if (type === 'percentage') {
      if (value <= 0 || value > 100) {
        errs.rules = 'Discount percentage must be between 1% and 100%.';
      }
    } else if (type === 'flat') {
      if (value <= 0) {
        errs.rules = 'Flat discount amount must be greater than zero.';
      }
    } else if (type === 'bogo' || type === 'buy-x-get-y-discount') {
      if (buyQty < 1) {
        errs.rules = 'Buy quantity must be at least 1.';
      } else if (freeQty < 1) {
        errs.rules = 'Free/reward quantity must be at least 1.';
      } else if (freeProductSelectionType === 'different' && !freeProductId) {
        errs.rules = 'Please select the reward/free product.';
      }
    } else if (type === 'combo') {
      if (comboProductIds.length < 2) {
        errs.rules = 'Combo bundle requires at least 2 distinct products.';
      } else if (comboPrice <= 0) {
        errs.rules = 'Combo package price must be greater than zero.';
      }
    } else if (type === 'gift-with-purchase') {
      if (!giftProductId) {
        errs.rules = 'Please select the reward gift item from Gifts Master.';
      } else if (giftPrice < 0) {
        errs.rules = 'Gift cost cannot be negative.';
      } else if (minBillAmount <= 0) {
        errs.rules = 'Minimum bill condition must be greater than zero.';
      }
    }

    // 5. Coupon / Duplicate Coupon Validation
    if (type === 'coupon') {
      if (!couponCode.trim()) {
        errs.couponCode = 'Coupon Promo Code is required.';
      } else {
        const hasDuplicate = offers.some(
          (o) => o.id !== editingId && o.type === 'coupon' && o.couponCode?.toUpperCase() === couponCode.toUpperCase()
        );
        if (hasDuplicate) {
          errs.couponCode = 'Duplicate Coupon Code: Already exists in another active/draft campaign.';
        }
      }
    }

    // 6. Customer Eligibility
    if (!customerEligibility) {
      errs.customerEligibility = 'Please select customer eligibility.';
    }

    // 7. Date Schedule Range Validation
    if (!alwaysActive) {
      if (!startDate) {
        errs.dateRange = 'Campaign Start Date is required.';
      } else if (!endDate) {
        errs.dateRange = 'Campaign End Date is required.';
      } else if (startDate && endDate && startDate > endDate) {
        errs.dateRange = 'Campaign Start Date cannot occur after End Date.';
      }

      // 8. Time Schedule Range Validation
      if (!startTime) {
        errs.timeRange = 'Start Time is required.';
      } else if (!endTime) {
        errs.timeRange = 'End Time is required.';
      } else if (startTime && endTime && startTime > endTime) {
        errs.timeRange = 'Start Time cannot occur after End Time.';
      }
    }

    // 9. Conflict Check
    const payloadForConflictCheck: Omit<Offer, 'id'> = {
      name: name || 'Unnamed Offer Draft',
      code: code || 'DRAFT_CODE',
      type: type === 'coupon' ? 'percentage' : type,
      value: Number(value) || 0,
      minPurchaseAmount: Number(minPurchaseAmount) || 0,
      isActive: true,
      description: description || `Retail Campaign: ${name}`,
      offerCategory: type === 'coupon' ? 'coupon' : 'product-specific',
      scope,
      selectedCategories: scope === 'category' ? selectedCategories : [],
      selectedBrands: scope === 'brand' ? selectedBrands : [],
      selectedProducts: scope === 'product' ? selectedProducts : [],
      buyQty: (type === 'bogo' || type === 'buy-x-get-y-discount') ? Number(buyQty) : undefined,
      freeQty: (type === 'bogo' || type === 'buy-x-get-y-discount') ? Number(freeQty) : undefined,
      freeProductSelectionType: (type === 'bogo' || type === 'buy-x-get-y-discount') ? (freeProductSelectionType === 'different' ? 'different' : 'same') : undefined,
      freeProductId: (type === 'bogo' || type === 'buy-x-get-y-discount') && freeProductSelectionType === 'different' ? freeProductId : undefined,
      freeItemRule: (type === 'bogo' || type === 'buy-x-get-y-discount') ? freeItemRule : undefined,
      maxFreeQty: (type === 'bogo' || type === 'buy-x-get-y-discount') ? Number(maxFreeQty) : undefined,
      customerEligibility: customerEligibility === 'birthday' ? 'all' : customerEligibility as any,
      eligibilityBirthdayMonth: customerEligibility === 'birthday',
      minQuantity: Number(minQuantity) || 0,
      alwaysActive,
      startDate: alwaysActive ? undefined : startDate,
      endDate: alwaysActive ? undefined : endDate,
      startTime: alwaysActive ? undefined : startTime,
      endTime: alwaysActive ? undefined : endTime,
      requireCoupon: type === 'coupon',
      couponCode: type === 'coupon' ? couponCode : undefined,
      comboProductIds: type === 'combo' ? comboProductIds : [],
      comboPrice: type === 'combo' ? Number(comboPrice) : undefined,
      giftProductId: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? giftProductId : undefined,
      giftPrice: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? Number(giftPrice) : undefined,
      minBillAmount: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? Number(minBillAmount) : undefined,
      giftType: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? giftType : undefined,
      fallbackGiftProductId: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? fallbackGiftProductId : undefined,
    };

    const conflict = checkConflicts(payloadForConflictCheck);
    if (conflict && conflict.severity === 'red') {
      errs.conflict = `Exclusive Conflict: overlaps with active campaign "${conflict.existingCampaign.name}"`;
    }

    return errs;
  }, [
    name, code, scope, selectedCategories, selectedBrands, selectedProducts,
    type, value, buyQty, freeQty, freeProductSelectionType, freeProductId, freeItemRule, maxFreeQty,
    customerEligibility, minQuantity, alwaysActive, startDate, endDate, startTime, endTime,
    couponCode, comboProductIds, comboPrice, giftProductId, giftPrice, minBillAmount, giftType, fallbackGiftProductId, offers, editingId, isActive, isStackable,
    autoGenerateCoupon, whatsappDeliveryEnabled, couponValidityDays, couponPrefix, maxRedemption, autoApplyOnNextVisit
  ]);

  // Real-time conflict details derivation
  const conflictDetails = useMemo(() => {
    const payloadForConflictCheck: Omit<Offer, 'id'> = {
      name: name || 'Unnamed Offer Draft',
      code: code || 'DRAFT_CODE',
      type: type === 'coupon' ? 'percentage' : type,
      value: Number(value) || 0,
      minPurchaseAmount: Number(minPurchaseAmount) || 0,
      isActive: true,
      description: description || `Retail Campaign: ${name}`,
      offerCategory: type === 'coupon' ? 'coupon' : 'product-specific',
      scope,
      selectedCategories: scope === 'category' ? selectedCategories : [],
      selectedBrands: scope === 'brand' ? selectedBrands : [],
      selectedProducts: scope === 'product' ? selectedProducts : [],
      buyQty: (type === 'bogo' || type === 'buy-x-get-y-discount') ? Number(buyQty) : undefined,
      freeQty: (type === 'bogo' || type === 'buy-x-get-y-discount') ? Number(freeQty) : undefined,
      freeProductSelectionType: (type === 'bogo' || type === 'buy-x-get-y-discount') ? (freeProductSelectionType === 'different' ? 'different' : 'same') : undefined,
      freeProductId: (type === 'bogo' || type === 'buy-x-get-y-discount') && freeProductSelectionType === 'different' ? freeProductId : undefined,
      freeItemRule: (type === 'bogo' || type === 'buy-x-get-y-discount') ? freeItemRule : undefined,
      maxFreeQty: (type === 'bogo' || type === 'buy-x-get-y-discount') ? Number(maxFreeQty) : undefined,
      customerEligibility: customerEligibility === 'birthday' ? 'all' : customerEligibility as any,
      eligibilityBirthdayMonth: customerEligibility === 'birthday',
      minQuantity: Number(minQuantity) || 0,
      alwaysActive,
      startDate: alwaysActive ? undefined : startDate,
      endDate: alwaysActive ? undefined : endDate,
      startTime: alwaysActive ? undefined : startTime,
      endTime: alwaysActive ? undefined : endTime,
      requireCoupon: type === 'coupon',
      couponCode: type === 'coupon' ? couponCode : undefined,
      comboProductIds: type === 'combo' ? comboProductIds : [],
      comboPrice: type === 'combo' ? Number(comboPrice) : undefined,
      giftProductId: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? giftProductId : undefined,
      giftPrice: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? Number(giftPrice) : undefined,
      minBillAmount: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? Number(minBillAmount) : undefined,
      giftType: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? giftType : undefined,
      fallbackGiftProductId: (type === 'gift-with-purchase' || type === 'spend-x-get-gift') ? fallbackGiftProductId : undefined,
    };
    return checkConflicts(payloadForConflictCheck);
  }, [
    name, code, scope, selectedCategories, selectedBrands, selectedProducts,
    type, value, buyQty, freeQty, freeProductSelectionType, freeProductId, freeItemRule, maxFreeQty,
    customerEligibility, minQuantity, alwaysActive, startDate, endDate, startTime, endTime,
    couponCode, comboProductIds, comboPrice, giftProductId, giftPrice, minBillAmount, giftType, fallbackGiftProductId, offers, editingId, isActive, isStackable,
    autoGenerateCoupon, whatsappDeliveryEnabled, couponValidityDays, couponPrefix, maxRedemption, autoApplyOnNextVisit
  ]);

  // Derive simple errors for active step progress checks
  const validationErrors = useMemo<string[]>(() => {
    const list: string[] = [];
    if (activeStep === 1) {
      if (fieldErrors.name) list.push(fieldErrors.name);
      if (fieldErrors.code) list.push(fieldErrors.code);
    }
    if (activeStep === 2) {
      if (fieldErrors.targeting) list.push(fieldErrors.targeting);
    }
    if (activeStep === 3) {
      if (fieldErrors.rules) list.push(fieldErrors.rules);
    }
    if (activeStep === 4) {
      if (fieldErrors.couponCode) list.push(fieldErrors.couponCode);
      if (fieldErrors.customerEligibility) list.push(fieldErrors.customerEligibility);
      if (fieldErrors.dateRange) list.push(fieldErrors.dateRange);
      if (fieldErrors.timeRange) list.push(fieldErrors.timeRange);
    }
    return list;
  }, [activeStep, fieldErrors]);

  // Progress handlers
  const handleNext = () => {
    if (validationErrors.length > 0) {
      showToast(`Please resolve step validation issues: ${validationErrors[0]}`);
      return;
    }
    if (activeStep < 5) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  // Ultimate Save and Publish handlers
  const saveAsDraft = () => {
    if (fieldErrors.name) {
      showToast('Offer Name is required to save a draft.');
      return;
    }

    const payload: Omit<Offer, 'id'> = {
      ...currentOfferPayload,
      isActive: false, // Force Draft status
    };

    try {
      if (editingId) {
        updateOffer(editingId, payload);
        showToast(`Draft "${name}" updated successfully.`);
      } else {
        addOffer(payload);
        showToast(`Draft "${name}" saved safely.`);
      }
      window.location.hash = 'promotions';
    } catch (e) {
      showToast('Error saving offer draft.');
    }
  };

  const publishOffer = () => {
    // Check if there are any field errors before publishing
    const activeErrors = Object.values(fieldErrors).filter(Boolean);
    if (activeErrors.length > 0) {
      showToast(`Incomplete configuration: ${activeErrors[0]}`);
      return;
    }

    const payload: Omit<Offer, 'id'> = {
      ...currentOfferPayload,
      isActive: true, // Force Active status
      priority: computedPriority,
    };

    try {
      if (editingId) {
        updateOffer(editingId, payload);
        showToast(`Campaign "${name}" updated and activated live!`);
      } else {
        addOffer(payload);
        showToast(`Campaign "${name}" is now live on the POS floor!`);
      }
      window.location.hash = 'promotions';
    } catch (e) {
      showToast('Error publishing retail promotion.');
    }
  };

  // Filtered lists for selectors
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const match = (p.name || '').toLowerCase().includes((productSearch || '').toLowerCase()) || (p.sku || '').toLowerCase().includes((productSearch || '').toLowerCase());
      return match && p.status === 'active';
    });
  }, [products, productSearch]);

  const filteredComboProducts = useMemo(() => {
    return products.filter((p) => {
      const match = (p.name || '').toLowerCase().includes((comboSearch || '').toLowerCase()) || (p.sku || '').toLowerCase().includes((comboSearch || '').toLowerCase());
      return match && p.status === 'active';
    });
  }, [products, comboSearch]);

  const filteredGiftProducts = useMemo(() => {
    return gifts.filter((p) => {
      const match = 
        (p.name || '').toLowerCase().includes((giftSearch || '').toLowerCase()) || 
        (p.sku || '').toLowerCase().includes((giftSearch || '').toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes((giftSearch || '').toLowerCase()));
      return match && p.status === 'active' && p.currentStock > 0;
    });
  }, [gifts, giftSearch]);

  const filteredFallbackGiftProducts = useMemo(() => {
    return gifts.filter((p) => {
      const match = 
        (p.name || '').toLowerCase().includes((fallbackGiftSearch || '').toLowerCase()) || 
        (p.sku || '').toLowerCase().includes((fallbackGiftSearch || '').toLowerCase()) ||
        (p.barcode && String(p.barcode).toLowerCase().includes((fallbackGiftSearch || '').toLowerCase()));
      return match && p.status === 'active' && p.currentStock > 0;
    });
  }, [gifts, fallbackGiftSearch]);

  const filteredFreeProducts = useMemo(() => {
    return products.filter((p) => {
      const match = (p.name || '').toLowerCase().includes((freeSearch || '').toLowerCase()) || (p.sku || '').toLowerCase().includes((freeSearch || '').toLowerCase());
      return match && p.status === 'active';
    });
  }, [products, freeSearch]);

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-slate-950 text-slate-100 flex flex-col h-full overflow-hidden select-none w-full max-w-full min-w-0" id="product-offer-configurator">
      
      {/* Dynamic Upper Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { window.location.hash = 'promotions'; }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 transition active:scale-95 cursor-pointer"
            title="Return to list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-amber-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {editingId ? 'Modify Promotion Campaign' : 'New POS Campaign Studio'}
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              {editingId ? `REVISION INTERFACE [ID: ${editingId}]` : 'LIVE CAMPAIGN DESIGN STUDIO'}
            </p>
          </div>
        </div>

        {/* Quick Save Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={saveAsDraft}
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer"
          >
            Save Draft
          </button>
          <button
            onClick={publishOffer}
            className="px-5 py-2 gold-gradient text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition hover:opacity-95 active:scale-95 shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            Publish Live
          </button>
        </div>
      </div>

      {/* Sticky 5-Step Process Progress Rail */}
      <nav className="sticky top-[var(--header-height)] bg-slate-950/95 backdrop-blur-md z-30 py-4 border-b border-slate-900/80 my-4" aria-label="Progress Dashboard">
        <ol className="flex items-center justify-between w-full p-2 bg-slate-900/60 border border-slate-850 rounded-2xl">
          {[
            { step: 1, label: 'BASIC INFO' },
            { step: 2, label: 'TARGETING' },
            { step: 3, label: 'OFFER RULES' },
            { step: 4, label: 'CONDITIONS' },
            { step: 5, label: 'LIVE SIMULATOR' }
          ].map((item) => {
            const isCompleted = item.step < activeStep;
            return (
              <li key={item.step} className="flex-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    // Only allow jumping steps if previous details validate
                    if (item.step < activeStep || validationErrors.length === 0) {
                      setActiveStep(item.step);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition text-[11px] font-bold tracking-wider cursor-pointer ${
                    activeStep === item.step
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                      : isCompleted
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono text-[10px] transition ${
                    activeStep === item.step
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black'
                        : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                    ) : (
                      item.step
                    )}
                  </span>
                  <span className="hidden md:inline">{item.label}</span>
                </button>
                {item.step < 5 && (
                  <div className={`hidden lg:block h-[1px] flex-1 mx-4 transition-colors ${
                    isCompleted ? 'bg-emerald-500/30' : 'bg-slate-900'
                  }`} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Main Split Layout Pane */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 overflow-hidden min-h-0 pb-6">
        
        {/* Workspace panel (Left side) */}
        <div className="lg:col-span-3 flex flex-col bg-slate-900/20 border border-slate-900 rounded-3xl p-6 overflow-y-auto relative min-h-[450px]">
          
          {/* Active step content mapping */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* STEP 1: Basic info */}
                {activeStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-sm font-serif font-bold text-amber-100 uppercase tracking-widest mb-1">
                        Campaign Information
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Define basic descriptors, naming, and scheduling parameters for the cashier system.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Offer Name <span className="text-amber-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Levi's Weekend BOGO Sale"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/10 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs transition outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Offer Code (Auto Generated)
                        </label>
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="AUTO_GENERATED"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/40 text-amber-400 rounded-xl px-4 py-2.5 text-xs font-mono transition outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Offer Type <span className="text-amber-500">*</span>
                        </label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs transition focus:border-amber-500/40 outline-none"
                        >
                          <option value="coupon">Coupon Voucher</option>
                          <option value="product-offer">Product Offer</option>
                          <option value="bogo">Buy X Get Y</option>
                          <option value="gift-with-purchase">Gift With Purchase</option>
                          <option value="percentage">Percentage Discount</option>
                          <option value="flat">Flat Discount</option>
                          <option value="combo">Bundle Offer</option>
                          <option value="spend-x-get-gift">Spend X Get Gift</option>
                          <option value="promo-price">Promo Price</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Priority Group
                          </label>
                          <div className="relative group">
                            <Info className="w-3.5 h-3.5 text-slate-500 cursor-help hover:text-amber-400 transition" />
                            <div className="absolute right-0 bottom-6 hidden group-hover:block bg-slate-950 border border-slate-800 text-slate-300 text-[9px] p-2.5 rounded-lg w-64 leading-relaxed shadow-xl z-50">
                              If multiple offers target the same garment item, the system executes high/highest priority deals first to optimize benefits.
                            </div>
                          </div>
                        </div>
                        <select
                          value={priorityType}
                          onChange={(e) => setPriorityType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs transition focus:border-amber-500/40 outline-none"
                        >
                          <option value="normal">🟢 Normal (Priority 50)</option>
                          <option value="high">🔵 High (Priority 75)</option>
                          <option value="highest">🔴 Highest (Priority 100)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Floor Status
                        </label>
                        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setIsActive(false)}
                            className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-lg transition ${
                              !isActive ? 'bg-slate-850 text-amber-500 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsActive(true)}
                            className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-lg transition ${
                              isActive ? 'bg-amber-500/10 text-emerald-400 border border-amber-500/20' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Active
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                        Description / Cashier Note
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide details about target apparel, size guidelines, or customer segments..."
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/40 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs transition outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: Product targeting */}
                {activeStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-sm font-serif font-bold text-amber-100 uppercase tracking-widest mb-1">
                        Product Targeting Scope
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Restrict promotion benefits to specific retail brands, item categories, or precise SKU items.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                        Target Segment Scope
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { key: 'entire-store', label: 'Entire Store' },
                          { key: 'category', label: 'By Category' },
                          { key: 'brand', label: 'By Brand' },
                          { key: 'product', label: 'Selected items' }
                        ].map((sc) => (
                          <button
                            key={sc.key}
                            type="button"
                            onClick={() => setScope(sc.key as any)}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                              scope === sc.key
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300 hover:border-slate-800'
                            }`}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category multi-selector */}
                    {scope === 'category' && (
                      <div className="space-y-2 animate-fadeIn">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Target Categories
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-4 rounded-xl border border-slate-900">
                          {categories.map((cat) => {
                            const selected = selectedCategories.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setSelectedCategories(
                                    selected ? selectedCategories.filter((c) => c !== cat) : [...selectedCategories, cat]
                                  );
                                }}
                                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs text-left transition cursor-pointer ${
                                  selected
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                                }`}
                              >
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${
                                  selected ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold' : 'border-slate-700'
                                }`}>
                                  {selected && '✓'}
                                </span>
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Brand multi-selector */}
                    {scope === 'brand' && (
                      <div className="space-y-2 animate-fadeIn">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Target Brands
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-4 rounded-xl border border-slate-900">
                          {brands.map((b) => {
                            const selected = selectedBrands.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => {
                                  setSelectedBrands(
                                    selected ? selectedBrands.filter((br) => br !== b) : [...selectedBrands, b]
                                  );
                                }}
                                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs text-left transition cursor-pointer ${
                                  selected
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                                }`}
                              >
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${
                                  selected ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold' : 'border-slate-700'
                                }`}>
                                  {selected && '✓'}
                                </span>
                                {b}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Specific multi-product selector */}
                    {scope === 'product' && (
                      <div className="space-y-2.5 animate-fadeIn">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Apparel Item Checklist
                          </label>
                          <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/10">
                            Selected: {selectedProducts.length} items
                          </span>
                        </div>

                        {/* Search bar */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Filter garments by name, SKU, or category..."
                            className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-amber-500/40"
                          />
                        </div>

                        {/* Checklist pane */}
                        <div className="max-h-[220px] overflow-y-auto bg-slate-900/60 border border-slate-900 rounded-xl p-2.5 space-y-1">
                          {filteredProducts.map((p) => {
                            const selected = selectedProducts.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProducts(
                                    selected ? selectedProducts.filter((pid) => pid !== p.id) : [...selectedProducts, p.id]
                                  );
                                }}
                                className={`w-full flex justify-between items-center gap-3 px-3 py-2 rounded-lg text-xs text-left transition cursor-pointer ${
                                  selected ? 'bg-amber-500/5 text-amber-300' : 'text-slate-400 hover:bg-slate-900'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                                    selected ? 'bg-amber-500 text-slate-950 font-bold' : 'border border-slate-800 bg-slate-950'
                                  }`}>
                                    {selected && '✓'}
                                  </span>
                                  <div>
                                    <span className="font-bold text-slate-200">{p.name}</span>
                                    <span className="text-[9px] text-slate-500 font-mono block">SKU: {p.sku} | {p.category} | size {p.size}</span>
                                  </div>
                                </div>
                                <span className="font-mono text-slate-400">{formatINR(p.sellingPrice)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Offer rules */}
                {activeStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-sm font-serif font-bold text-amber-100 uppercase tracking-widest mb-1">
                        Offer Promotion Rules
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Adjust target pricing variables, tier values, or quantity reward thresholds dynamically.
                      </p>
                    </div>

                    {/* Percentage Discount rules */}
                    {(type === 'percentage' || type === 'product-offer' || type === 'coupon') && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Discount Percentage <span className="text-amber-500">*</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={value}
                              onChange={(e) => setValue(Math.min(100, Math.max(0, Number(e.target.value))))}
                              className="w-32 bg-slate-900 border border-slate-800 focus:border-amber-500/40 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                            <span className="text-xs text-slate-400 font-bold">% Off marked apparel retail items</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Flat Discount rules */}
                    {type === 'flat' && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Flat Discount Amount <span className="text-amber-500">*</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              value={value}
                              onChange={(e) => setValue(Math.max(0, Number(e.target.value)))}
                              className="w-36 bg-slate-900 border border-slate-800 focus:border-amber-500/40 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                            <span className="text-xs text-slate-400 font-bold">₹ Flat off entire targeting scope</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BOGO Rules */}
                    {(type === 'bogo' || type === 'buy-x-get-y-discount') && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Buy Quantity <span className="text-amber-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={buyQty}
                              onChange={(e) => setBuyQty(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Free / Reward Qty <span className="text-amber-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={freeQty}
                              onChange={(e) => setFreeQty(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                          </div>
                        </div>

                        {type === 'buy-x-get-y-discount' && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Reward Discount % <span className="text-amber-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={value}
                              onChange={(e) => setValue(Math.min(100, Math.max(1, Number(e.target.value))))}
                              className="w-32 bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Reward Product Source
                            </label>
                            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  setFreeProductSelectionType('same');
                                  if (freeItemRule === 'specific') {
                                    setFreeItemRule('lowest');
                                  }
                                }}
                                className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-lg transition ${
                                  freeProductSelectionType === 'same' ? 'bg-slate-850 text-amber-500 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                Same Product
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFreeProductSelectionType('different');
                                  setFreeItemRule('specific');
                                }}
                                className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-lg transition ${
                                  freeProductSelectionType === 'different' ? 'bg-slate-850 text-amber-500 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                Different Product
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Max Free Qty Per Bill
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={maxFreeQty}
                              onChange={(e) => setMaxFreeQty(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                          </div>
                        </div>

                        {/* Free Item Selection Rule */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Free Item Selection Rule <span className="text-amber-500">*</span>
                          </label>
                          <select
                            value={freeItemRule}
                            onChange={(e) => {
                              const val = e.target.value as 'lowest' | 'highest' | 'same' | 'specific';
                              setFreeItemRule(val);
                              if (val === 'specific') {
                                setFreeProductSelectionType('different');
                              } else {
                                setFreeProductSelectionType('same');
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-amber-500/40"
                          >
                            <option value="lowest">Lowest Priced Eligible Item (Default)</option>
                            <option value="highest">Highest Priced Eligible Item</option>
                            <option value="same">Same Product Only</option>
                            <option value="specific">Specific Product (Admin Selected)</option>
                          </select>
                        </div>

                        {/* Different Product selector */}
                        {freeItemRule === 'specific' && (
                          <div className="space-y-2 animate-fadeIn">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Select Free Reward Item
                            </label>
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={freeSearch}
                                onChange={(e) => setFreeSearch(e.target.value)}
                                placeholder="Filter Reward garment catalog..."
                                className="w-full bg-slate-900 border border-slate-800 text-[11px] rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/40"
                              />
                            </div>
                            <div className="max-h-[120px] overflow-y-auto bg-slate-900/40 border border-slate-900 rounded-xl p-1.5 space-y-0.5">
                              {filteredFreeProducts.map((p) => {
                                const selected = freeProductId === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setFreeProductId(p.id)}
                                    className={`w-full flex justify-between items-center px-3 py-1.5 rounded-lg text-xs text-left transition cursor-pointer ${
                                      selected ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-900'
                                    }`}
                                  >
                                    <span>{p.name}</span>
                                    <span className="text-[9px] font-mono text-slate-500">SKU: {p.sku}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Dynamic Live helper description */}
                        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[11px] text-amber-300 leading-relaxed font-mono">
                          ⭐ Cashier Alert Rule (Auto-Generated): {
                            freeItemRule === 'lowest' ? `Customer buys ${buyQty + freeQty} targeted garments, pays full price for ${buyQty}, and receives the lowest priced ${freeQty} item(s) at ${type === 'buy-x-get-y-discount' ? `${value}% Off` : '100% Free'}.` :
                            freeItemRule === 'highest' ? `Customer buys ${buyQty + freeQty} targeted garments, pays full price for ${buyQty}, and receives the highest priced ${freeQty} item(s) at ${type === 'buy-x-get-y-discount' ? `${value}% Off` : '100% Free'}.` :
                            freeItemRule === 'same' ? `Customer buys ${buyQty + freeQty} of the EXACT SAME garment SKU, and receives ${freeQty} of that item at ${type === 'buy-x-get-y-discount' ? `${value}% Off` : '100% Free'}.` :
                            `Customer buys ${buyQty} targeted garments and receives ${freeQty} of "${products.find(p => p.id === freeProductId)?.name || 'the selected reward product'}" at ${type === 'buy-x-get-y-discount' ? `${value}% Off` : '100% Free'}.`
                          }
                        </div>
                      </div>
                    )}

                    {/* Combo Offer parameters */}
                    {type === 'combo' && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Combo Bundle Price <span className="text-amber-500">*</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              value={comboPrice}
                              onChange={(e) => setComboPrice(Math.max(0, Number(e.target.value)))}
                              className="w-36 bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                            <span className="text-xs text-slate-400 font-bold">₹ Set fixed combined price for selected items</span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Select Combo Group Garments (Select 2 or more)
                          </label>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={comboSearch}
                              onChange={(e) => setComboSearch(e.target.value)}
                              placeholder="Search combo catalog items..."
                              className="w-full bg-slate-900 border border-slate-800 text-[11px] rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/40"
                            />
                          </div>
                          <div className="max-h-[150px] overflow-y-auto bg-slate-900/40 border border-slate-900 rounded-xl p-1.5 space-y-0.5">
                            {filteredComboProducts.map((p) => {
                              const selected = comboProductIds.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setComboProductIds(
                                      selected ? comboProductIds.filter((id) => id !== p.id) : [...comboProductIds, p.id]
                                    );
                                  }}
                                  className={`w-full flex justify-between items-center px-3 py-1.5 rounded-lg text-xs text-left transition cursor-pointer ${
                                    selected ? 'bg-amber-500/10 text-amber-300' : 'text-slate-400 hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded flex items-center justify-center text-[8px] ${
                                      selected ? 'bg-amber-500 text-slate-950 font-bold' : 'border border-slate-800'
                                    }`}>
                                      {selected && '✓'}
                                    </span>
                                    <span>{p.name}</span>
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-500">{formatINR(p.sellingPrice)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Gift with purchase rules */}
                    {(type === 'gift-with-purchase' || type === 'spend-x-get-gift') && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Minimum Bill Required <span className="text-amber-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={minBillAmount}
                              onChange={(e) => setMinBillAmount(Math.max(0, Number(e.target.value)))}
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                            />
                          </div>

                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Gift Pricing Mode <span className="text-amber-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2 h-[41px]">
                              <button
                                type="button"
                                onClick={() => handleSetGiftType('free')}
                                className={`px-2 py-2 text-[10px] font-semibold rounded-xl transition border text-center cursor-pointer flex items-center justify-center ${
                                  giftType === 'free'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-900/60'
                                }`}
                              >
                                Free Gift (₹0)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetGiftType('discounted')}
                                className={`px-2 py-2 text-[10px] font-semibold rounded-xl transition border text-center cursor-pointer flex items-center justify-center ${
                                  giftType === 'discounted'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-900/60'
                                }`}
                              >
                                Promo Price
                              </button>
                            </div>
                          </div>

                          {giftType === 'discounted' && (
                            <div className="space-y-1.5 sm:col-span-2 animate-fadeIn">
                              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                                Promotional Gift Price <span className="text-amber-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={giftPrice}
                                onChange={(e) => setGiftPrice(Math.max(0, Number(e.target.value)))}
                                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Select Promotional Gift Product <span className="text-amber-500">*</span>
                          </label>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={giftSearch}
                              onChange={(e) => setGiftSearch(e.target.value)}
                              placeholder="Search gift stock catalog..."
                              className="w-full bg-slate-900 border border-slate-800 text-[11px] rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/40"
                            />
                          </div>
                          <div className="max-h-[220px] overflow-y-auto bg-slate-900/40 border border-slate-900 rounded-xl p-1.5 space-y-1.5">
                            {filteredGiftProducts.map((p) => {
                              const selected = giftProductId === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectGift(p.id)}
                                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-xs text-left transition cursor-pointer border ${
                                    selected 
                                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-md shadow-amber-500/5' 
                                      : 'text-slate-400 bg-slate-900 border-slate-850 hover:bg-slate-850'
                                  }`}
                                >
                                  {p.imageUrl ? (
                                    <img 
                                      src={p.imageUrl} 
                                      alt={p.name} 
                                      referrerPolicy="no-referrer"
                                      className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-slate-800 flex-shrink-0" 
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                                      <GiftIcon className="w-5 h-5" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="font-semibold text-slate-200 truncate leading-tight text-[11px]">{p.name}</h4>
                                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[8px] uppercase tracking-wider font-semibold font-mono flex-shrink-0">
                                        {p.category.replace('cat_g_', '').replace('_', ' ').replace('-', ' ')}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">SKU: {p.sku}</p>
                                    
                                    <div className="flex items-center gap-3 mt-1 text-[9px]">
                                      <span className="text-slate-400">MRP: <span className="font-mono text-slate-300">₹{p.mrp}</span></span>
                                      <span className="text-slate-400">Promo: <span className="font-mono text-emerald-400 font-semibold">₹{p.sellingPrice}</span></span>
                                      <span className="text-slate-400 ml-auto">Stock: <span className="font-mono font-bold text-amber-400">{p.currentStock}</span></span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Fallback Replacement Gift Selection */}
                        <div className="space-y-2.5 pt-4 border-t border-slate-900">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                              Fallback Replacement Gift Product (Optional)
                            </label>
                            {fallbackGiftProductId && (
                              <button
                                type="button"
                                onClick={() => setFallbackGiftProductId('')}
                                className="text-[10px] text-red-400 hover:underline cursor-pointer"
                              >
                                Clear Fallback
                              </button>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-500 leading-tight">
                            Configured replacement gift if the primary gift product is out of stock in inventory.
                          </p>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={fallbackGiftSearch}
                              onChange={(e) => setFallbackGiftSearch(e.target.value)}
                              placeholder="Search fallback gift catalog..."
                              className="w-full bg-slate-900 border border-slate-800 text-[11px] rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/40"
                            />
                          </div>
                          <div className="max-h-[220px] overflow-y-auto bg-slate-900/40 border border-slate-900 rounded-xl p-1.5 space-y-1.5">
                            {filteredFallbackGiftProducts.map((p) => {
                              const selected = fallbackGiftProductId === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setFallbackGiftProductId(p.id)}
                                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-xs text-left transition cursor-pointer border ${
                                    selected 
                                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-md shadow-amber-500/5' 
                                      : 'text-slate-400 bg-slate-900 border-slate-850 hover:bg-slate-850'
                                  }`}
                                >
                                  {p.imageUrl ? (
                                    <img 
                                      src={p.imageUrl} 
                                      alt={p.name} 
                                      referrerPolicy="no-referrer"
                                      className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-slate-800 flex-shrink-0" 
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                                      <GiftIcon className="w-5 h-5" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="font-semibold text-slate-200 truncate leading-tight text-[11px]">{p.name}</h4>
                                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[8px] uppercase tracking-wider font-semibold font-mono flex-shrink-0">
                                        {p.category.replace('cat_g_', '').replace('_', ' ').replace('-', ' ')}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">SKU: {p.sku}</p>
                                    
                                    <div className="flex items-center gap-3 mt-1 text-[9px]">
                                      <span className="text-slate-400">MRP: <span className="font-mono text-slate-300">₹{p.mrp}</span></span>
                                      <span className="text-slate-400">Promo: <span className="font-mono text-emerald-400 font-semibold">₹{p.sellingPrice}</span></span>
                                      <span className="text-slate-400 ml-auto">Stock: <span className="font-mono font-bold text-amber-400">{p.currentStock}</span></span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Promo Price rules */}
                    {type === 'promo-price' && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Promo Price Value <span className="text-amber-500">*</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              value={value}
                              onChange={(e) => setValue(Math.max(0, Number(e.target.value)))}
                              className="w-36 bg-slate-900 border border-slate-800 focus:border-amber-500/40 text-xs rounded-xl px-4 py-2.5 font-mono outline-none text-slate-200"
                            />
                            <span className="text-xs text-slate-400 font-bold">₹ Fixed Promo Price for eligible apparel items</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Coupon Offer instructions */}
                    {type === 'coupon' && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-xs text-amber-300 space-y-2 font-serif">
                        <p className="font-bold">🎫 Coupon Code Triggered Campaign</p>
                        <p className="text-[11px] leading-relaxed text-slate-400 font-sans">
                          A code prompt will be required during Step 4 to configure code matching. The offer applies automatically at checkout when the coupon string matches POS inputs.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 4: Conditions */}
                {activeStep === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-sm font-serif font-bold text-amber-100 uppercase tracking-widest mb-1">
                        Retail Thresholds & Schedule
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Adjust minimum requirements, target membership segments, and activation timing blocks.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {type === 'coupon' ? (
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-amber-400 font-bold block">
                            Promo Coupon Code <span className="text-amber-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                            placeholder="WINTER20"
                            className="w-full bg-slate-900 border border-amber-500/20 text-amber-300 font-mono text-xs rounded-xl px-4 py-2.5 outline-none focus:border-amber-500/50"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Min Purchase Value (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={minPurchaseAmount}
                            onChange={(e) => setMinPurchaseAmount(Math.max(0, Number(e.target.value)))}
                            className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Min Garment Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={minQuantity}
                          onChange={(e) => setMinQuantity(Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-2.5 font-mono outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                          Customer Eligibility
                        </label>
                        <select
                          value={customerEligibility}
                          onChange={(e) => setCustomerEligibility(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-amber-500/40"
                        >
                          <option value="all">All Retail Customers</option>
                          <option value="silver">🥈 Silver Members Only</option>
                          <option value="gold">🥇 Gold Members Only</option>
                          <option value="platinum">💎 Platinum VIP Only</option>
                          <option value="birthday">🎂 Birthday Month Special</option>
                        </select>
                      </div>
                    </div>

                    {/* Enterprise Coupon settings */}
                    <div className="p-5 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-4">
                      <div>
                        <h3 className="text-xs font-serif font-bold text-amber-400 uppercase tracking-wider mb-0.5">
                          🎫 Automated Customer Coupon Issuance
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Configure this campaign to automatically generate and deliver secure 8-character coupons after qualifying POS visits.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                          <div>
                            <span className="text-xs text-slate-200 font-bold block">Auto-Generate Coupon</span>
                            <span className="text-[10px] text-slate-400">Issue coupon code after successful purchase</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAutoGenerateCoupon(!autoGenerateCoupon)}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition cursor-pointer ${
                              autoGenerateCoupon ? 'bg-emerald-500' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-all ${
                              autoGenerateCoupon ? 'translate-x-4.5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                          <div>
                            <span className="text-xs text-slate-200 font-bold block">Auto-Apply On Next Visit</span>
                            <span className="text-[10px] text-slate-400">Auto apply to the customer on next visit</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAutoApplyOnNextVisit(!autoApplyOnNextVisit)}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition cursor-pointer ${
                              autoApplyOnNextVisit ? 'bg-amber-500' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-all ${
                              autoApplyOnNextVisit ? 'translate-x-4.5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>

                      {autoGenerateCoupon && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 animate-fadeIn">
                          <div className="space-y-1 bg-slate-900/30 p-2.5 rounded-xl border border-slate-905">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Coupon Prefix</label>
                            <input
                              type="text"
                              value={couponPrefix}
                              onChange={(e) => setCouponPrefix(e.target.value.toUpperCase().slice(0, 4))}
                              placeholder="e.g. SF"
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-100 font-mono outline-none focus:border-amber-500/40"
                            />
                          </div>

                          <div className="space-y-1 bg-slate-900/30 p-2.5 rounded-xl border border-slate-905">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Validity (Days)</label>
                            <input
                              type="number"
                              min="1"
                              value={couponValidityDays}
                              onChange={(e) => setCouponValidityDays(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-100 font-mono outline-none focus:border-amber-500/40"
                            />
                          </div>

                          <div className="space-y-1 bg-slate-900/30 p-2.5 rounded-xl border border-slate-905">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Max Redemptions</label>
                            <input
                              type="number"
                              min="0"
                              value={maxRedemption}
                              onChange={(e) => setMaxRedemption(Math.max(0, Number(e.target.value)))}
                              placeholder="0 (Unlimited)"
                              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-100 font-mono outline-none focus:border-amber-500/40"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                        <div>
                          <span className="text-xs text-slate-200 font-bold block">WhatsApp Delivery Enabled</span>
                          <span className="text-[10px] text-slate-400">Show button to share coupon via WhatsApp on success</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWhatsappDeliveryEnabled(!whatsappDeliveryEnabled)}
                          className={`w-10 h-5.5 rounded-full p-0.5 transition cursor-pointer ${
                            whatsappDeliveryEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                          }`}
                        >
                          <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-all ${
                            whatsappDeliveryEnabled ? 'translate-x-4.5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-900 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <label className="text-xs uppercase tracking-wider text-slate-200 font-bold block">
                            Always Active (No End Date)
                          </label>
                          <span className="text-[10px] text-slate-400">Disable timer limits for ongoing store benefits.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAlwaysActive(!alwaysActive)}
                          className={`w-12 h-6.5 rounded-full p-1 transition cursor-pointer ${
                            alwaysActive ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                        >
                          <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-all ${
                            alwaysActive ? 'translate-x-5.5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {!alwaysActive && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 animate-fadeIn">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Start Date</label>
                            <div className="relative premium-date-container group">
                              <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="peer w-full bg-slate-950 border border-slate-850 text-[11px] rounded-lg py-1.5 pl-8 pr-2 font-mono outline-none transition"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">End Date</label>
                            <div className="relative premium-date-container group">
                              <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                              <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="peer w-full bg-slate-950 border border-slate-850 text-[11px] rounded-lg py-1.5 pl-8 pr-2 font-mono outline-none transition"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Start Time</label>
                            <input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 text-[11px] rounded-lg px-2 py-1.5 font-mono outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">End Time</label>
                            <input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 text-[11px] rounded-lg px-2 py-1.5 font-mono outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5: Live simulation & overview */}
                {activeStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-sm font-serif font-bold text-amber-100 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-amber-500" />
                        Enterprise POS billing terminal
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Test promotion rules dynamically. Build the customer basket from the apparel catalog, apply coupons, and generate the invoice receipt preview.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                      
                      {/* Left Side: POS Checkout Controls */}
                      <div className="space-y-4 bg-slate-900/40 p-4 border border-slate-900 rounded-2xl">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                            Scan/Select Apparel Item
                          </label>
                          <select
                            value={simProductId}
                            onChange={(e) => setSimProductId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500/40"
                          >
                            <option value="">-- Choose Apparel Item --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) — {formatINR(p.sellingPrice)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {simProductId && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                                Bill Qty
                              </label>
                              <div className="flex bg-slate-950 border border-slate-850 rounded-xl p-1 justify-between items-center h-10">
                                <button
                                  type="button"
                                  onClick={() => setSimQuantity(Math.max(1, simQuantity - 1))}
                                  className="w-8 h-8 bg-slate-900 hover:bg-slate-850 rounded-lg flex items-center justify-center text-xs font-bold transition active:scale-90 cursor-pointer text-slate-300"
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs font-bold text-slate-200">{simQuantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setSimQuantity(simQuantity + 1)}
                                  className="w-8 h-8 bg-slate-900 hover:bg-slate-850 rounded-lg flex items-center justify-center text-xs font-bold transition active:scale-90 cursor-pointer text-slate-300"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                                Payment Mode
                              </label>
                              <div className="flex items-center justify-center bg-slate-950 border border-slate-850 text-slate-300 font-mono text-[11px] h-10 rounded-xl">
                                UPI / CARD POS
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Coupon Code Input for Simulator */}
                        {simResult?.couponRequired && (
                          <div className="space-y-1.5 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                                Coupon Code Scan (Required)
                              </label>
                              <span className="text-[8px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                                TRY: {couponCode || 'PROMO'}
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Scan or enter coupon code"
                                value={simCouponInput}
                                onChange={(e) => setSimCouponInput(e.target.value)}
                                className={`w-full bg-slate-950 border text-xs rounded-xl pl-9 pr-3 py-2 outline-none uppercase font-mono ${
                                  simResult.couponMatched 
                                    ? 'border-emerald-500/40 focus:border-emerald-500 text-emerald-400' 
                                    : 'border-slate-850 focus:border-amber-500/40 text-slate-200'
                                }`}
                              />
                              <Tag className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                              {simResult.couponMatched && (
                                <span className="absolute right-3 top-2 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-400">
                              {simResult.couponMatched 
                                ? '✓ Coupon applied successfully! Discount loaded.' 
                                : '⚠ Please enter the matching coupon code to trigger this promotion.'}
                            </p>
                          </div>
                        )}

                        {/* Dynamic Live Feedback status lines */}
                        {simResult && (
                          <div className="p-3 bg-slate-950 rounded-xl space-y-2 border border-slate-850">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block pb-1 border-b border-slate-900">
                              Terminal Promotion Evaluation Logs
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`w-2 h-2 rounded-full ${simResult.applied ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className={`font-bold ${simResult.applied ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {simResult.applied ? '✓ PROMO RULES MET' : '✖ LIMITS NOT REACHED'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                              {simResult.description}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Side: Invoice Receipt Preview */}
                      <div className="bg-slate-900/20 p-1 border border-slate-900 rounded-3xl overflow-hidden shadow-2xl">
                        {simProductId && simResult ? (() => {
                          const simProd = products.find(p => p.id === simProductId);
                          const simItems = [];
                          if (simProd) {
                            simItems.push({ product: simProd, quantity: simQuantity });
                          }
                          // If combo, add siblings
                          if (type === 'combo' && comboProductIds.length > 0) {
                            comboProductIds.forEach(id => {
                              if (id !== simProductId) {
                                const sibling = products.find(p => p.id === id);
                                if (sibling) {
                                  simItems.push({ product: sibling, quantity: 1 });
                                }
                              }
                            });
                          }

                          // Calculations
                          const baseTotal = simResult.normalSubtotal;
                          const promoSavings = simResult.totalSavings;
                          const taxableAmount = Math.max(0, baseTotal - promoSavings);
                          const cgst = Number((taxableAmount * 0.06).toFixed(2));
                          const sgst = Number((taxableAmount * 0.06).toFixed(2));
                          const invoiceGrandTotal = taxableAmount + cgst + sgst;

                          return (
                            <div className="bg-white text-slate-950 p-6 shadow-inner font-mono text-[10px] leading-relaxed relative flex flex-col min-h-[380px] rounded-2xl border-t-8 border-slate-800">
                              
                              {/* Scissor cut visuals */}
                              <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(circle,transparent_20%,#1e293b_20%,#1e293b_30%,transparent_30%)] bg-[length:8px_8px] bg-repeat-x opacity-15" />
                              
                              {/* Showroom Header */}
                              <div className="text-center space-y-0.5 pb-4 border-b border-dashed border-slate-300">
                                <h3 className="text-xs font-black tracking-widest uppercase">TRENDS MALL POS</h3>
                                <p className="text-[8px] text-slate-500">RETAIL ENTERPRISE OUTLET #0421</p>
                                <p className="text-[8px] text-slate-400">PHONE: +91 22 2490 8000 | GSTIN: 27AAACR4991A1Z2</p>
                              </div>

                              {/* Meta Details */}
                              <div className="grid grid-cols-2 gap-1 py-3 text-[8px] border-b border-dashed border-slate-300 text-slate-600">
                                <div>
                                  <p>INV: <span className="font-bold text-slate-800">INV-20260716-4192</span></p>
                                  <p>DATE: {new Date().toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                  <p>CASHIER: #8809 (LIVE_SIM)</p>
                                  <p>TIME: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                              </div>

                              {/* Cart Items Table */}
                              <div className="py-3 flex-1">
                                <div className="grid grid-cols-5 font-bold border-b border-slate-300 pb-1.5 mb-1.5 text-slate-800">
                                  <span className="col-span-2">ITEM DESCRIPTION</span>
                                  <span className="text-center">QTY</span>
                                  <span className="text-right">RATE</span>
                                  <span className="text-right">TOTAL</span>
                                </div>

                                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                                  {simItems.map((item, idx) => {
                                    const itemPrice = item.product.sellingPrice;
                                    const rowTotal = itemPrice * item.quantity;
                                    return (
                                      <div key={idx} className="grid grid-cols-5 text-slate-700">
                                        <div className="col-span-2 flex flex-col">
                                          <span className="font-bold text-slate-900 truncate">{item.product.name}</span>
                                          <span className="text-[8px] text-slate-400">{item.product.sku}</span>
                                        </div>
                                        <span className="text-center">{item.quantity}</span>
                                        <span className="text-right">{formatINR(itemPrice)}</span>
                                        <span className="text-right font-bold text-slate-900">{formatINR(rowTotal)}</span>
                                      </div>
                                    );
                                  })}

                                  {/* Free Gifts Issued Line */}
                                  {simResult.freeProducts.map((fp, idx) => (
                                    <div key={idx} className="grid grid-cols-5 text-emerald-700 bg-emerald-50 p-1 rounded border border-emerald-100">
                                      <div className="col-span-2 flex flex-col">
                                        <span className="font-bold uppercase tracking-tight">★ GIFT: {fp.product.name}</span>
                                        <span className="text-[7px] text-emerald-600">BARCODE: {fp.product.barcode || 'N/A'}</span>
                                      </div>
                                      <span className="text-center">{fp.quantity}</span>
                                      <span className="text-right">₹0.00</span>
                                      <span className="text-right font-bold">FREE</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Financial Breakdown Summary */}
                              <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 text-slate-700">
                                <div className="flex justify-between">
                                  <span>BASKET TOTAL:</span>
                                  <span>{formatINR(baseTotal)}</span>
                                </div>

                                {promoSavings > 0 && (
                                  <div className="flex justify-between text-emerald-600 font-bold bg-emerald-50 p-1.5 rounded">
                                    <span>PROMO SAVINGS ({name || 'CAMPAIGN'}):</span>
                                    <span>-{formatINR(promoSavings)}</span>
                                  </div>
                                )}

                                <div className="flex justify-between text-[8px] text-slate-500 pl-2">
                                  <span>TAXABLE NET VALUE:</span>
                                  <span>{formatINR(taxableAmount)}</span>
                                </div>

                                <div className="flex justify-between text-[8px] text-slate-500 pl-2">
                                  <span>CGST (6.00%):</span>
                                  <span>{formatINR(cgst)}</span>
                                </div>

                                <div className="flex justify-between text-[8px] text-slate-500 pl-2 pb-1.5 border-b border-slate-200">
                                  <span>SGST (6.00%):</span>
                                  <span>{formatINR(sgst)}</span>
                                </div>

                                <div className="flex justify-between text-xs font-black text-slate-900 pt-1.5">
                                  <span>TOTAL NET PAYABLE:</span>
                                  <span>{formatINR(invoiceGrandTotal)}</span>
                                </div>
                              </div>

                              {/* Visual Barcode Accent */}
                              <div className="mt-5 text-center space-y-2 pt-3 border-t border-dashed border-slate-300">
                                <div className="w-40 mx-auto h-8 bg-[repeating-linear-gradient(90deg,#0f172a,#0f172a_2px,transparent_2px,transparent_6px,#0f172a_6px,#0f172a_7px,transparent_7px,transparent_11px)] opacity-85" />
                                <p className="text-[7px] text-slate-400 font-mono tracking-[4px]">INV-20260716-4192-MALL</p>
                                <p className="text-[8px] text-slate-500 font-serif italic font-bold">~ THANK YOU FOR SHOPPING WITH US ~</p>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center text-slate-500 font-sans border-2 border-dashed border-slate-900 rounded-2xl">
                            <ShoppingBag className="w-10 h-10 text-slate-700 mb-3 animate-bounce" />
                            <p className="text-xs font-bold text-slate-400">POS Billing Cart is Empty</p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Select an item from the left dropdown menu to trigger calculations and print a customer receipt.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Professional POS Campaign Conflict Control Panel */}
          {conflictDetails && (
            <div className={`mt-6 p-6 border rounded-2xl ${
              conflictDetails.severity === 'red'
                ? 'bg-red-500/5 border-red-500/20 text-red-200'
                : conflictDetails.severity === 'yellow'
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-200'
                  : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
            } leading-relaxed space-y-5 animate-shake`} id="retail-campaign-conflict-resolution-panel">
              
              {/* Header */}
              <div className="flex items-start md:items-center gap-3 border-b pb-4 border-slate-900">
                <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 md:mt-0 ${
                  conflictDetails.severity === 'red'
                    ? 'text-red-500'
                    : conflictDetails.severity === 'yellow'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                }`} />
                <div>
                  <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-slate-100">
                    {conflictDetails.severity === 'red'
                      ? '🔴 Campaign Conflict Detected (Publishing Blocked)'
                      : conflictDetails.severity === 'yellow'
                        ? '🟡 Campaign Review Recommended (Non-Blocking)'
                        : '🟢 Compatible Campaigns (No Conflict)'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {conflictDetails.severity === 'red'
                      ? 'Two exclusive campaign structures cannot be active on the same target space at once.'
                      : conflictDetails.severity === 'yellow'
                        ? 'Review is advised to prevent potential overlapping promotion logic gaps.'
                        : 'This campaign is stackable and can run concurrently with the existing live offer.'}
                  </p>
                </div>
              </div>

              {/* Summary Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Existing Campaign Summary Card */}
                <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-4 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-1.5 flex justify-between">
                    <span>EXISTING LIVE CAMPAIGN</span>
                    <span className="text-emerald-400 font-mono">ACTIVE</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 text-[11px] font-mono">
                    <span className="text-slate-500">Campaign Name:</span>
                    <span className="text-slate-300 font-bold">{conflictDetails.existingCampaign.name}</span>
                    
                    <span className="text-slate-500">Offer Type:</span>
                    <span className="text-slate-300 capitalize">{conflictDetails.existingCampaign.type || 'Product Offer'}</span>
                    
                    <span className="text-slate-500">Priority:</span>
                    <span className="text-slate-300">
                      {conflictDetails.existingCampaign.priority && conflictDetails.existingCampaign.priority >= 100
                        ? 'High'
                        : conflictDetails.existingCampaign.priority && conflictDetails.existingCampaign.priority >= 50
                          ? 'Normal'
                          : 'Low'}
                    </span>
                    
                    <span className="text-slate-500">Schedule:</span>
                    <span className="text-slate-300">
                      {conflictDetails.existingCampaign.alwaysActive !== false
                        ? 'Always Active'
                        : `${conflictDetails.existingCampaign.startDate} to ${conflictDetails.existingCampaign.endDate}`}
                    </span>
                    
                    <span className="text-slate-500">Target Scope:</span>
                    <span className="text-slate-300 capitalize">
                      {conflictDetails.existingCampaign.scope === 'entire-store'
                        ? 'Entire Store'
                        : `${conflictDetails.existingCampaign.scope} → ${
                            conflictDetails.existingCampaign.scope === 'category'
                              ? conflictDetails.existingCampaign.selectedCategories?.join(', ')
                              : conflictDetails.existingCampaign.scope === 'brand'
                                ? conflictDetails.existingCampaign.selectedBrands?.join(', ')
                                : 'Selected Items'
                          }`}
                    </span>
                  </div>

                  {/* Affected products */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-900">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Affected Products:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {conflictDetails.affectedProducts.length > 0 ? (
                        conflictDetails.affectedProducts.map((p) => (
                          <span key={p.id} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-300">
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">No direct items mapped</span>
                      )}
                      {conflictDetails.affectedProducts.length > 3 && (
                        <span className="text-[10px] text-slate-500 font-bold pt-0.5">...</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reason Card & Recommendation Card */}
                <div className="space-y-4">
                  {/* Reason Card */}
                  <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      CONFLICT ANALYSIS
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      {conflictDetails.reason}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      <span className="text-slate-500">Overlapping Target:</span>
                      <span className="text-amber-400 font-bold">{conflictDetails.overlappingItem}</span>
                    </div>
                  </div>

                  {/* Smart Recommendation Card */}
                  <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> RECOMMENDED ACTION
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-normal mb-1.5">
                      Based on current system parameters:
                    </p>
                    <div className="text-[11px] font-bold text-amber-300 flex flex-col gap-1">
                      {!isStackable && (
                        <span className="flex items-center gap-1">
                          ✦ Convert this campaign to Stackable (Safe)
                        </span>
                      )}
                      {scope !== 'product' && (
                        <span className="flex items-center gap-1">
                          ✦ Reduce target scope to specific products
                        </span>
                      )}
                      {!alwaysActive && (
                        <span className="flex items-center gap-1">
                          ✦ Adjust campaign dates to avoid scheduling overlaps
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons panel */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = `promotions/edit-product-offer?id=${conflictDetails.existingCampaign.id}`;
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-750 transition active:scale-95 cursor-pointer"
                >
                  Edit Existing Campaign
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = `promotions/edit-product-offer?id=${conflictDetails.existingCampaign.id}`;
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-750 transition active:scale-95 cursor-pointer"
                >
                  Open Existing Campaign
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-750 transition active:scale-95 cursor-pointer"
                >
                  Change Target Scope
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-750 transition active:scale-95 cursor-pointer"
                >
                  Change Campaign Dates
                </button>

                {!isStackable && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsStackable(true);
                      showToast("This campaign converted to Stackable. Live conflict resolved.");
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/15 hover:border-amber-500/25 transition active:scale-95 cursor-pointer"
                  >
                    Make Current Campaign Stackable
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    updateOffer(conflictDetails.existingCampaign.id, { isActive: false });
                    showToast(`Existing Campaign "${conflictDetails.existingCampaign.name}" disabled.`);
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/15 hover:border-red-500/25 transition active:scale-95 cursor-pointer"
                >
                  Disable Existing Campaign
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = 'promotions';
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-950 hover:bg-slate-900 text-slate-500 hover:text-slate-400 transition active:scale-95 cursor-pointer md:ml-auto"
                >
                  Cancel
                </button>
              </div>

            </div>
          )}

          {/* Form Validation Warnings Alert */}
          {validationErrors.length > 0 && (
            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/15 text-amber-400 rounded-xl flex items-center gap-2.5 text-[11px]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <p>Step incomplete: {validationErrors[0]}</p>
            </div>
          )}

          {/* Form back and next controls */}
          <footer className="mt-8 pt-4 border-t border-slate-900 flex justify-between items-center gap-3">
            <button
              onClick={handleBack}
              disabled={activeStep === 1}
              className={`flex items-center gap-1 px-4 py-2 text-xs font-bold uppercase rounded-lg transition active:scale-95 cursor-pointer ${
                activeStep === 1
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-850'
              }`}
            >
              Back
            </button>
            <div className="text-[10px] text-slate-500 font-mono">
              STAGE {activeStep} OF 5
            </div>
            {activeStep < 5 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-5 py-2 text-xs font-bold uppercase rounded-lg bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 transition active:scale-95 cursor-pointer"
              >
                Next
              </button>
            ) : (
              <button
                onClick={publishOffer}
                className="px-5 py-2 gold-gradient text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg transition hover:opacity-95 active:scale-95 shadow-md cursor-pointer"
              >
                Activate Live Campaign
              </button>
            )}
          </footer>
        </div>

        {/* Live Simulator & Campaign Review (Right side) */}
        <aside className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto">
          
          {/* ⭐ Recommended best active campaign card preview */}
          <section className="bg-slate-900/50 border border-slate-900 rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                ⭐ Live Best Available Offer Recommendation
              </span>
              <span className="text-[8px] text-slate-500 font-mono">REAL-TIME ENGINE</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850/60 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
              <div className="space-y-2.5">
                <span className="text-[9px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                  {isActive ? '✓ READY TO APPLY' : 'DRAFT'}
                </span>
                
                <div>
                  <h4 className="font-serif text-sm font-bold text-amber-100 capitalize leading-tight">
                    {name || 'New Campaign Draft'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Promo Code: {code || 'AUTO_GEN_CODE'}</p>
                </div>

                <div className="border-t border-slate-900 pt-2 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Qualifying Benefits:</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {type === 'percentage' || type === 'product-offer' || type === 'coupon'
                      ? `${value}% Off` 
                      : type === 'flat' 
                        ? `₹${value} Off` 
                        : type === 'bogo' || type === 'buy-x-get-y-discount'
                          ? `Buy ${buyQty} Get ${freeQty} ${freeProductSelectionType === 'different' ? 'Free Gift' : 'Free Item'}`
                          : type === 'gift-with-purchase' || type === 'spend-x-get-gift'
                            ? `Free Gift with ₹${minBillAmount}+ Purchase`
                            : type === 'combo'
                              ? `Combo package at ₹${comboPrice}`
                              : type === 'promo-price'
                                ? `Promo Price of ₹${value}`
                                : 'Dynamic benefits'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Scannable Campaign Summary card */}
          <section className="bg-slate-900/50 border border-slate-900 rounded-3xl p-5 space-y-4 flex-1">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> Live Campaign Summary
              </span>
              <span className={`text-[9px] font-mono font-bold ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isActive ? 'STATUS: ACTIVE' : 'STATUS: DRAFT'}
              </span>
            </div>

            <div className="space-y-3 font-mono text-[11px] text-slate-400 leading-relaxed">
              <div className="flex justify-between items-start gap-2 py-1.5 border-b border-slate-900/50">
                <span>Campaign Name:</span>
                <span className="text-slate-200 text-right font-serif font-bold">{name || 'Unnamed Campaign'}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Coupon Code:</span>
                <span className="text-slate-200 font-bold">
                  {type === 'coupon' ? (couponCode || 'None') : 'None (Auto-Applied)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Offer Type:</span>
                <span className="text-amber-400 uppercase font-bold text-right">
                  {type === 'percentage' && 'Percentage Discount'}
                  {type === 'flat' && 'Flat Amount Discount'}
                  {type === 'bogo' && 'Buy X Get Y Free'}
                  {type === 'buy-x-get-y-discount' && 'Buy X Get Y Discount'}
                  {type === 'combo' && 'Combo/Bundle Package'}
                  {type === 'gift-with-purchase' && 'Gift With Purchase'}
                  {type === 'coupon' && 'Coupon Voucher'}
                  {type === 'product-offer' && 'Product Offer'}
                  {type === 'spend-x-get-gift' && 'Spend X Get Gift'}
                  {type === 'promo-price' && 'Promo Price'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Priority:</span>
                <span className={`uppercase font-bold ${
                  priorityType === 'high' 
                    ? 'text-red-400' 
                    : priorityType === 'normal' 
                      ? 'text-amber-400' 
                      : 'text-slate-400'
                }`}>{priorityType}</span>
              </div>

              <div className="flex justify-between items-start gap-2 py-1.5 border-b border-slate-900/50">
                <span>Validity:</span>
                <span className="text-slate-300 text-right text-[10px]">
                  {alwaysActive 
                    ? 'Always Active' 
                    : `${startDate} to ${endDate} (${startTime} - ${endTime})`}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2 py-1.5 border-b border-slate-900/50">
                <span>Eligible Categories:</span>
                <span className="text-slate-200 text-right text-[10px] capitalize max-w-[160px] truncate">
                  {scope === 'entire-store' && 'All Categories'}
                  {scope === 'category' && (selectedCategories.length > 0 ? selectedCategories.join(', ') : 'None Selected')}
                  {scope === 'brand' && 'Brand Restricted'}
                  {scope === 'product' && 'Product Specific'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Eligible Customers:</span>
                <span className="text-slate-200 uppercase">
                  {customerEligibility === 'all' && 'All Customers'}
                  {customerEligibility === 'silver' && 'Silver Tier'}
                  {customerEligibility === 'gold' && 'Gold Tier'}
                  {customerEligibility === 'platinum' && 'Platinum Tier'}
                  {customerEligibility === 'birthday' && 'Birthday Month'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Minimum Basket:</span>
                <span className="text-slate-200">
                  {type === 'gift-with-purchase' 
                    ? formatINR(minBillAmount) 
                    : minPurchaseAmount > 0 
                      ? formatINR(minPurchaseAmount) 
                      : 'No Minimum'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Offer Status:</span>
                <span className={`font-bold ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isActive ? 'Active (Live)' : 'Draft'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900/50">
                <span>Stackable:</span>
                <span className={`font-bold ${isStackable ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isStackable ? 'Yes' : 'No (Exclusive)'}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850 mt-4">
                <span className="text-xs text-amber-200 font-bold font-serif">Estimated Savings:</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {formatINR(simResult ? simResult.totalSavings : 0)}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
