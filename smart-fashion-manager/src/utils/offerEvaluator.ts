/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CartItem, Offer, Product, Gift, DiscountCard } from '../types';
import { OfferProcessor } from './OfferProcessor';
import type { EvaluatedOfferResult } from './OfferProcessor';

export type { EvaluatedOfferResult };

export function isOfferScheduleEligible(offer: Offer, customer: any = null, invoices: any[] = []): boolean {
  return OfferProcessor.isOfferScheduleEligible(offer, customer, invoices);
}

export function isProductInOfferScope(product: Product, offer: Offer): boolean {
  return OfferProcessor.isProductInOfferScope(product, offer);
}

export function evaluateOffers(
  cart: CartItem[],
  offers: Offer[],
  products: Product[],
  customer: any = null,
  invoices: any[] = [],
  gifts: Gift[] = [],
  activeDiscountCard: DiscountCard | null = null,
  calculateMembershipDiscount?: (cardType: string, subtotal: number, usageLogs?: any[]) => { discountPercentage: number; discountAmount: number }
): EvaluatedOfferResult {
  return OfferProcessor.evaluateBestOffer(
    cart,
    offers,
    products,
    customer,
    invoices,
    gifts,
    activeDiscountCard,
    calculateMembershipDiscount
  );
}

export interface OfferRecommendation {
  offer: Offer;
  potentialSavings: number;
  message: string;
  type: 'subtotal' | 'quantity';
  deficitValue: number;
}

export function getBestAvailableOfferRecommendation(
  cart: CartItem[],
  offers: Offer[],
  products: Product[],
  customer: any = null,
  invoices: any[] = [],
  gifts: Gift[] = []
): OfferRecommendation | null {
  const activeOffers = offers.filter((o) => o.isActive && isOfferScheduleEligible(o, customer, invoices));
  const evaluated = evaluateOffers(cart, offers, products, customer, invoices, gifts);
  
  // Exclude offers that are already applied
  const appliedOfferIds = new Set(evaluated.appliedOffers.map((ao) => ao.offer.id));
  const candidateOffers = activeOffers.filter((o) => !appliedOfferIds.has(o.id));

  const subtotal = cart.reduce((sum, item) => {
    const itemPrice = item.product.sellingPrice * (1 - (item.customDiscountType === 'percentage' ? item.customDiscount / 100 : 0));
    return sum + itemPrice * item.quantity;
  }, 0);

  if (cart.length === 0) {
    const subtotalOffers = candidateOffers
      .filter((o) => (o.minBillAmount || o.minPurchaseAmount || 0) > 0)
      .sort((a, b) => (a.minBillAmount || a.minPurchaseAmount || 0) - (b.minBillAmount || b.minPurchaseAmount || 0));
    
    if (subtotalOffers.length > 0) {
      const first = subtotalOffers[0];
      const minBill = first.minBillAmount || first.minPurchaseAmount || 0;
      return {
        offer: first,
        potentialSavings: first.value || 100,
        message: `Spend ₹${minBill} more to unlock this offer.`,
        type: 'subtotal',
        deficitValue: minBill,
      };
    }
    return null;
  }

  const recommendations: OfferRecommendation[] = [];

  for (const offer of candidateOffers) {
    const offerType = String(offer.type).toLowerCase();
    
    let potentialSavings = offer.value || 0;
    if (offerType === 'percentage') {
      potentialSavings = subtotal * ((offer.value || 10) / 100);
    } else if (offerType === 'bogo' || offerType === 'buy x get y free' || offerType === 'buy-x-get-y-discount') {
      const p = products.find((prod) => isProductInOfferScope(prod, offer));
      potentialSavings = p ? p.sellingPrice : 299;
    } else if (offerType === 'combo') {
      potentialSavings = offer.comboPrice ? Math.max(0, subtotal - offer.comboPrice) : 300;
    }

    // Case A: Minimum Bill Amount / Minimum Purchase Amount
    const minBill = offer.minBillAmount || offer.minPurchaseAmount || 0;
    if (minBill > 0 && subtotal < minBill) {
      const deficit = minBill - subtotal;
      recommendations.push({
        offer,
        potentialSavings: Math.max(potentialSavings, 100),
        message: `Spend ₹${Math.ceil(deficit)} more to unlock this offer.`,
        type: 'subtotal',
        deficitValue: deficit,
      });
    }

    // Case B: Quantity deficit (e.g. BOGO or Buy X Get Y)
    else if (
      offerType === 'bogo' || 
      offerType === 'buy x get y free' || 
      offerType === 'buy-x-get-y-discount' ||
      offerType === 'buy-qty-discount' || 
      offerType === 'fixed-bundle'
    ) {
      const requiredQty = offer.buyQty || 2;
      const matchingItems = cart.filter((item) => isProductInOfferScope(item.product, offer));
      const currentQty = matchingItems.reduce((sum, item) => sum + item.quantity, 0);

      if (currentQty > 0 && currentQty < requiredQty) {
        const deficit = requiredQty - currentQty;
        let scopeName = 'item';
        if (offer.scope === 'category' && offer.selectedCategories && offer.selectedCategories.length > 0) {
          scopeName = offer.selectedCategories[0];
        } else if (offer.scope === 'brand' && offer.selectedBrands && offer.selectedBrands.length > 0) {
          scopeName = offer.selectedBrands[0];
        } else if (matchingItems.length > 0) {
          scopeName = matchingItems[0].product.name.split(' ')[0] || 'item';
        }

        recommendations.push({
          offer,
          potentialSavings: Math.max(potentialSavings, 150),
          message: `Add ${deficit} more ${scopeName}${deficit > 1 ? 's' : ''} to unlock this offer.`,
          type: 'quantity',
          deficitValue: deficit,
        });
      }
    }
  }

  if (recommendations.length === 0) return null;

  recommendations.sort((a, b) => a.deficitValue - b.deficitValue);
  return recommendations[0];
}
