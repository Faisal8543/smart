/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CartItem, Offer, Product, Gift, DiscountCard } from '../types';

export interface EvaluatedOfferResult {
  appliedOffers: {
    offer: Offer;
    savings: number;
    description: string;
  }[];
  itemDiscounts: { [productId: string]: { discountValue: number; discountType: 'percentage' | 'flat' } };
  freeProducts: {
    product: Product;
    quantity: number;
    offerName: string;
    offerCode: string;
    isGift: boolean;
    price: number; // usually 0 or giftPrice
    giftType?: 'free' | 'discounted';
  }[];
  totalSavings: number;
  checkoutAmount: number;
  subtotal: number;
  unavailableGifts?: { offerName: string; giftName: string }[];
}

export class OfferProcessor {
  /**
   * Evaluates if a given offer is currently active and eligible based on dates, times, days, and customer demographics.
   * (Step 1 component)
   */
  static isOfferScheduleEligible(offer: Offer, customer: any = null, invoices: any[] = []): boolean {
    if (!offer.isActive) return false;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    // 1. Date Range checks
    if (offer.startDate && todayStr < offer.startDate) return false;
    if (offer.endDate && todayStr > offer.endDate) return false;
    if (offer.expiryDate && todayStr > offer.expiryDate) return false;

    // 2. Time Window checks
    if (offer.startTime || offer.endTime) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      if (offer.startTime) {
        const [sh, sm] = offer.startTime.split(':').map(Number);
        const startMinutes = sh * 60 + (sm || 0);
        if (currentMinutes < startMinutes) return false;
      }
      if (offer.endTime) {
        const [eh, em] = offer.endTime.split(':').map(Number);
        const endMinutes = eh * 60 + (em || 0);
        if (currentMinutes > endMinutes) return false;
      }
    }

    // 3. Weekday restrictions (applicableDays)
    if (offer.applicableDays && offer.applicableDays.length > 0) {
      const daysMap: { [key: string]: number } = {
        sunday: 0, sunday_: 0, sun: 0,
        monday: 1, monday_: 1, mon: 1,
        tuesday: 2, tuesday_: 2, tue: 2,
        wednesday: 3, wednesday_: 3, wed: 3,
        thursday: 4, thursday_: 4, thu: 4,
        friday: 5, friday_: 5, fri: 5,
        saturday: 6, saturday_: 6, sat: 6,
      };
      const currentDayName = Object.keys(daysMap).find(d => daysMap[d] === currentDayOfWeek);
      const isDayEligible = offer.applicableDays.some(d => {
        const dLower = d.trim().toLowerCase();
        return dLower === currentDayName || (currentDayName && dLower.startsWith(currentDayName.substring(0, 3)));
      });
      if (!isDayEligible) return false;
    }

    // 4. Special Weekend Offer Filter
    if (offer.type === 'weekend' || offer.type === 'Weekend Offer') {
      if (currentDayOfWeek !== 0 && currentDayOfWeek !== 6) return false;
    }

    // 5. Happy Hour timing window
    if (offer.type === 'happy-hour' || offer.type === 'Happy Hour Offer') {
      if (!offer.startTime && !offer.endTime) {
        const hour = now.getHours();
        if (hour < 12 || hour >= 16) return false; // Default Happy Hour 12 PM - 4 PM
      }
    }

    // 6. Customer Demographics / Segment Eligibility
    if (customer) {
      // Membership Tier alignment
      if (offer.customerEligibility && offer.customerEligibility !== 'all') {
        const customerTier = String(customer.membershipType || customer.cardType || '').toLowerCase();
        const requiredTier = String(offer.customerEligibility).toLowerCase();
        if (requiredTier !== 'all' && customerTier !== requiredTier) return false;
      }

      // First Purchase Check
      if (offer.eligibilityFirstPurchase || offer.type === 'first-purchase' || offer.type === 'First Purchase Offer') {
        const hasHistory = invoices.some(
          (inv) => inv.customerPhone === customer.phone || inv.customerName === customer.name
        );
        if (hasHistory) return false;
      }

      // Birthday Month matching
      if (offer.eligibilityBirthdayMonth || offer.type === 'birthday' || offer.type === 'Birthday Offer') {
        if (customer.dob) {
          // dob is typically YYYY-MM-DD or MM/DD
          const dobMonth = new Date(customer.dob).getMonth();
          if (dobMonth !== now.getMonth()) return false;
        }
      }

      // Eligible Gender
      if (offer.eligibleGender && offer.eligibleGender !== 'all') {
        const customerGender = String(customer.gender || 'all').toLowerCase();
        if (customerGender !== String(offer.eligibleGender).toLowerCase()) return false;
      }

      // Minimum Age
      if (offer.minCustomerAge && customer.dob) {
        const birthYear = new Date(customer.dob).getFullYear();
        const age = now.getFullYear() - birthYear;
        if (age < offer.minCustomerAge) return false;
      }
    } else {
      // If customer is absent, fail any member-exclusive or tier-specific offers
      if (
        offer.customerEligibility && offer.customerEligibility !== 'all' ||
        offer.type === 'member-exclusive' ||
        offer.type === 'Member Exclusive Offer' ||
        offer.type === 'first-purchase' ||
        offer.type === 'First Purchase Offer' ||
        offer.type === 'birthday' ||
        offer.type === 'Birthday Offer'
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if a product falls within the scope of an offer.
   */
  static isProductInOfferScope(product: Product, offer: Offer): boolean {
    const scope = offer.scope || 'entire-store';

    // Excluded products check
    if (offer.excludeProducts && offer.excludeProducts.includes(product.id)) {
      return false;
    }

    switch (scope) {
      case 'entire-store':
        return true;

      case 'category':
        if (!offer.selectedCategories || offer.selectedCategories.length === 0) return false;
        return offer.selectedCategories.some(
          (cat) => cat && product.category && cat.trim().toLowerCase() === product.category.trim().toLowerCase()
        );

      case 'brand':
        if (!offer.selectedBrands || offer.selectedBrands.length === 0) return false;
        return offer.selectedBrands.some(
          (b) => b && product.brand && b.trim().toLowerCase() === product.brand.trim().toLowerCase()
        );

      case 'product':
      case 'multiple-products':
        if (!offer.selectedProducts || offer.selectedProducts.length === 0) return false;
        return offer.selectedProducts.includes(product.id);

      case 'sku':
        if (!offer.selectedSkus || offer.selectedSkus.length === 0) return false;
        return offer.selectedSkus.some(
          (sku) => sku && product.sku && sku.trim().toLowerCase() === product.sku.trim().toLowerCase()
        );

      default:
        return true;
    }
  }

  /**
   * Executes the mandatory 9-step checkout promotion calculation pipeline.
   * Updates baseline costs and calculates total customer savings.
   */
  static execute9StepPipeline(
    cart: CartItem[],
    activeSet: Offer[],
    products: Product[],
    customer: any = null,
    invoices: any[] = [],
    gifts: Gift[] = [],
    activeDiscountCard: DiscountCard | null = null,
    calculateMembershipDiscount?: (cardType: string, subtotal: number, usageLogs?: any[]) => { discountPercentage: number; discountAmount: number }
  ): EvaluatedOfferResult {
    const applied: { offer: Offer; savings: number; description: string }[] = [];
    const itemDiscounts: { [productId: string]: { discountValue: number; discountType: 'percentage' | 'flat' } } = {};
    const freeProducts: EvaluatedOfferResult['freeProducts'] = [];
    const unavailableGifts: { offerName: string; giftName: string }[] = [];

    // Tracks remaining quantities of items as we consume them in various steps (e.g., BOGO, Combos)
    const runningQuantities: { [productId: string]: number } = {};
    cart.forEach((item) => {
      runningQuantities[item.product.id] = item.quantity;
    });

    // Helper to calculate original/selling prices
    const itemOriginalPrices: { [productId: string]: number } = {};
    cart.forEach((item) => {
      itemOriginalPrices[item.product.id] = item.product.sellingPrice;
    });

    // -------------------------------------------------------------
    // STEP 1: Offer Filtering & Customer Eligibility Checks (Handled at caller level during path selection)
    // -------------------------------------------------------------

    // -------------------------------------------------------------
    // STEP 2: Custom Line-Item Direct Discounts (Manual cashier overrides)
    // -------------------------------------------------------------
    const baselineItemPrices: { [productId: string]: number } = {};
    let customDiscountSavings = 0;

    cart.forEach((item) => {
      const origPrice = item.product.sellingPrice;
      let baselinePrice = origPrice;

      if (item.customDiscount > 0) {
        if (item.customDiscountType === 'percentage') {
          baselinePrice = origPrice * (1 - item.customDiscount / 100);
        } else {
          baselinePrice = Math.max(0, origPrice - item.customDiscount);
        }
        customDiscountSavings += (origPrice - baselinePrice) * item.quantity;
      }
      baselineItemPrices[item.product.id] = baselinePrice;
    });

    // Current running total of checkout items
    const getRunningCartSubtotal = () => {
      let sum = 0;
      cart.forEach((item) => {
        const qty = runningQuantities[item.product.id] ?? 0;
        sum += baselineItemPrices[item.product.id] * qty;
      });
      return sum;
    };

    const initialSubtotal = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
    let runningTotal = getRunningCartSubtotal();

    // -------------------------------------------------------------
    // STEP 3: SKU & Product-Specific Promotions (Promo Prices & Direct Product Discounts)
    // -------------------------------------------------------------
    for (const offer of activeSet) {
      const offerType = String(offer.type).toLowerCase();
      const isProductPromo = ['percentage', 'percentage-discount', 'product-offer', 'product offer', 'flat', 'flat-discount', 'promo-price'].includes(offerType);
      
      if (isProductPromo && offer.scope && offer.scope !== 'entire-store') {
        let offerSavings = 0;
        let isApplied = false;

        cart.forEach((item) => {
          if (OfferProcessor.isProductInOfferScope(item.product, offer)) {
            const qty = runningQuantities[item.product.id];
            if (qty <= 0) return;

            const currentPrice = baselineItemPrices[item.product.id];
            let newPrice = currentPrice;

            if (offerType === 'promo-price') {
              const promoVal = offer.value || 0;
              newPrice = Math.min(currentPrice, promoVal);
              itemDiscounts[item.product.id] = { discountValue: Math.max(0, currentPrice - promoVal), discountType: 'flat' };
            } else if (offerType === 'flat' || offerType === 'flat-discount') {
              const flatVal = offer.value || 0;
              newPrice = Math.max(0, currentPrice - flatVal);
              itemDiscounts[item.product.id] = { discountValue: flatVal, discountType: 'flat' };
            } else {
              // Percentage
              const pctVal = offer.value || 0;
              newPrice = currentPrice * (1 - pctVal / 100);
              itemDiscounts[item.product.id] = { discountValue: pctVal, discountType: 'percentage' };
            }

            const itemSaving = (currentPrice - newPrice) * qty;
            if (itemSaving > 0) {
              offerSavings += itemSaving;
              baselineItemPrices[item.product.id] = newPrice;
              isApplied = true;
            }
          }
        });

        if (isApplied && offerSavings > 0) {
          applied.push({
            offer,
            savings: Number(offerSavings.toFixed(2)),
            description: `${offer.name}: SKU Specific Promotion applied (Saved ₹${offerSavings.toFixed(2)})`,
          });
          runningTotal = getRunningCartSubtotal();
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Combo & Multi-Buy Bundle Reductions
    // -------------------------------------------------------------
    for (const offer of activeSet) {
      const offerType = String(offer.type).toLowerCase();
      if (offerType === 'combo' || offerType === 'combo offer' || offerType === 'fixed-bundle' || offerType === 'fixed bundle price') {
        
        if (offerType === 'combo' || offerType === 'combo offer') {
          const comboIds = offer.comboProductIds || [];
          const comboPrice = offer.comboPrice || 0;

          if (comboIds.length > 0) {
            // Find maximum number of combos we can form with remaining stock in cart
            let maxCombos = Infinity;
            comboIds.forEach((id) => {
              const qty = runningQuantities[id] || 0;
              if (qty < maxCombos) maxCombos = qty;
            });

            if (maxCombos > 0 && maxCombos !== Infinity) {
              let comboNormalTotal = 0;
              comboIds.forEach((id) => {
                comboNormalTotal += baselineItemPrices[id] || 0;
                // Consume item quantity from basket
                runningQuantities[id] -= maxCombos;
              });

              const comboSavings = (comboNormalTotal - comboPrice) * maxCombos;
              if (comboSavings > 0) {
                applied.push({
                  offer,
                  savings: Number(comboSavings.toFixed(2)),
                  description: `${offer.name}: Combo Bundle of ${comboIds.length} items applied ${maxCombos}x (Saved ₹${comboSavings.toFixed(2)})`,
                });
              }
            }
          }
        }

        else if (offerType === 'fixed-bundle' || offerType === 'fixed bundle price') {
          const comboIds = offer.comboProductIds || [];
          const comboPrice = offer.comboPrice || 0;
          const requiredQty = offer.buyQty || comboIds.length || 3;

          const targetItems = comboIds.length > 0
            ? cart.filter((item) => comboIds.includes(item.product.id))
            : cart.filter((item) => OfferProcessor.isProductInOfferScope(item.product, offer));

          const totalQty = targetItems.reduce((sum, item) => sum + (runningQuantities[item.product.id] || 0), 0);
          const bundlesCount = Math.floor(totalQty / requiredQty);

          if (bundlesCount > 0) {
            let bundleNormalTotal = 0;
            let itemsToCount = bundlesCount * requiredQty;

            // Sort target items by current price descending to consume most expensive first
            const sortedItems = [...targetItems].sort((a, b) => baselineItemPrices[b.product.id] - baselineItemPrices[a.product.id]);

            for (const item of sortedItems) {
              const qtyAvailable = runningQuantities[item.product.id] || 0;
              const take = Math.min(qtyAvailable, itemsToCount);
              if (take > 0) {
                bundleNormalTotal += baselineItemPrices[item.product.id] * take;
                runningQuantities[item.product.id] -= take;
                itemsToCount -= take;
              }
              if (itemsToCount <= 0) break;
            }

            const bundleSavings = bundleNormalTotal - (comboPrice * bundlesCount);
            if (bundleSavings > 0) {
              applied.push({
                offer,
                savings: Number(bundleSavings.toFixed(2)),
                description: `${offer.name}: Fixed Bundle rule applied (Buy ${requiredQty} for ₹${comboPrice}) x${bundlesCount} (Saved ₹${bundleSavings.toFixed(2)})`,
              });
            }
          }
        }
      }
    }
    runningTotal = getRunningCartSubtotal();

    // -------------------------------------------------------------
    // STEP 5: Tiered Quantity Discounts & Mix & Match Rules
    // -------------------------------------------------------------
    for (const offer of activeSet) {
      const offerType = String(offer.type).toLowerCase();
      
      if (offerType === 'buy-qty-discount' || offerType === 'buy quantity discount') {
        const targetItems = cart.filter((item) => OfferProcessor.isProductInOfferScope(item.product, offer));
        const totalTargetQty = targetItems.reduce((sum, item) => sum + (runningQuantities[item.product.id] || 0), 0);

        if (totalTargetQty > 0 && offer.buyQtyTiers && offer.buyQtyTiers.length > 0) {
          const satisfiedTiers = offer.buyQtyTiers
            .filter((t) => totalTargetQty >= t.quantity)
            .sort((a, b) => b.quantity - a.quantity);

          if (satisfiedTiers.length > 0) {
            const bestTier = satisfiedTiers[0];
            let tierSavings = 0;

            targetItems.forEach((item) => {
              const qty = runningQuantities[item.product.id] || 0;
              if (qty > 0) {
                const currentPrice = baselineItemPrices[item.product.id];
                let savingPerUnit = 0;
                if (bestTier.discountType === 'percentage') {
                  savingPerUnit = currentPrice * (bestTier.discountValue / 100);
                  itemDiscounts[item.product.id] = { discountValue: bestTier.discountValue, discountType: 'percentage' };
                } else {
                  savingPerUnit = Math.min(currentPrice, bestTier.discountValue);
                  itemDiscounts[item.product.id] = { discountValue: bestTier.discountValue, discountType: 'flat' };
                }

                tierSavings += savingPerUnit * qty;
                baselineItemPrices[item.product.id] = Math.max(0, currentPrice - savingPerUnit);
              }
            });

            if (tierSavings > 0) {
              applied.push({
                offer,
                savings: Number(tierSavings.toFixed(2)),
                description: `${offer.name}: Tiered Qty discount applied (Tier: ${bestTier.quantity}+ items) (Saved ₹${tierSavings.toFixed(2)})`,
              });
            }
          }
        }
      }

      else if (offerType === 'mix-match' || offerType === 'mix & match offer') {
        const requiredQty = offer.buyQty || 3;
        const discountPct = offer.value || 20;

        const targetItems = cart.filter((item) => OfferProcessor.isProductInOfferScope(item.product, offer));
        const totalTargetQty = targetItems.reduce((sum, item) => sum + (runningQuantities[item.product.id] || 0), 0);

        if (totalTargetQty >= requiredQty) {
          let mixSavings = 0;
          targetItems.forEach((item) => {
            const qty = runningQuantities[item.product.id] || 0;
            if (qty > 0) {
              const currentPrice = baselineItemPrices[item.product.id];
              const savingPerUnit = currentPrice * (discountPct / 100);
              mixSavings += savingPerUnit * qty;
              baselineItemPrices[item.product.id] = Math.max(0, currentPrice - savingPerUnit);
              itemDiscounts[item.product.id] = { discountValue: discountPct, discountType: 'percentage' };
            }
          });

          if (mixSavings > 0) {
            applied.push({
              offer,
              savings: Number(mixSavings.toFixed(2)),
              description: `${offer.name}: Mix & Match applied (Buy ${requiredQty} get ${discountPct}% off) (Saved ₹${mixSavings.toFixed(2)})`,
            });
          }
        }
      }
    }
    runningTotal = getRunningCartSubtotal();

    // -------------------------------------------------------------
    // STEP 6: Buy X Get Y Free (BOGO) Optimizations
    // -------------------------------------------------------------
    for (const offer of activeSet) {
      const offerType = String(offer.type).toLowerCase();
      if (offerType === 'bogo' || offerType === 'buy x get y free' || offerType === 'buy-x-get-y-discount') {
        const buyQty = offer.buyQty || 1;
        const freeQty = offer.freeQty || 1;
        const maxFreeQty = offer.maxFreeQty || 9999;
        const isDiscount = offerType === 'buy-x-get-y-discount';
        const discountPct = isDiscount ? (offer.value || 0) : 100;
        const rule = offer.freeItemRule || 'lowest';

        const matchingCartItems = cart.filter((item) => OfferProcessor.isProductInOfferScope(item.product, offer));

        if (rule === 'lowest' || rule === 'highest') {
          interface IndividualItem {
            id: string;
            price: number;
            product: Product;
          }
          const flatItems: IndividualItem[] = [];
          matchingCartItems.forEach((item) => {
            const availableQty = runningQuantities[item.product.id] || 0;
            const currentPrice = baselineItemPrices[item.product.id];
            for (let i = 0; i < availableQty; i++) {
              flatItems.push({
                id: item.product.id,
                price: currentPrice,
                product: item.product,
              });
            }
          });

          // Sort ascending by price
          flatItems.sort((a, b) => {
            if (a.price !== b.price) return a.price - b.price;
            return a.id.localeCompare(b.id);
          });

          const groupSize = buyQty + freeQty;
          const totalGroups = Math.floor(flatItems.length / groupSize);

          if (totalGroups > 0) {
            let totalSavingsThisOffer = 0;
            let appliedCount = 0;
            const aggregatedFreeItems: { [productId: string]: { product: Product; quantity: number } } = {};
            const totalFreeToAward = Math.min(totalGroups * freeQty, maxFreeQty);

            const freeInGroup = rule === 'lowest'
              ? flatItems.slice(0, totalFreeToAward)
              : flatItems.slice(-totalFreeToAward);

            freeInGroup.forEach((item) => {
              const saving = item.price * (discountPct / 100);
              totalSavingsThisOffer += saving;
              appliedCount++;

              // Consume from basket
              runningQuantities[item.id] = (runningQuantities[item.id] || 0) - 1;

              if (!aggregatedFreeItems[item.id]) {
                aggregatedFreeItems[item.id] = { product: item.product, quantity: 0 };
              }
              aggregatedFreeItems[item.id].quantity += 1;
            });

            if (appliedCount > 0) {
              applied.push({
                offer,
                savings: Number(totalSavingsThisOffer.toFixed(2)),
                description: `${offer.name}: BOGO applied (${rule === 'lowest' ? 'Cheapest' : 'Most Expensive'} item gets discount) (Saved ₹${totalSavingsThisOffer.toFixed(2)})`,
              });

              Object.values(aggregatedFreeItems).forEach(({ product, quantity }) => {
                freeProducts.push({
                  product,
                  quantity,
                  offerName: offer.name,
                  offerCode: offer.code,
                  isGift: false,
                  price: isDiscount ? baselineItemPrices[product.id] * (1 - discountPct / 100) : 0,
                });
              });
            }
          }
        } 
        
        else if (rule === 'same') {
          matchingCartItems.forEach((item) => {
            const availableQty = runningQuantities[item.product.id] || 0;
            const sets = Math.floor(availableQty / (buyQty + freeQty));
            if (sets > 0) {
              let freeCount = sets * freeQty;
              if (freeCount > maxFreeQty) freeCount = maxFreeQty;

              const currentPrice = baselineItemPrices[item.product.id];
              const savings = freeCount * currentPrice * (discountPct / 100);

              applied.push({
                offer,
                savings: Number(savings.toFixed(2)),
                description: `${offer.name}: BOGO Same Item applied on ${item.product.name} (Saved ₹${savings.toFixed(2)})`,
              });

              runningQuantities[item.product.id] = availableQty - (sets * (buyQty + freeQty));

              freeProducts.push({
                product: item.product,
                quantity: freeCount,
                offerName: offer.name,
                offerCode: offer.code,
                isGift: false,
                price: isDiscount ? currentPrice * (1 - discountPct / 100) : 0,
              });
            }
          });
        } 
        
        else if (rule === 'specific') {
          const totalMatchingQty = matchingCartItems.reduce((sum, item) => sum + (runningQuantities[item.product.id] || 0), 0);
          const sets = Math.floor(totalMatchingQty / buyQty);
          if (sets > 0 && offer.freeProductId) {
            const giftProd = products.find((p) => p.id === offer.freeProductId);
            if (giftProd) {
              let freeCount = sets * freeQty;
              if (freeCount > maxFreeQty) freeCount = maxFreeQty;

              const giftPrice = baselineItemPrices[giftProd.id] ?? giftProd.sellingPrice;
              const savings = freeCount * giftPrice * (discountPct / 100);

              applied.push({
                offer,
                savings: Number(savings.toFixed(2)),
                description: `${offer.name}: BOGO Specific Gift applied (${giftProd.name}) (Saved ₹${savings.toFixed(2)})`,
              });

              // Consume buy quantity from basket
              let consumed = sets * buyQty;
              for (const item of matchingCartItems) {
                if (consumed <= 0) break;
                const qty = runningQuantities[item.product.id] || 0;
                const take = Math.min(qty, consumed);
                runningQuantities[item.product.id] = qty - take;
                consumed -= take;
              }

              freeProducts.push({
                product: giftProd,
                quantity: freeCount,
                offerName: offer.name,
                offerCode: offer.code,
                isGift: true,
                price: isDiscount ? giftPrice * (1 - discountPct / 100) : 0,
              });
            }
          }
        }
      }
    }
    runningTotal = getRunningCartSubtotal();

    // -------------------------------------------------------------
    // STEP 7: Store-Wide Cart/Bill-Level Coupons & Auto-Offers
    // -------------------------------------------------------------
    for (const offer of activeSet) {
      const offerType = String(offer.type).toLowerCase();
      const isStoreWide = !offer.scope || offer.scope === 'entire-store';

      if (isStoreWide && (offerType === 'flat' || offerType === 'flat-discount' || offerType === 'percentage' || offerType === 'percentage-discount' || offerType === 'product-offer' || offerType === 'product offer')) {
        const minBill = offer.minPurchaseAmount || offer.minBillAmount || 0;
        if (minBill > 0 && runningTotal < minBill) continue;

        let savings = 0;
        if (offerType === 'flat' || offerType === 'flat-discount') {
          savings = Math.min(runningTotal, offer.value || 0);
        } else {
          // Percentage
          const pctVal = offer.value || 0;
          savings = runningTotal * (pctVal / 100);
        }

        if (offer.maxDiscountValue && savings > offer.maxDiscountValue) {
          savings = offer.maxDiscountValue;
        }

        if (savings > 0) {
          applied.push({
            offer,
            savings: Number(savings.toFixed(2)),
            description: `${offer.name}: Cart-level Coupon/Offer applied (Saved ₹${savings.toFixed(2)})`,
          });
          runningTotal = Math.max(0, runningTotal - savings);
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 8: Membership Cards / Tier-Based Membership Discounts
    // -------------------------------------------------------------
    let membershipDiscountSavings = 0;
    if (activeDiscountCard && activeDiscountCard.status === 'active') {
      const cardType = activeDiscountCard.cardType;
      const usageLogs = activeDiscountCard.usageLogs || [];
      
      let discountPct = 0;
      
      if (calculateMembershipDiscount) {
        const res = calculateMembershipDiscount(cardType, runningTotal, usageLogs);
        discountPct = res.discountPercentage;
        membershipDiscountSavings = res.discountAmount;
      } else {
        discountPct = activeDiscountCard.discountPercentage || 0;
        const cardTypeLower = String(cardType).toLowerCase();
        if (cardTypeLower === 'platinum') {
          discountPct = Math.max(discountPct, 15); // platinum default baseline
        } else if (cardTypeLower === 'gold') {
          discountPct = Math.max(discountPct, 10); // gold default
        } else if (cardTypeLower === 'silver') {
          discountPct = Math.max(discountPct, 5); // silver default
        }

        membershipDiscountSavings = runningTotal * (discountPct / 100);
        if (activeDiscountCard.maxDiscountLimit && membershipDiscountSavings > activeDiscountCard.maxDiscountLimit) {
          membershipDiscountSavings = activeDiscountCard.maxDiscountLimit;
        }
      }

      if (membershipDiscountSavings > 0) {
        applied.push({
          offer: {
            id: 'membership-card',
            code: activeDiscountCard.cardNumber,
            name: `${(activeDiscountCard.cardType || 'PLATINUM').toUpperCase()} Club Card`,
            type: 'membership-discount',
            value: discountPct,
            minPurchaseAmount: 0,
            isActive: true,
          },
          savings: Number(membershipDiscountSavings.toFixed(2)),
          description: `Membership Card (${activeDiscountCard.cardNumber}): applied ${discountPct}% off (Saved ₹${membershipDiscountSavings.toFixed(2)})`,
        });
        runningTotal = Math.max(0, runningTotal - membershipDiscountSavings);
      }
    }

    // -------------------------------------------------------------
    // STEP 9: Spend-Threshold Gift with Purchase (GWP)
    // -------------------------------------------------------------
    for (const offer of activeSet) {
      const offerType = String(offer.type).toLowerCase();
      const isGwp = ['gift-with-purchase', 'spend-x-get-gift', 'spend x get gift', 'buy-above-amount', 'buy above amount'].includes(offerType);

      if (isGwp && offer.giftProductId) {
        const minBill = offer.minBillAmount || offer.minPurchaseAmount || 0;
        const buyQtyRequired = offer.buyQty || offer.minQuantity || 0;

        let billEligible = true;
        if (minBill > 0 && runningTotal < minBill) {
          billEligible = false;
        }

        let qtyEligible = true;
        if (buyQtyRequired > 0) {
          const matchingQty = cart
            .filter((item) => OfferProcessor.isProductInOfferScope(item.product, offer))
            .reduce((sum, item) => sum + item.quantity, 0);
          if (matchingQty < buyQtyRequired) {
            qtyEligible = false;
          }
        }

        if (billEligible && qtyEligible) {
          const giftPool = gifts || [];
          let giftProd = giftPool.find((p) => p.id === offer.giftProductId) as any;
          let usingFallback = false;

          // Out of stock fallback check
          if (giftProd && giftProd.currentStock <= 0) {
            if (offer.fallbackGiftProductId) {
              const fallbackProd = giftPool.find((p) => p.id === offer.fallbackGiftProductId) as any;
              if (fallbackProd && fallbackProd.currentStock > 0) {
                giftProd = fallbackProd;
                usingFallback = true;
              } else {
                giftProd = undefined;
              }
            } else {
              giftProd = undefined;
            }
          }

          if (giftProd && giftProd.currentStock > 0) {
            const isFree = offer.giftType === 'free' || !offer.giftType || offer.giftPrice === 0 || offer.giftPrice === undefined;
            const giftPrice = isFree ? 0 : (offer.giftPrice ?? 0);
            const mrpPrice = giftProd.mrp !== undefined ? giftProd.mrp : (giftProd.sellingPrice ?? 0);
            const savings = Math.max(0, mrpPrice - giftPrice);

            // GWP does not directly subtract from basket runningTotal, but provides promotional gift value.
            // Under retail rules, the customer gets the item for the promotional giftPrice.
            applied.push({
              offer,
              savings: Number(savings.toFixed(2)),
              description: `${offer.name}: Spent threshold gift ${giftProd.name} awarded for ₹${giftPrice}${usingFallback ? ' (Replacement Gift)' : ''} (Saved ₹${savings.toFixed(2)})`,
            });

            const giftAsProduct: Product = {
              id: giftProd.id,
              sku: giftProd.sku,
              name: giftProd.name,
              category: giftProd.category,
              brand: giftProd.brand || 'Generic',
              size: (giftProd as any).size || 'OS',
              color: (giftProd as any).color || 'Default',
              purchasePrice: giftProd.purchasePrice,
              sellingPrice: mrpPrice,
              discount: 0,
              discountType: 'flat',
              currentStock: giftProd.currentStock,
              minStockAlert: giftProd.minStockAlert,
              status: giftProd.status,
              imageUrl: giftProd.imageUrl,
              createdAt: giftProd.createdAt
            };

            freeProducts.push({
              product: giftAsProduct,
              quantity: 1,
              offerName: offer.name,
              offerCode: offer.code,
              isGift: true,
              price: giftPrice,
              giftType: isFree ? 'free' : 'discounted',
            });
          } else {
            const primaryGift = giftPool.find((p) => p.id === offer.giftProductId);
            unavailableGifts.push({
              offerName: offer.name,
              giftName: primaryGift ? primaryGift.name : 'Promotional Gift Product',
            });
          }
        }
      }
    }

    const calculatedSavings = applied.reduce((sum, item) => sum + item.savings, 0);

    return {
      appliedOffers: applied,
      itemDiscounts,
      freeProducts,
      totalSavings: Number((calculatedSavings + customDiscountSavings).toFixed(2)),
      checkoutAmount: Number(Math.max(0, runningTotal).toFixed(2)),
      subtotal: initialSubtotal,
      unavailableGifts,
    };
  }

  /**
   * Best Offer Optimization Algorithm:
   * Generates multiple search paths/subsets of compatible offers,
   * evaluates each subset via the 9-step pipeline, and returns the combination
   * that maximizes the customer's savings.
   */
  static evaluateBestOffer(
    cart: CartItem[],
    offers: Offer[],
    products: Product[],
    customer: any = null,
    invoices: any[] = [],
    gifts: Gift[] = [],
    activeDiscountCard: DiscountCard | null = null,
    calculateMembershipDiscount?: (cardType: string, subtotal: number, usageLogs?: any[]) => { discountPercentage: number; discountAmount: number }
  ): EvaluatedOfferResult {
    if (cart.length === 0) {
      return {
        appliedOffers: [],
        itemDiscounts: {},
        freeProducts: [],
        totalSavings: 0,
        checkoutAmount: 0,
        subtotal: 0,
        unavailableGifts: [],
      };
    }

    // Filter only eligible, active offers
    const eligibleOffers = offers.filter((o) => OfferProcessor.isOfferScheduleEligible(o, customer, invoices));

    if (eligibleOffers.length === 0) {
      return OfferProcessor.execute9StepPipeline(cart, [], products, customer, invoices, gifts, activeDiscountCard, calculateMembershipDiscount);
    }

    // Separate into stackable vs non-stackable
    const stackable = eligibleOffers.filter((o) => o.isStackable);
    const nonStackable = eligibleOffers.filter((o) => !o.isStackable);

    const candidates: EvaluatedOfferResult[] = [];

    // Path 1: Standard stackable combination
    // Ordered by Priority (highest priority evaluated first)
    const sortedStackable = [...stackable].sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
    candidates.push(
      OfferProcessor.execute9StepPipeline(cart, sortedStackable, products, customer, invoices, gifts, activeDiscountCard, calculateMembershipDiscount)
    );

    // Path 2: Each individual non-stackable offer evaluated on its own
    nonStackable.forEach((offer) => {
      candidates.push(
        OfferProcessor.execute9StepPipeline(cart, [offer], products, customer, invoices, gifts, activeDiscountCard, calculateMembershipDiscount)
      );
    });

    // Path 3: Mixed compatible combinations (Backtracking subset search up to limit)
    // Let's run a backtrack search to find the optimal compatible subset
    const bestSubset: Offer[] = [];
    let maxSavings = -1;
    let optimalResult: EvaluatedOfferResult | null = null;

    // Prune list to prevent exponential expansion (top 12 offers ranked by priority)
    const searchPool = [...eligibleOffers].sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50)).slice(0, 12);

    const checkCompatibility = (currentList: Offer[], nextOffer: Offer): boolean => {
      // 1. If any in list is non-stackable, cannot add another unless rules allow
      const hasNonStackable = currentList.some(o => !o.isStackable);
      if (hasNonStackable && !nextOffer.isStackable) {
        return false;
      }

      // 2. Specific exclusion/combination constraints
      for (const o of currentList) {
        if (o.canCombineWithOtherOffers === false) return false;
        if (o.stopProcessingAfterThis) return false;
      }
      if (nextOffer.canCombineWithOtherOffers === false && currentList.length > 0) return false;

      // 3. Coupon specific rules
      const hasCoupon = currentList.some(o => o.offerCategory === 'coupon' || o.requireCoupon);
      if (hasCoupon && nextOffer.canCombineWithCoupons === false) return false;
      if (nextOffer.offerCategory === 'coupon' && currentList.some(o => o.canCombineWithCoupons === false)) return false;

      return true;
    };

    const backtrack = (index: number, currentList: Offer[]) => {
      const result = OfferProcessor.execute9StepPipeline(cart, currentList, products, customer, invoices, gifts, activeDiscountCard, calculateMembershipDiscount);
      if (result.totalSavings > maxSavings) {
        maxSavings = result.totalSavings;
        optimalResult = result;
      }

      for (let i = index; i < searchPool.length; i++) {
        const nextOffer = searchPool[i];
        if (checkCompatibility(currentList, nextOffer)) {
          backtrack(i + 1, [...currentList, nextOffer]);
        }
      }
    };

    backtrack(0, []);

    if (optimalResult) {
      candidates.push(optimalResult);
    }

    // Sort candidates by total savings descending
    candidates.sort((a, b) => b.totalSavings - a.totalSavings);

    // Return the champion configuration (Best Offer optimization!)
    return candidates[0];
  }
}
