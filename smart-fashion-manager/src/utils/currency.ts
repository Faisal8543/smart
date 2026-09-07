/**
 * Utility to format monetary values to Indian Rupee (INR) using en-IN locale.
 * Examples:
 * 999 -> ₹999
 * 125000 -> ₹1,25,000
 * -923 -> -₹923
 */
export const formatINR = (
  val: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number; keepDecimals?: boolean }
): string => {
  const minDigits = options?.minimumFractionDigits !== undefined 
    ? options.minimumFractionDigits 
    : (options?.keepDecimals ? 2 : 0);
    
  const maxDigits = options?.maximumFractionDigits !== undefined 
    ? options.maximumFractionDigits 
    : (options?.keepDecimals ? 2 : 2);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(val);
};

/**
 * Format helper for pure numbers in Indian numbering system without currency symbol
 */
export const formatIndianNumber = (
  val: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(val);
};
