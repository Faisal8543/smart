import React, { useState, useEffect, useMemo } from 'react';
import { useAppState, getOpeningDatePrefix, formatMembershipCardNumber } from '../context/StateContext';
import { useShortcuts } from '../context/ShortcutContext';
import { useDebounce } from '../hooks/useDebounce';
import { PermissionButton } from './common/PermissionGuard';
import { DuplicateCustomerModal } from './common/DuplicateCustomerModal';
import { safeLocalStorage } from '../utils/safeStorage';

const localStorage = safeLocalStorage;
import { DiscountCard, DiscountCardType, DiscountCardUsageLog } from '../types';
import {
  QrCode,
  CreditCard,
  Plus,
  Search,
  Filter,
  Printer,
  Trash2,
  Edit2,
  ShieldAlert,
  CheckCircle,
  RefreshCw,
  Eye,
  FileText,
  Download,
  User,
  Smartphone,
  Mail,
  MapPin,
  Gift,
  Percent,
  Calendar,
  Shield,
  Sparkles,
  MessageSquare,
  Clock,
  TrendingUp,
  Award,
  AlertTriangle,
  X,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatMemberName } from '../utils/nameFormatter';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area
} from 'recharts';

const CODE39_TABLE: { [key: string]: string } = {
  '0': '101001101101',
  '1': '110100101011',
  '2': '101100101011',
  '3': '110110010101',
  '4': '101001101011',
  '5': '110100110101',
  '6': '101100110101',
  '7': '101001011011',
  '8': '110100101101',
  '9': '101100101101',
  'A': '110101001011',
  'B': '101101001011',
  'C': '110110100101',
  'D': '101011001011',
  'E': '110101100101',
  'F': '101101100101',
  'G': '101010011011',
  'H': '110101001101',
  'I': '101101001101',
  'J': '101011001101',
  'K': '110101010011',
  'L': '101101010011',
  'M': '110110101001',
  'N': '101011010011',
  'O': '110101101001',
  'P': '101101101001',
  'Q': '101010110011',
  'R': '110101011001',
  'S': '101101011001',
  'T': '101011011001',
  'U': '110010101011',
  'V': '101100101011',
  'W': '110011010101',
  'X': '100101101011',
  'Y': '110010110101',
  'Z': '100110110101',
  '-': '100101011011',
  '.': '110010101101',
  ' ': '100110101101',
  '*': '100101101101',
};

export const generateCode39SVG = (text: string) => {
  const upperText = `*${text.toUpperCase()}*`;
  let binaryString = '';
  
  for (let i = 0; i < upperText.length; i++) {
    const char = upperText[i];
    const pattern = CODE39_TABLE[char] || CODE39_TABLE[' '];
    binaryString += pattern;
    if (i < upperText.length - 1) {
      binaryString += '0';
    }
  }

  let path = '';
  let width = 0;
  const barWidth = 1;

  for (let i = 0; i < binaryString.length; i++) {
    if (binaryString[i] === '1') {
      path += `M${width},0 h${barWidth} v20 h-${barWidth} z `;
    }
    width += barWidth;
  }

  return { path, width };
};

export const getBarcodeTextAndImage = (name: string, dobStr: string) => {
  const cleanName = (name || 'SOHAIL AKHTAR').trim();
  const names = cleanName.split(/\s+/);
  const firstLetter = names[0] ? names[0].charAt(0).toUpperCase() : 'S';
  const lastLetter = names.length > 1 ? names[names.length - 1].charAt(0).toUpperCase() : 'X';

  let ddmm = '2706';
  let yyyy = '2008';

  if (dobStr) {
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
    } else if (digits.length === 4) {
      ddmm = digits;
      yyyy = '2026';
    }
  }

  const text = `SF${firstLetter}${lastLetter} 2026 ${ddmm} ${yyyy}`;
  const imageText = `SF${firstLetter}${lastLetter}2026${ddmm}${yyyy}`;
  return { text, imageText };
};

interface PlatinumCardFrontProps {
  cardNumber: string;
  customerName: string;
  expiryDate: string;
  cardType?: string;
}

export const PlatinumCardFront: React.FC<PlatinumCardFrontProps> = ({
  cardNumber,
  customerName,
  expiryDate,
  cardType = 'platinum',
}) => {
  const { settings, membershipTypes } = useAppState();
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';

  // Find membership type
  const mType = membershipTypes?.find(
    (t) => (t.id || '').toLowerCase() === (cardType || '').toLowerCase() || (t.name || '').toLowerCase() === (cardType || '').toLowerCase()
  );

  const formatExpiryDate = (dateStr: string) => {
    if (!dateStr) return '15/12/28';
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      let day = '';
      let month = '';
      let year = '';
      
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else if (parts[2].length === 4 || parts[2].length === 2) {
        // DD/MM/YYYY or DD/MM/YY
        day = parts[0];
        month = parts[1];
        year = parts[2];
      } else {
        return dateStr;
      }
      
      const cleanDay = day.padStart(2, '0');
      const cleanMonth = month.padStart(2, '0');
      const cleanYear = year.slice(-2);
      return `${cleanDay}/${cleanMonth}/${cleanYear}`;
    }
    return dateStr;
  };

  const formatCardNumberDisplay = (numStr: string) => {
    if (!numStr) return '';
    const openingDate = settings?.storeProfile?.openingDate || '15/03/2026';
    return formatMembershipCardNumber(openingDate, numStr);
  };

  // Determine colors dynamically
  const safeCardType = (cardType || '').toLowerCase();
  const isPlatinum = safeCardType === 'platinum' || safeCardType === 'vip';
  const tierColor = isPlatinum ? '#E5E4E2' : (mType?.color || '#bf953f'); // Fallback
  const tierName = mType?.name || cardType;

  // Create a gradient matching the tier color
  const gradientId = `grad-${safeCardType.replace(/\s+/g, '-')}`;

  // Dynamic Font Scaling and Truncating for Member Name
  const baseNameFontSize = 32;
  const cleanName = formatMemberName(customerName);
  let displayName = cleanName;
  
  const lengthThreshold = 12;
  let nameFontSize = baseNameFontSize;
  
  if (displayName.length > lengthThreshold) {
    nameFontSize = Math.max(14, Math.round(baseNameFontSize * (lengthThreshold / displayName.length)));
  }
  
  if (displayName.length > 40) {
    displayName = displayName.slice(0, 37) + '...';
    nameFontSize = Math.max(14, Math.round(baseNameFontSize * (lengthThreshold / displayName.length)));
  }

  return (
    <svg 
      className="w-full h-full select-none" 
      viewBox="0 0 1000 630" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Dynamic metallic gradient */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isPlatinum ? '#0F1117' : '#080705'} />
          <stop offset="35%" stopColor={isPlatinum ? '#1A1D24' : '#1e293b'} />
          <stop offset="65%" stopColor={isPlatinum ? '#0F1117' : '#020617'} />
          <stop offset="100%" stopColor={isPlatinum ? '#D9D9D9' : tierColor} />
        </linearGradient>

        {/* Text/Badge gold metallic gradient */}
        <linearGradient id="text-gold-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bf953f" />
          <stop offset="25%" stopColor="#fcf6ba" />
          <stop offset="50%" stopColor="#b38728" />
          <stop offset="75%" stopColor="#fcf6ba" />
          <stop offset="100%" stopColor="#aa771c" />
        </linearGradient>

        {/* Text/Badge platinum metallic gradient */}
        <linearGradient id="text-platinum-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C0C0C0" />
          <stop offset="25%" stopColor="#F8F8FF" />
          <stop offset="50%" stopColor="#E5E4E2" />
          <stop offset="75%" stopColor="#F8F8FF" />
          <stop offset="100%" stopColor="#6E7074" />
        </linearGradient>
      </defs>

      {/* Card Body Background */}
      <rect width="1000" height="630" rx="32" fill={`url(#${gradientId})`} stroke={tierColor} strokeWidth="4" />

      {/* Decorative luxury lines */}
      <path 
        d="M -100,200 C 300,-100 500,700 1100,400" 
        stroke={tierColor} 
        strokeWidth="1.5" 
        strokeOpacity={isPlatinum ? "0.15" : "0.25"} 
        fill="none" 
      />
      <path 
        d="M -100,250 C 350,-50 450,750 1100,450" 
        stroke={tierColor} 
        strokeWidth="1" 
        strokeOpacity={isPlatinum ? "0.12" : "0.2"} 
        fill="none" 
      />
      <path 
        d="M -100,150 C 250,-150 550,650 1100,350" 
        stroke={tierColor} 
        strokeWidth="1" 
        strokeOpacity={isPlatinum ? "0.1" : "0.15"} 
        fill="none" 
      />

      <circle cx="900" cy="150" r="180" stroke={tierColor} strokeWidth="1" strokeOpacity="0.12" fill="none" />
      <circle cx="900" cy="150" r="120" stroke={tierColor} strokeWidth="1.5" strokeOpacity="0.15" fill="none" />

      {/* Store Logo & Branding */}
      <text
        x="70"
        y="110"
        fill={isPlatinum ? "url(#text-platinum-grad)" : "url(#text-gold-grad)"}
        fontFamily="'Poppins', sans-serif"
        fontSize="42"
        fontWeight="bold"
        letterSpacing="5"
      >
        {storeName}
      </text>

      {/* Badge Name (e.g. GOLD CARD, VIP CARD) */}
      <rect 
        x="730" 
        y="60" 
        width="200" 
        height="45" 
        rx="8" 
        fill="black" 
        fillOpacity="0.5" 
        stroke={isPlatinum ? "url(#text-platinum-grad)" : tierColor} 
        strokeWidth="1.5" 
      />
      <text
        x="830"
        y="88"
        fill={isPlatinum ? "url(#text-platinum-grad)" : tierColor}
        fontFamily="'Poppins', sans-serif"
        fontSize="15"
        fontWeight="bold"
        letterSpacing="2"
        textAnchor="middle"
      >
        {tierName.toUpperCase()}
      </text>

      {/* Card Number */}
      <text 
        x="500" 
        y="440" 
        fill="#ffffff" 
        fontFamily="'Poppins', sans-serif" 
        fontSize="44" 
        fontWeight="bold" 
        letterSpacing="18" 
        textAnchor="middle"
      >
        {formatCardNumberDisplay(cardNumber)}
      </text>

      {/* Holder Name */}
      <text 
        x="70" 
        y="545" 
        fill={isPlatinum ? "url(#text-platinum-grad)" : "url(#text-gold-grad)"} 
        fontFamily="'Poppins', sans-serif" 
        fontSize={nameFontSize} 
        fontWeight="600" 
        dominantBaseline="central"
        textAnchor="start"
      >
        {displayName}
      </text>

      {/* Validity */}
      <text 
        x="930" 
        y="545" 
        fill={isPlatinum ? "url(#text-platinum-grad)" : "url(#text-gold-grad)"} 
        fontFamily="'Poppins', sans-serif" 
        fontSize="24" 
        fontWeight="600" 
        dominantBaseline="central"
        textAnchor="end"
      >
        VALID: {formatExpiryDate(expiryDate)}
      </text>
    </svg>
  );
};

interface PlatinumCardBackProps {
  barcodeText: string;
  customerName?: string;
  dob?: string;
  cardType?: string;
}

export const PlatinumCardBack: React.FC<PlatinumCardBackProps> = ({
  barcodeText,
  customerName = 'SOHAIL AKHTAR',
  dob = '27/06/2008',
  cardType = 'platinum',
}) => {
  const { settings, membershipTypes, membershipDiscountRules, membershipBenefits } = useAppState();
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';
  const barcodeVal = (barcodeText || '').trim().replace(/\s+/g, '');
  const barcode = generateCode39SVG(barcodeVal);

  const safeCardType = (cardType || '').toLowerCase();
  const mType = membershipTypes?.find(
    (t) => (t.id || '').toLowerCase() === safeCardType || (t.name || '').toLowerCase() === safeCardType
  );

  const isPlatinum = safeCardType === 'platinum' || safeCardType === 'vip';
  const tierColor = isPlatinum ? '#E5E4E2' : (mType?.color || '#bf953f');

  // Get active benefits that should be shown on the card for this tier, sorted by displayOrder
  const activeTierId = mType ? mType.id : (safeCardType.includes('silver') ? 'Silver' : safeCardType.includes('gold') ? 'Gold' : 'PLATINUM');
  const dynamicPerks = membershipBenefits
    ? membershipBenefits
        .filter(b => (b.tierId || '').toLowerCase() === (activeTierId || '').toLowerCase() && b.status === 'active' && b.showOnCard)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(b => b.benefitName)
    : [];

  const perks: string[] = dynamicPerks.length > 0 ? dynamicPerks : (mType ? [
    "Festival Special Offers",
    "Birthday Specials",
    "Complimentary Delivery"
  ] : [
    "Complimentary Alterations",
    "Priority Showroom Billing",
    "Exclusive Sale Access"
  ]);

  const rules = membershipDiscountRules.filter(
    (r) => (r.membershipTypeId || '').toLowerCase() === safeCardType
  ).sort((a, b) => a.minPurchase - b.minPurchase);

  const gradientId = `back-grad-${safeCardType.replace(/\s+/g, '-')}`;

  return (
    <svg 
      className="w-full h-full select-none" 
      viewBox="0 0 1000 630" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#030712" />
          <stop offset="50%" stopColor="#111827" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>
        
        <linearGradient id="back-gold-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bf953f" />
          <stop offset="25%" stopColor="#fcf6ba" />
          <stop offset="50%" stopColor="#b38728" />
          <stop offset="75%" stopColor="#fcf6ba" />
          <stop offset="100%" stopColor="#aa771c" />
        </linearGradient>

        <linearGradient id="back-platinum-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C0C0C0" />
          <stop offset="25%" stopColor="#F8F8FF" />
          <stop offset="50%" stopColor="#E5E4E2" />
          <stop offset="75%" stopColor="#F8F8FF" />
          <stop offset="100%" stopColor="#6E7074" />
        </linearGradient>
      </defs>

      {/* Card Body Background */}
      <rect width="1000" height="630" rx="32" fill={`url(#${gradientId})`} stroke={tierColor} strokeWidth="4" />

      {/* Magnetic stripe on top */}
      <rect x="0" y="45" width="1000" height="90" fill="#1e293b" />

      {/* Signature Panel */}
      <rect x="70" y="165" width="550" height="65" fill="#f8fafc" rx="4" />
      <text x="90" y="205" fill="#1e293b" fontFamily="'Poppins', sans-serif" fontSize="24" fontStyle="italic">
        {formatMemberName(customerName)}
      </text>
      
      {/* Security code block */}
      <rect x="630" y="165" width="90" height="65" fill="white" rx="4" stroke="#e2e8f0" />
      <text x="675" y="203" fill="#0f172a" fontFamily="'Poppins', sans-serif" fontSize="18" fontWeight="bold" textAnchor="middle">
        {dob ? dob.replace(/\D/g, '').slice(-3) || '307' : '307'}
      </text>

      {/* Perks Title */}
      <text x="70" y="275" fill={isPlatinum ? "url(#back-platinum-grad)" : tierColor} fontFamily="'Poppins', sans-serif" fontSize="18" fontWeight="bold" letterSpacing="1">
        EXCLUSIVES & PRIVILEGES
      </text>

      {/* Perks List */}
      {perks.slice(0, 4).map((p, idx) => (
        <g key={idx} transform={`translate(70, ${305 + idx * 30})`}>
          <circle cx="5" cy="-5" r="3" fill={tierColor} />
          <text x="20" y="0" fill="#e2e8f0" fontFamily="'Poppins', sans-serif" fontSize="15" fontWeight="500">
            {p}
          </text>
        </g>
      ))}

      {/* Shopping Slabs Rules */}
      {rules.length > 0 && (
        <g transform="translate(540, 275)">
          <text x="0" y="0" fill={isPlatinum ? "url(#back-platinum-grad)" : tierColor} fontFamily="'Poppins', sans-serif" fontSize="18" fontWeight="bold" letterSpacing="1">
            SHOPPING SLABS & DISCOUNTS
          </text>
          {rules.slice(0, 3).map((r, idx) => (
            <text key={idx} x="0" y={30 + idx * 28} fill="#cbd5e1" fontFamily="'Poppins', sans-serif" fontSize="14" fontWeight="500">
              Spend ≥ ₹{r.minPurchase.toLocaleString()} : {r.discountPercentage}% Discount
            </text>
          ))}
        </g>
      )}

      {/* Dynamic Barcode Image */}
      <g transform="translate(500, 480)">
        <g transform={`translate(-${barcode.width * 0.8}, 0) scale(1.6, 2.2)`}>
          <path d={barcode.path} fill="white" />
        </g>
        <text 
          x="0" 
          y="68" 
          dx="4"
          fill={isPlatinum ? "url(#back-platinum-grad)" : "url(#back-gold-grad)"} 
          fontFamily="'JetBrains Mono', monospace" 
          textAnchor="middle"
          fontSize="20" 
          fontWeight="bold" 
          letterSpacing="8" 
        >
          {barcodeText}
        </text>
      </g>
    </svg>
  );
};

// OKLCH helper parser and converter for html2canvas compatibility (e.g. Tailwind CSS v4)
const parseOklch = (str: string) => {
  const match = str.match(/oklch\(([^)]+)\)/i);
  if (!match) return null;
  
  const content = match[1].trim();
  const parts = content
    .replace(/\s*\/\s*/g, ' ')
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/);
    
  if (parts.length < 3) return null;
  
  const lPart = parts[0];
  const cPart = parts[1];
  const hPart = parts[2];
  const aPart = parts[3];
  
  let L = 0;
  if (lPart.endsWith('%')) {
    L = parseFloat(lPart) / 100;
  } else {
    L = parseFloat(lPart);
  }
  if (isNaN(L)) L = 0;
  
  let C = 0;
  if (cPart.endsWith('%')) {
    C = (parseFloat(cPart) / 100) * 0.4;
  } else {
    C = parseFloat(cPart);
  }
  if (isNaN(C)) C = 0;
  
  let H = 0;
  if ((hPart || '').toLowerCase() === 'none') {
    H = 0;
  } else {
    const hNum = parseFloat(hPart);
    if (hPart.endsWith('deg')) {
      H = hNum;
    } else if (hPart.endsWith('grad')) {
      H = hNum * 0.9;
    } else if (hPart.endsWith('rad')) {
      H = hNum * (180 / Math.PI);
    } else if (hPart.endsWith('turn')) {
      H = hNum * 360;
    } else {
      H = hNum;
    }
  }
  if (isNaN(H)) H = 0;
  
  let A = 1;
  if (aPart) {
    if (aPart.endsWith('%')) {
      A = parseFloat(aPart) / 100;
    } else {
      A = parseFloat(aPart);
    }
  }
  if (isNaN(A)) A = 1;
  
  return { L, C, H, A };
};

const oklchToRgb = (oklchStr: string): string => {
  const parsed = parseOklch(oklchStr);
  if (!parsed) return oklchStr;
  
  const { L, C, H, A } = parsed;
  const hRad = (H * Math.PI) / 180;
  const labA = C * Math.cos(hRad);
  const labB = C * Math.sin(hRad);
  
  const l_ = L + 0.3963377774 * labA + 0.2158037573 * labB;
  const m_ = L - 0.1055613458 * labA - 0.0638541728 * labB;
  const s_ = L - 0.0894841775 * labA - 1.2914855480 * labB;
  
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  
  const rL = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gL = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bL = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  
  const gamma = (c: number) => {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  
  const r = Math.round(Math.max(0, Math.min(1, gamma(rL))) * 255);
  const g = Math.round(Math.max(0, Math.min(1, gamma(gL))) * 255);
  const b = Math.round(Math.max(0, Math.min(1, gamma(bL))) * 255);
  
  if (A < 1) {
    return `rgba(${r}, ${g}, ${b}, ${A})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
};

const convertAllOklch = (str: string): string => {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('oklch')) return str;
  
  return str.replace(/oklch\([^)]+\)/g, (match) => {
    return oklchToRgb(match);
  });
};

const convertOklchStylesToRgb = (rootEl: HTMLElement): (() => void) => {
  const elements = [rootEl, ...Array.from(rootEl.querySelectorAll('*'))] as HTMLElement[];
  const originalStyles: { el: HTMLElement; prop: string; val: string }[] = [];
  const originalAttributes: { el: HTMLElement; attr: string; val: string | null }[] = [];
  
  const propertiesToCheck = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'boxShadow',
    'backgroundImage',
    'fill',
    'stroke',
    'textShadow',
    'outlineColor'
  ];
  
  elements.forEach((el) => {
    if (el.style) {
      const computed = window.getComputedStyle(el);
      propertiesToCheck.forEach((prop) => {
        try {
          const val = computed[prop as any];
          if (val && typeof val === 'string' && val.includes('oklch')) {
            originalStyles.push({
              el,
              prop,
              val: el.style[prop as any] || ''
            });
            el.style[prop as any] = convertAllOklch(val);
          }
        } catch (e) {
          // Safe-guard
        }
      });
    }
    
    try {
      if (el.hasAttribute && el.getAttribute) {
        const fillAttr = el.getAttribute('fill');
        if (fillAttr && fillAttr.includes('oklch')) {
          originalAttributes.push({
            el,
            attr: 'fill',
            val: fillAttr
          });
          el.setAttribute('fill', convertAllOklch(fillAttr));
        }
        
        const strokeAttr = el.getAttribute('stroke');
        if (strokeAttr && strokeAttr.includes('oklch')) {
          originalAttributes.push({
            el,
            attr: 'stroke',
            val: strokeAttr
          });
          el.setAttribute('stroke', convertAllOklch(strokeAttr));
        }
      }
    } catch (e) {
      // Safe-guard
    }
  });
  
  return () => {
    originalStyles.forEach(({ el, prop, val }) => {
      try {
        if (val) {
          el.style[prop as any] = val;
        } else {
          el.style.removeProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
        }
      } catch (e) {
        // Safe-guard
      }
    });
    
    originalAttributes.forEach(({ el, attr, val }) => {
      try {
        if (val !== null) {
          el.setAttribute(attr, val);
        } else {
          el.removeAttribute(attr);
        }
      } catch (e) {
        // Safe-guard
      }
    });
  };
};

export const DiscountCardsView: React.FC = () => {
  const {
    discountCards,
    customers,
    findCustomerByPhone,
    addDiscountCard,
    updateDiscountCard,
    deleteDiscountCard,
    settings,
    invoices,
    lastMembershipSerial,
    updateLastMembershipSerial,
    membershipTypes,
    membershipDiscountRules
  } = useAppState();

  const { registerShortcut } = useShortcuts();

  const storeName = settings?.storeProfile?.name || 'SMART FASHION';

  // Active view states
  const [activeSubTab, setActiveSubTab] = useState<'cards' | 'reports' | 'notifications' | 'audit'>('cards');
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [previewFlipped, setPreviewFlipped] = useState(false);

  // List search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DiscountCardType>('all');

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSecurityPinOpen, setIsSecurityPinOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Selected card & live form states
  const [selectedCard, setSelectedCard] = useState<DiscountCard | null>(null);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    barcodeText: '',
    customerName: '',
    mobileNumber: '',
    email: '',
    address: '',
    cardType: 'platinum' as DiscountCardType,
    discountPercentage: 20,
    maxDiscountLimit: 5000,
    status: 'active' as 'active' | 'blocked' | 'expired',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dob: '15/05/1975',
  });

  // Admin PIN configuration for override validations
  const [securityPinInput, setSecurityPinInput] = useState('');
  const [securityPinError, setSecurityPinError] = useState('');
  const [onSecurityPinSuccess, setOnSecurityPinSuccess] = useState<(() => void) | null>(null);

  // Print Mode state
  const [printLayout, setPrintLayout] = useState<'standard' | 'qr-only' | 'membership'>('standard');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);
  const [isFadeOut, setIsFadeOut] = useState(false);

  useEffect(() => {
    if (isPrintOpen) {
      setPrintLayout('standard');
    }
  }, [isPrintOpen]);

  // Custom Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Custom Confirmation Modal States (bypassing native iframe confirm blocks)
  const [cardToDelete, setCardToDelete] = useState<DiscountCard | null>(null);
  const [isConfirmWipeOpen, setIsConfirmWipeOpen] = useState(false);
  const [renewCardTarget, setRenewCardTarget] = useState<DiscountCard | null>(null);
  const [isUpdatingMembership, setIsUpdatingMembership] = useState(false);

  // Duplicate Customer Modal State
  const [cardDuplicateModal, setCardDuplicateModal] = useState<{
    isOpen: boolean;
    existingCustomer: any;
  }>({ isOpen: false, existingCustomer: null });

  useEffect(() => {
    const unregisterList = [
      registerShortcut('ctrl+i', 'Membership', 'Issue New Membership Card', () => {
        setIsCreateOpen(true);
      }),
      registerShortcut('ctrl+shift+e', 'Membership', 'Extend Membership Validity', () => {
        if (selectedCard) {
          setRenewCardTarget(selectedCard);
        } else if (discountCards.length > 0) {
          setRenewCardTarget(discountCards[0]);
        }
      }),
      registerShortcut('ctrl+shift+r', 'Membership', 'Reprint Selected Card', () => {
        if (selectedCard) {
          setIsPrintOpen(true);
        } else if (discountCards.length > 0) {
          setSelectedCard(discountCards[0]);
          setIsPrintOpen(true);
        }
      }),
      registerShortcut('ctrl+shift+c', 'Membership', 'Copy Membership Card Number', () => {
        const cardToCopy = selectedCard || (discountCards.length > 0 ? discountCards[0] : null);
        if (cardToCopy) {
          navigator.clipboard.writeText(cardToCopy.cardNumber);
        }
      }),
      registerShortcut('ctrl+shift+q', 'Membership', 'Generate Card QR/Barcode Label', () => {
        const activeCard = selectedCard || (discountCards.length > 0 ? discountCards[0] : null);
        if (activeCard) {
          setSelectedCard(activeCard);
          setPrintLayout('qr-only');
          setIsPrintOpen(true);
        }
      }),
    ];

    return () => {
      unregisterList.forEach((un) => un());
    };
  }, [selectedCard, discountCards, registerShortcut]);

  // Audit Logs (locally tracked in state and storage)
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; action: string; details: string; user: string }>>(() => {
    const saved = localStorage.getItem('sf_card_audit_logs');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'aud_1',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        action: 'Database Initialization',
        details: 'Discount Card core registry loaded successfully.',
        user: 'System Administrator'
      },
      {
        id: 'aud_2',
        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        action: 'Rules Check',
        details: 'Pre-flight safety checks passed for luxury tiers.',
        user: 'Security Agent'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('sf_card_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Synchronize barcodeText automatically when customerName or dob changes
  useEffect(() => {
    if (isCreateOpen) {
      const { text } = getBarcodeTextAndImage(cardForm.customerName, cardForm.dob);
      setCardForm((prev) => ({
        ...prev,
        barcodeText: text,
      }));
    }
  }, [cardForm.customerName, cardForm.dob, isCreateOpen]);

  // Helper function to append audit log
  const writeAuditLog = (action: string, details: string) => {
    const newLog = {
      id: 'aud_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      action,
      details,
      user: 'Showroom Admin'
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Helper for Custom Toasts
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sound & Visual Scanning simulation trigger
  const [isScanning, setIsScanning] = useState(false);
  const triggerSimulationScan = (barcodeOrCardNum: string) => {
    setIsScanning(true);
    // Simulate beep sound via Audio API
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // Beep frequency
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 100);
    } catch (e) {
      // Ignored if audio contexts blocked
    }

    setTimeout(() => {
      setIsScanning(false);
      const card = discountCards.find(
        (c) => 
          c.barcodeText === barcodeOrCardNum || 
          c.cardNumber === barcodeOrCardNum ||
          (c.barcodeText && c.barcodeText.replace(/\s+/g, '') === barcodeOrCardNum.replace(/\s+/g, ''))
      );
      if (card) {
        setSelectedCard(card);
        setIsViewOpen(true);
        showToast(`Scan Detected: Card ${card.cardNumber}`, 'success');
        writeAuditLog('Barcode Scanned', `Card ${card.cardNumber} parsed by handheld optical sensor.`);
      }
    }, 200);
  };

  const getNextCardNumber = () => {
    const openingDate = settings?.storeProfile?.openingDate || '15/03/2026';
    const prefix = getOpeningDatePrefix(openingDate);
    const nextSeq = lastMembershipSerial + 1;
    const seqStr = String(nextSeq).padStart(4, '0');
    return `${prefix} 0000 ${seqStr}`;
  };

  // Handle Card Type update
  const handleCardTypeChange = (typeId: string) => {
    const safeTypeId = (typeId || '').toLowerCase();
    const mType = membershipTypes.find(
      (t) => (t.id || '').toLowerCase() === safeTypeId || (t.name || '').toLowerCase() === safeTypeId
    );
    if (!mType) return;

    // Get the associated discount percentage from rules
    const rulesForCard = membershipDiscountRules.filter(
      (r) => (r.membershipTypeId || '').toLowerCase() === (mType.id || '').toLowerCase()
    );
    const highestRule = [...rulesForCard].sort((a, b) => b.discountPercentage - a.discountPercentage)[0];
    const percentage = highestRule ? highestRule.discountPercentage : 10;

    const limit = mType.maxDiscountPerBill || 5000;
    const validityMonths = settings.storeProfile.membershipValidityMonths || mType.validityMonths || 12;
    const expiry = new Date(Date.now() + validityMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setCardForm((prev) => ({
      ...prev,
      cardType: mType.id as any,
      discountPercentage: percentage,
      maxDiscountLimit: limit,
      expiryDate: expiry
    }));
  };

  // Auto Generate unique card numbers
  const triggerCardNumberGeneration = () => {
    const code = getNextCardNumber();
    setCardForm((prev) => ({
      ...prev,
      cardNumber: code
    }));
  };

  // Security Verification Pin Dialog
  const verifySecurityPinAndExecute = (onSuccess: () => void) => {
    setSecurityPinInput('');
    setSecurityPinError('');
    setOnSecurityPinSuccess(() => onSuccess);
    setIsSecurityPinOpen(true);
  };

  const handleSecurityPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityPinInput === '2026') { // Standard default admin code
      setIsSecurityPinOpen(false);
      setSecurityPinError('');
      if (onSecurityPinSuccess) {
        onSecurityPinSuccess();
      }
    } else {
      setSecurityPinError('Incorrect Manager Pin. Override access denied.');
      writeAuditLog('Unauthorized Override Attempt', 'Operator entered incorrect safety PIN.');
    }
  };

  const handleOpenExistingCardCustomer = (custData: any) => {
    setCardDuplicateModal({ isOpen: false, existingCustomer: null });
    setIsCreateOpen(false);
    setIsEditOpen(false);
    const clean = (custData.phone || '').replace(/\D/g, '');
    const matchingCard = discountCards.find((c) => (c.mobileNumber || '').replace(/\D/g, '') === clean);
    if (matchingCard) {
      setSelectedCard(matchingCard);
      showToast(`Selected existing card: ${matchingCard.cardNumber}`, 'info');
    }
  };

  // Create Card Submission
  const handleCreateCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.cardNumber) {
      showToast('Please auto-generate or enter a card number', 'error');
      return;
    }

    // Check duplicate card number
    const exists = discountCards.find((c) => c.cardNumber.toUpperCase() === cardForm.cardNumber.trim().toUpperCase());
    if (exists) {
      showToast('Card number already exists!', 'error');
      return;
    }

    // Check duplicate mobile number
    const cleanPhone = cardForm.mobileNumber.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const existingCard = discountCards.find((c) => (c.mobileNumber || '').replace(/\D/g, '') === cleanPhone);
      const existingCust = findCustomerByPhone(cleanPhone);

      if (existingCard || existingCust) {
        setCardDuplicateModal({
          isOpen: true,
          existingCustomer: existingCard
            ? { name: existingCard.customerName, phone: existingCard.mobileNumber, notes: `Card Serial: ${existingCard.cardNumber}` }
            : existingCust!,
        });
        return;
      }
    }

    const processCreation = () => {
      const newCard = addDiscountCard({
        cardNumber: cardForm.cardNumber.trim().toUpperCase(),
        barcodeText: cardForm.barcodeText.trim() || getBarcodeTextAndImage(cardForm.customerName, cardForm.dob).text,
        customerName: cardForm.customerName.trim(),
        mobileNumber: cardForm.mobileNumber.trim(),
        email: cardForm.email.trim() || undefined,
        address: cardForm.address.trim() || undefined,
        cardType: cardForm.cardType,
        discountPercentage: cardForm.discountPercentage,
        maxDiscountLimit: cardForm.maxDiscountLimit || undefined,
        issueDate: cardForm.issueDate,
        expiryDate: cardForm.expiryDate,
        status: cardForm.status,
        dob: cardForm.dob || '15/05/1975',
      });

      setIsCreateOpen(false);
      showToast(`Discount Card Created: ${newCard.cardNumber}`, 'success');
      writeAuditLog('Card Created', `Issued ${newCard.cardType.toUpperCase()} discount card to ${newCard.customerName}.`);
    };

    // If custom discount percentage > 25%, require manager verification!
    if (cardForm.discountPercentage > 25) {
      verifySecurityPinAndExecute(processCreation);
    } else {
      processCreation();
    }
  };

  // Edit Card Submission
  const handleEditCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;

    // Check duplicate mobile number for another card
    const cleanPhone = cardForm.mobileNumber.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const existingCard = discountCards.find((c) => c.id !== selectedCard.id && (c.mobileNumber || '').replace(/\D/g, '') === cleanPhone);
      const existingCust = findCustomerByPhone(cleanPhone);

      if (existingCard || (existingCust && existingCust.phone.replace(/\D/g, '') === cleanPhone && (existingCust.name || '').toLowerCase() !== (cardForm.customerName || '').toLowerCase())) {
        setCardDuplicateModal({
          isOpen: true,
          existingCustomer: existingCard
            ? { name: existingCard.customerName, phone: existingCard.mobileNumber, notes: `Card Serial: ${existingCard.cardNumber}` }
            : existingCust!,
        });
        return;
      }
    }

    const processUpdate = () => {
      updateDiscountCard(selectedCard.id, {
        cardNumber: cardForm.cardNumber.trim().toUpperCase(),
        barcodeText: cardForm.barcodeText.trim() || getBarcodeTextAndImage(cardForm.customerName, cardForm.dob).text,
        customerName: cardForm.customerName,
        mobileNumber: cardForm.mobileNumber,
        email: cardForm.email || undefined,
        address: cardForm.address || undefined,
        cardType: cardForm.cardType,
        discountPercentage: cardForm.discountPercentage,
        maxDiscountLimit: cardForm.maxDiscountLimit || undefined,
        issueDate: cardForm.issueDate,
        expiryDate: cardForm.expiryDate,
        status: cardForm.status,
        dob: cardForm.dob || '15/05/1975',
      });
      setIsEditOpen(false);
      showToast('Discount Card updated successfully!', 'success');
      writeAuditLog('Card Updated', `Modified credentials for Card ${selectedCard.cardNumber}.`);
    };

    if (cardForm.discountPercentage > 25) {
      verifySecurityPinAndExecute(processUpdate);
    } else {
      processUpdate();
    }
  };

  // Card Management Action Triggers
  const handleRenewCard = (card: DiscountCard) => {
    if (card.status === 'blocked') {
      showToast('Membership cannot be extended while the card is suspended or blocked.', 'error');
      return;
    }
    setRenewCardTarget(card);
  };

  const executeRenewCard = async () => {
    if (!renewCardTarget) return;
    setIsUpdatingMembership(true);

    try {
      // Simulate/wait briefly to avoid duplicate clicks / show "Updating Membership..."
      await new Promise(resolve => setTimeout(resolve, 800));

      const card = renewCardTarget;
      const isExpired = new Date(card.expiryDate).getTime() < Date.now();

      let updatedExpiry = '';
      if (isExpired) {
        // Extend one year from today's date
        const today = new Date();
        today.setFullYear(today.getFullYear() + 1);
        updatedExpiry = today.toISOString().split('T')[0];
      } else {
        // Add exactly 12 months to the current expiry date, preserving original day and month
        const parts = card.expiryDate.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            const year = parseInt(parts[0], 10);
            updatedExpiry = `${year + 1}-${parts[1]}-${parts[2]}`;
          } else if (parts[2].length === 4) {
            // DD/MM/YYYY
            const year = parseInt(parts[2], 10);
            updatedExpiry = `${parts[0]}/${parts[1]}/${year + 1}`;
          } else {
            const d = new Date(card.expiryDate);
            d.setFullYear(d.getFullYear() + 1);
            updatedExpiry = d.toISOString().split('T')[0];
          }
        } else {
          const d = new Date(card.expiryDate);
          d.setFullYear(d.getFullYear() + 1);
          updatedExpiry = d.toISOString().split('T')[0];
        }
      }

      // Update in local state/store
      updateDiscountCard(card.id, {
        expiryDate: updatedExpiry,
        status: 'active'
      });

      // Write audit log with expected exact formatting
      writeAuditLog(
        'Membership Extended',
        `Previous Expiry: ${card.expiryDate}\nNew Expiry: ${updatedExpiry}\nExtended By: Current Administrator`
      );

      showToast('Membership successfully extended by 1 year.', 'success');

      // Refresh selectedCard UI state immediately
      if (selectedCard && selectedCard.id === card.id) {
        setSelectedCard(prev => prev ? { ...prev, expiryDate: updatedExpiry, status: 'active' } : null);
      }
    } catch (err) {
      console.error("Failed to extend membership:", err);
      showToast('Error renewing membership.', 'error');
    } finally {
      setIsUpdatingMembership(false);
      setRenewCardTarget(null);
    }
  };

  const handleToggleSuspend = (card: DiscountCard) => {
    const nextStatus = card.status === 'blocked' ? 'active' : 'blocked';
    updateDiscountCard(card.id, {
      status: nextStatus
    });
    if (selectedCard && selectedCard.id === card.id) {
      setSelectedCard(prev => prev ? { ...prev, status: nextStatus } : null);
    }
    showToast(`Card ${card.cardNumber} is now ${nextStatus.toUpperCase()}`, nextStatus === 'active' ? 'success' : 'info');
    writeAuditLog('Card Status Changed', `Status of Card ${card.cardNumber} set to ${nextStatus.toUpperCase()}.`);
  };

  const handleDeleteCard = (card: DiscountCard | null) => {
    if (!card) return;
    setCardToDelete(card);
  };

  const handleReissueLostCard = (card: DiscountCard | null) => {
    if (!card) {
      showToast('No card selected to reissue', 'error');
      return;
    }
    verifySecurityPinAndExecute(() => {
      const newCardNo = getNextCardNumber();
      // Increment serial number
      const nextSerial = lastMembershipSerial + 1;
      updateLastMembershipSerial(nextSerial);

      // Update card number but keep historical savings and usage logs!
      updateDiscountCard(card.id, {
        cardNumber: newCardNo,
        status: 'active'
      });
      setSelectedCard({
        ...card,
        cardNumber: newCardNo,
        status: 'active'
      });
      showToast(`Card Reissued! New Card Number: ${newCardNo}`, 'success');
      writeAuditLog('Card Reissued', `Generated new card credentials ${newCardNo} replacing old lost card of ${card.customerName}.`);
    });
  };

  // Open Create Mode Form
  const openCreateModal = () => {
    const nextNum = getNextCardNumber();
    const barcodeTextVal = getBarcodeTextAndImage('', '15/05/1975').text;
    
    // Find first membership type
    const firstType = membershipTypes.length > 0 ? membershipTypes[0] : null;
    const defaultTypeId = firstType ? firstType.id : 'platinum';
    
    const rulesForCard = firstType ? membershipDiscountRules.filter(
      (r) => (r.membershipTypeId || '').toLowerCase() === (firstType.id || '').toLowerCase()
    ) : [];
    const highestRule = [...rulesForCard].sort((a, b) => b.discountPercentage - a.discountPercentage)[0];
    const defaultPct = highestRule ? highestRule.discountPercentage : 20;
    const limit = firstType ? firstType.maxDiscountPerBill : 5000;
    const validityMonths = settings.storeProfile.membershipValidityMonths || (firstType ? firstType.validityMonths : 12);
    const expiry = new Date(Date.now() + validityMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setCardForm({
      cardNumber: nextNum,
      barcodeText: barcodeTextVal,
      customerName: '',
      mobileNumber: '',
      email: '',
      address: '',
      cardType: defaultTypeId as any,
      discountPercentage: defaultPct,
      maxDiscountLimit: limit,
      status: 'active',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: expiry,
      dob: '15/05/1975',
    });
    setIsCreateOpen(true);
  };

  // Open Edit Mode Form
  const openEditModal = (card: DiscountCard) => {
    setSelectedCard(card);
    
    const cardTypeVal = (card.cardType || '').toLowerCase();
    const mType = membershipTypes.find(
      (t) => (t.id || '').toLowerCase() === cardTypeVal || (t.name || '').toLowerCase() === cardTypeVal
    );
    const rulesForCard = mType ? membershipDiscountRules.filter(
      (r) => (r.membershipTypeId || '').toLowerCase() === (mType.id || '').toLowerCase()
    ) : [];
    const highestRule = [...rulesForCard].sort((a, b) => b.discountPercentage - a.discountPercentage)[0];
    const defaultPct = highestRule ? highestRule.discountPercentage : card.discountPercentage;
    const limit = mType ? mType.maxDiscountPerBill : (card.maxDiscountLimit || 5000);

    setCardForm({
      cardNumber: card.cardNumber,
      barcodeText: card.barcodeText || getBarcodeTextAndImage(card.customerName, card.dob).text,
      customerName: card.customerName,
      mobileNumber: card.mobileNumber,
      email: card.email || '',
      address: card.address || '',
      cardType: card.cardType,
      discountPercentage: defaultPct,
      maxDiscountLimit: limit,
      status: card.status,
      issueDate: card.issueDate,
      expiryDate: card.expiryDate,
      dob: card.dob || '15/05/1975',
    });
    setIsEditOpen(true);
  };

  // Simulated PDF & Excel exports
  const handleExportData = (format: 'pdf' | 'excel') => {
    showToast(`Generating ${format.toUpperCase()} Document ...`, 'info');
    setTimeout(() => {
      showToast(`Exported ${discountCards.length} rows to ${storeName.replace(/\s+/g, '_').toUpperCase()}_DISCOUNT_CARDS.${format === 'pdf' ? 'pdf' : 'xlsx'}`, 'success');
      writeAuditLog('Data Exported', `Downloaded client registry in ${format.toUpperCase()} format.`);
    }, 1500);
  };

  // Simulated WhatsApp Broadcasts
  const handleSendWhatsAppNotice = (card: DiscountCard, type: 'expiry' | 'birthday' | 'promo') => {
    let text = '';
    if (type === 'expiry') {
      text = `Dear ${card.customerName || 'Valued Customer'}, your ${storeName} ${(card.cardType || '').toUpperCase()} Discount Card is expiring on ${card.expiryDate}. Visit Milan Galleria to renew or shop for high fashion discounts!`;
    } else if (type === 'birthday') {
      text = `Happy Birthday ${card.customerName}! Exclusive 20% flat birthday concierge discount code loaded to your ${card.cardNumber} card. Redeemable at billing desk!`;
    } else {
      text = `Private Platinum Showcase at Milan Galleria! Enjoy extra tier discount benefits using your card ${card.cardNumber}. RSVP.`;
    }

    const url = `https://wa.me/${card.mobileNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showToast(`WhatsApp notification triggered for ${card.customerName}`, 'success');
    writeAuditLog('WhatsApp Triggered', `Fired WhatsApp message templates to ${card.mobileNumber}.`);
  };

  // Dynamically compute stats from actual live cards array
  const totalCards = discountCards.length;
  const activeCards = discountCards.filter((c) => c.status === 'active').length;
  const expiredCards = discountCards.filter((c) => c.status === 'expired').length;
  const blockedCards = discountCards.filter((c) => c.status === 'blocked').length;

  // Usage today computed dynamically
  const todayStr = new Date().toISOString().split('T')[0];
  const totalSavingsToday = discountCards.reduce((sum, c) => {
    const todayLogs = c.usageLogs.filter((log) => log.date.startsWith(todayStr));
    return sum + todayLogs.reduce((acc, l) => acc + l.discountGiven, 0);
  }, 0);
  const cardsUsedToday = discountCards.filter((c) =>
    c.usageLogs.some((log) => log.date.startsWith(todayStr))
  ).length;

  const totalSavingsAllTime = discountCards.reduce((sum, c) => sum + c.totalSavings, 0);

  // Expiry counts memoized
  const cardsExpiringSoon = useMemo(() => {
    const now = Date.now();
    return discountCards.filter((c) => {
      if (c.status !== 'active') return false;
      const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - now) / (1000 * 3600 * 24));
      return daysLeft > 0 && daysLeft <= 30;
    });
  }, [discountCards]);

  // Filtered lists of cards memoized
  const filteredCards = useMemo(() => {
    const query = (debouncedSearchQuery || '').toLowerCase().trim();
    return discountCards.filter((card) => {
      let matchesSearch = true;
      if (query) {
        matchesSearch =
          (card.customerName || '').toLowerCase().includes(query) ||
          (card.cardNumber || '').toLowerCase().includes(query) ||
          (card.mobileNumber || '').includes(query);
      }

      const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
      const matchesType = typeFilter === 'all' || card.cardType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [discountCards, debouncedSearchQuery, statusFilter, typeFilter]);

  // Analytics Report generation data (dynamic)
  const chartDataByTier = useMemo(() => {
    const activeList = discountCards.filter((c) => c.status === 'active');
    const expiredList = discountCards.filter((c) => c.status === 'expired');
    const blockedList = discountCards.filter((c) => c.status === 'blocked');

    return [
      { name: 'Active Platinum', count: activeList.length, savings: activeList.reduce((sum, c) => sum + c.totalSavings, 0) },
      { name: 'Expired Platinum', count: expiredList.length, savings: expiredList.reduce((sum, c) => sum + c.totalSavings, 0) },
      { name: 'Blocked Platinum', count: blockedList.length, savings: blockedList.reduce((sum, c) => sum + c.totalSavings, 0) },
    ];
  }, [discountCards]);

  // Colors for charts
  const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  // Flat usage logs list across all cards
  const allUsageLogs = useMemo(() => {
    return discountCards.reduce<Array<DiscountCardUsageLog & { cardNumber: string; customerName: string }>>((acc, card) => {
      const logs = card.usageLogs.map((l) => ({
        ...l,
        cardNumber: card.cardNumber,
        customerName: card.customerName,
      }));
      return [...acc, ...logs];
    }, []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [discountCards]);

  // Card generation with high-fidelity PDF export
  const executeCardPrint = async () => {
    if (!selectedCard) {
      showToast('No card selected to print', 'error');
      return;
    }

    if (isPrinting) return; // Prevent multiple clicks

    setIsPrinting(true);
    setPrintProgress(0);
    setIsFadeOut(false);

    // Track when the process starts
    const startTime = performance.now();
    const duration = 1200; // Total 1.2s smooth animated sequence

    let pdfResult: { pdfUrl: string; downloadName: string } | null = null;
    let pdfError: any = null;

    // Start rendering and PDF generation in parallel immediately (this preloads assets and renders in background)
    const pdfPromise = (async () => {
      // Small tick to ensure layout and preloading of SVG card template, barcode, and fonts
      await new Promise((resolve) => setTimeout(resolve, 100));

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.60, 53.98], // Exact CR80 / PVC Card Dimensions
        compress: true
      });

      const restoreStyleCallbacks: (() => void)[] = [];

      try {
        if (printLayout === 'standard') {
          const frontEl = document.getElementById('card-front-printable');
          const backEl = document.getElementById('card-back-printable');

          if (!frontEl || !backEl) {
            throw new Error('Printable front/back elements not found');
          }

          // Apply oklch to rgb conversions before canvas capturing
          restoreStyleCallbacks.push(convertOklchStylesToRgb(frontEl));
          restoreStyleCallbacks.push(convertOklchStylesToRgb(backEl));

          // Capture front side
          const frontCanvas = await html2canvas(frontEl, {
            useCORS: true,
            allowTaint: true,
            scale: 4,
            backgroundColor: null,
            logging: false
          });

          const frontImg = frontCanvas.toDataURL('image/jpeg', 0.98);
          pdf.addImage(frontImg, 'JPEG', 0, 0, 85.60, 53.98, undefined, 'FAST');

          // Add back side page
          pdf.addPage([85.60, 53.98], 'landscape');

          // Capture back side
          const backCanvas = await html2canvas(backEl, {
            useCORS: true,
            allowTaint: true,
            scale: 4,
            backgroundColor: null,
            logging: false
          });

          const backImg = backCanvas.toDataURL('image/jpeg', 0.98);
          pdf.addImage(backImg, 'JPEG', 0, 0, 85.60, 53.98, undefined, 'FAST');

        } else {
          const printEl = document.getElementById('printable-area');
          if (!printEl) {
            throw new Error('Printable area element not found');
          }

          restoreStyleCallbacks.push(convertOklchStylesToRgb(printEl));

          const canvas = await html2canvas(printEl, {
            useCORS: true,
            allowTaint: true,
            scale: 4,
            backgroundColor: null,
            logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          pdf.addImage(imgData, 'JPEG', 0, 0, 85.60, 53.98, undefined, 'FAST');
        }

        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const downloadName = `${(selectedCard.customerName || 'Customer').replace(/\s+/g, '_')}_${(selectedCard.cardType || 'MEMBER').toUpperCase()}_Membership_Card.pdf`;

        return { pdfUrl, downloadName };
      } catch (err) {
        console.error("PDF generation internal error: ", err);
        throw err;
      } finally {
        // Execute style restore callbacks
        restoreStyleCallbacks.forEach((restore) => {
          try {
            restore();
          } catch (restoreErr) {
            console.warn("Failed to restore element styles:", restoreErr);
          }
        });
      }
    })();

    // Resolve the promise in background
    pdfPromise.then(
      (res) => {
        pdfResult = res;
      },
      (err) => {
        pdfError = err;
      }
    );

    // Animation Loop using requestAnimationFrame
    const updateProgress = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      let progress = Math.min((elapsed / duration) * 100, 100);

      // Hold at 95% if background generation is not yet done
      if (progress >= 95 && !pdfResult && !pdfError) {
        progress = 95;
      }

      setPrintProgress(Math.floor(progress));

      if (pdfError) {
        setIsPrinting(false);
        setPrintProgress(0);
        showToast('❌ Unable to generate printable card. Please try again.', 'error');
        return;
      }

      if (progress < 100) {
        requestAnimationFrame(updateProgress);
      } else {
        // We hit 100% and we have the result!
        if (pdfResult) {
          setIsFadeOut(true);
          // Wait 300ms for smooth fade out transition
          setTimeout(() => {
            setIsPrinting(false);
            setIsFadeOut(false);
            setPrintProgress(0);

            const currentPdfResult = pdfResult;
            if (currentPdfResult) {
              // Save PDF locally (automatic download)
              const downloadLink = document.createElement('a');
              downloadLink.href = currentPdfResult.pdfUrl;
              downloadLink.download = currentPdfResult.downloadName;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);

              showToast('Membership Card PDF generated and downloaded successfully!', 'success');
            }
          }, 300);
        }
      }
    };

    requestAnimationFrame(updateProgress);
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner for simulated scanning activity */}
      {isScanning && (
        <div className="fixed inset-0 bg-amber-500/10 backdrop-blur-xs z-50 flex items-center justify-center animate-pulse pointer-events-none">
          <div className="bg-slate-900/90 border border-amber-500 text-amber-400 font-mono py-4 px-8 rounded-full flex items-center gap-3 shadow-2xl">
            <QrCode className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-sm font-bold tracking-widest">OPTICAL CONCIERGE BARCODE BEEPER ACTUATED</span>
          </div>
        </div>
      )}

      {/* Floating Interactive Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-2xl animate-bounce">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : toast.type === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100">{toast.message}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Milan Galleria Concierge Desk</p>
            </div>
          </div>
        </div>
      )}

      {isViewOpen && selectedCard ? (
        <div className="space-y-6 animate-fade-in w-full min-h-screen pb-12">

        {/* PAGE HEADER */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <button
              id="btn-back-to-cards"
              type="button"
              onClick={() => setIsViewOpen(false)}
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Discount Cards</span>
            </button>
            <h1 className="font-serif text-2xl md:text-3xl font-black text-amber-100 tracking-tight uppercase">
              Card Details
            </h1>
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-print-overlay"
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Card</span>
            </button>
            <button
              id="btn-reissue-lost"
              type="button"
              onClick={() => handleReissueLostCard(selectedCard)}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span>Reissue Lost Card</span>
            </button>
            <PermissionButton
              id="btn-delete-card-direct"
              module="discount-cards"
              action="delete"
              onClick={() => handleDeleteCard(selectedCard)}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-rose-500/20 cursor-pointer shadow-md"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Delete Card</span>
            </PermissionButton>
          </div>
        </div>

        {/* TOP SECTION */}
        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-amber-100">
                  {formatMemberName(selectedCard.customerName)}
                </h2>
                <span className="font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs uppercase font-bold tracking-wider">
                  {selectedCard.cardType} MEMBER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                <span>Unique Account Number:</span>
                <span className="font-mono text-amber-300 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                  {selectedCard.cardNumber}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* STATISTICS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Discount Percentage', value: `${selectedCard.discountPercentage}%`, desc: 'Locked tier rate', icon: Percent, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
            { label: 'All-Time Savings', value: formatINR(selectedCard.totalSavings, { keepDecimals: true }), desc: 'Total ledger discount given', icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
            { label: 'Membership Status', value: (selectedCard.status || '').toUpperCase(), desc: selectedCard.status === 'active' ? 'Active circulation' : 'Suspended/Expired', icon: Shield, color: selectedCard.status === 'active' ? 'text-emerald-400' : 'text-rose-400', bg: selectedCard.status === 'active' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20' },
            { label: 'Total Visits / Uses', value: `${selectedCard.usageLogs.length} transactions`, desc: 'Scan verification count', icon: Clock, color: 'text-pink-400', bg: 'bg-pink-500/5 border-pink-500/20' },
          ].map((m, idx) => {
            const Icon = m.icon;
            return (
              <div key={idx} className={`bg-slate-900 border p-5 rounded-2xl shadow-lg transition-all hover:border-amber-500/30 ${m.bg}`}>
                <div className="flex justify-between items-start text-slate-400">
                  <span className="text-[10px] uppercase tracking-wider font-bold leading-none text-slate-400">{m.label}</span>
                  <Icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-100 mt-3 font-serif">{m.value}</h3>
                <p className="text-[10px] text-slate-400 leading-normal mt-1">{m.desc}</p>
              </div>
            );
          })}
        </div>

        {/* MAIN CONTENT: TWO-COLUMN DESKTOP LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: Patron Registry Details & Quick Access Operations */}
          <div className="lg:col-span-5 space-y-6">
            {/* Patron Registry Details Card */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="font-serif text-base font-bold text-amber-100 border-b border-slate-850 pb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                <span>Patron Registry Details</span>
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><User className="w-3.5 h-3.5 text-slate-500" /> Full Name:</span>
                  <span className="text-slate-100 font-bold">{formatMemberName(selectedCard.customerName)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Date of Birth:</span>
                  <span className="text-slate-100 font-mono font-bold">{selectedCard.dob || '15/05/1975'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><Smartphone className="w-3.5 h-3.5 text-slate-500" /> Phone Mobile:</span>
                  <span className="text-slate-100 font-mono">{selectedCard.mobileNumber}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-500" /> Email:</span>
                  <span className="text-slate-100 font-mono">{selectedCard.email || 'None Registered'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-500" /> Residence:</span>
                  <span className="text-slate-100 text-right max-w-[200px] truncate">{selectedCard.address || 'Walk-in Member'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Issue Date:</span>
                  <span className="text-slate-100 font-mono">{selectedCard.issueDate}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Valid Until:</span>
                  <span className="text-slate-100 font-mono">{selectedCard.expiryDate}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                  <span className="text-slate-400 flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-slate-500" /> Status:</span>
                  <span className={`font-bold capitalize px-2.5 py-0.5 rounded text-[11px] ${selectedCard.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {selectedCard.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Access Control Operations Card */}
            <div className="p-6 bg-slate-900 border border-slate-850 rounded-2xl shadow-xl space-y-4">
              <h4 className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Quick Access Control Operations</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  id="btn-renew-detail"
                  type="button"
                  disabled={selectedCard.status === 'blocked' || isUpdatingMembership}
                  onClick={() => handleRenewCard(selectedCard)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                  title={selectedCard.status === 'blocked' ? "Membership cannot be extended while the card is suspended or blocked." : undefined}
                >
                  <RefreshCw className={`w-4 h-4 text-amber-400 ${isUpdatingMembership ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingMembership ? 'Updating...' : 'Extend 1-Yr'}</span>
                </button>
                <button
                  id="btn-toggle-suspend-detail"
                  type="button"
                  disabled={isUpdatingMembership}
                  onClick={() => handleToggleSuspend(selectedCard)}
                  className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer ${selectedCard.status === 'blocked' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'}`}
                >
                  <Shield className="w-4 h-4" />
                  <span>{selectedCard.status === 'blocked' ? 'Active Status' : 'Suspend Card'}</span>
                </button>
              </div>
              {selectedCard.status === 'blocked' && (
                <p className="text-[11px] text-red-400 font-medium leading-relaxed text-center mt-2 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                  Membership cannot be extended while the card is suspended or blocked.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Patron Checkout Usage History Logs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Patron Checkout Usage History Logs</span>
                </h3>
                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-850">
                  {selectedCard.usageLogs.length} Records
                </span>
              </div>

              {selectedCard.usageLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 font-mono text-xs bg-slate-950/40 rounded-xl border border-dashed border-slate-850">
                  No active transaction history located. Apply this card number during showroom sale to log savings.
                </div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto space-y-3 pr-1">
                  {selectedCard.usageLogs.map((log) => (
                    <div key={log.id} className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 hover:border-amber-500/20 transition flex justify-between items-center text-xs shadow-md">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-xs">
                            {log.invoiceNo}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{new Date(log.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          Transaction Total: <span className="font-mono text-slate-200 font-bold">{formatINR(log.originalAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400 font-mono">-{formatINR(log.discountGiven, { keepDecimals: true })}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Saved Amount</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      ) : (
        <div className="space-y-6">
          {/* Module Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-black tracking-tight text-amber-100 uppercase">
            Luxury Discount Cards
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Privileged member card registries, barcode issuance gates, and automatic billing integration.
          </p>
        </div>

        {/* Action Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="tab-btn-cards"
            onClick={() => setActiveSubTab('cards')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition ${activeSubTab === 'cards' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200'}`}
          >
            <CreditCard className="w-3.5 h-3.5 inline mr-1" />
            Tiers & Cards
          </button>
          <button
            id="tab-btn-reports"
            onClick={() => setActiveSubTab('reports')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition ${activeSubTab === 'reports' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200'}`}
          >
            <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
            Usage Analytics
          </button>
          <button
            id="tab-btn-notifications"
            onClick={() => setActiveSubTab('notifications')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition ${activeSubTab === 'notifications' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200'}`}
          >
            <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
            Reminders ({cardsExpiringSoon.length})
          </button>
          <button
            id="tab-btn-audit"
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition ${activeSubTab === 'audit' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200'}`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Audit Trail
          </button>
        </div>
      </div>

      {/* Dynamic Premium Metrics Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        {[
          { label: 'Total Platinum Cards', value: totalCards, desc: 'Registered Platinum accounts', icon: CreditCard, color: 'text-amber-400', bg: 'from-amber-500/10' },
          { label: 'Active Platinum Cards', value: activeCards, desc: 'Currently in circulation', icon: CheckCircle, color: 'text-emerald-400', bg: 'from-emerald-500/10' },
          { label: 'Expired Platinum Cards', value: expiredCards, desc: 'Requires direct renewal', icon: Calendar, color: 'text-slate-400', bg: 'from-slate-500/10' },
          { label: 'Blocked Platinum Cards', value: blockedCards, desc: 'Restricted members', icon: ShieldAlert, color: 'text-red-400', bg: 'from-red-500/10' },
          { label: 'Platinum Usage Today', value: cardsUsedToday, desc: `Scanned at checkout today`, icon: QrCode, color: 'text-yellow-400', bg: 'from-yellow-500/10' },
          { label: 'Total Discount Given', value: `₹${totalSavingsAllTime.toLocaleString()}`, desc: 'Cumulative Platinum savings', icon: Percent, color: 'text-pink-400', bg: 'from-pink-500/10' },
        ].map((metric, i) => {
          const Icon = metric.icon;
          return (
            <div
              key={i}
              className="bg-slate-900 border border-slate-850/60 rounded-xl p-3.5 relative overflow-hidden flex flex-col justify-between shadow-md"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${metric.bg} to-transparent opacity-10 blur-xl`} />
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black leading-none">{metric.label}</span>
                <Icon className={`w-4 h-4 ${metric.color}`} />
              </div>
              <div className="mt-3">
                <h3 className="font-serif text-lg md:text-xl font-bold text-slate-100">{metric.value}</h3>
                <p className="text-[9px] text-slate-500 font-semibold truncate leading-normal mt-0.5">{metric.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Automated Expiry Alerts Banner */}
      {cardsExpiringSoon.length > 0 && (
        <div id="expiry-dashboard-alert" className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="font-serif text-sm font-bold text-amber-200 uppercase tracking-wider flex flex-wrap items-center gap-2">
                  <span>Membership Expirations Looming</span>
                  <span className="bg-rose-500/10 text-rose-300 text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full border border-rose-500/20 animate-pulse">
                    {cardsExpiringSoon.length} {cardsExpiringSoon.length === 1 ? 'Card' : 'Cards'} Expiring Soon
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  The following elite member accounts are scheduled to lapse in status within the next 30 days. Proactive contact and instant 1-year renewal extension are recommended to preserve patron retention rates.
                </p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                id="btn-goto-reminders"
                onClick={() => setActiveSubTab('notifications')}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg border border-amber-500/20 transition flex items-center gap-2"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Manage Reminders
              </button>
            </div>
          </div>

          {/* Quick Renew Horizontal List */}
          <div className="mt-4 pt-4 border-t border-slate-850/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cardsExpiringSoon.slice(0, 3).map((card) => {
              const daysLeft = Math.ceil((new Date(card.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24));
              return (
                <div key={card.id} className="bg-slate-950/80 border border-slate-850 hover:border-amber-500/20 rounded-lg p-3 flex items-center justify-between gap-3 transition">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{formatMemberName(card.customerName)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[9px] text-amber-400/80 font-bold tracking-wider uppercase">
                        {formatMembershipCardNumber(settings?.storeProfile?.openingDate || '15/03/2026', card.cardNumber)}
                      </span>
                      <span className="text-[9px] text-rose-400 font-semibold bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10">
                        {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                      </span>
                    </div>
                  </div>
                  <button
                    disabled={card.status === 'blocked' || isUpdatingMembership}
                    onClick={() => handleRenewCard(card)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-md flex items-center gap-1 transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={card.status === 'blocked' ? "Membership cannot be extended while the card is suspended or blocked." : "Extend membership by 1 year"}
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isUpdatingMembership && renewCardTarget?.id === card.id ? 'animate-spin' : ''}`} />
                    {isUpdatingMembership && renewCardTarget?.id === card.id ? 'Updating...' : 'Renew'}
                  </button>
                </div>
              );
            })}
            {cardsExpiringSoon.length > 3 && (
              <div className="bg-slate-950/40 border border-dashed border-slate-850 rounded-lg p-3 flex items-center justify-center text-center">
                <button 
                  onClick={() => setActiveSubTab('notifications')}
                  className="text-slate-400 hover:text-amber-400 text-xs font-semibold transition"
                >
                  And {cardsExpiringSoon.length - 3} more accounts...
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render Main Selected Tab View */}
      {activeSubTab === 'cards' && (
        <div className="space-y-6">
          {/* Filtering and Actions Bar */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              {/* Search Bar */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="card-search-input"
                  type="text"
                  placeholder="Search cards by Patron Name, Card No (SFD-xxxx), phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-850 focus:border-amber-500/40 text-xs rounded-lg pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/10 transition"
                />
              </div>

              {/* Status filter */}
              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  id="card-status-filter"
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-slate-900 border border-slate-850 focus:border-amber-500/40 text-xs rounded-lg pl-8 pr-8 py-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/10 transition"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="blocked">Blocked</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

            </div>

            {/* Print, Export & Create Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                id="btn-export-excel"
                onClick={() => handleExportData('excel')}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Export member spreadsheet"
              >
                <Download className="w-3.5 h-3.5" />
                Export Sheets
              </button>
              <button
                id="btn-issue-discount-card"
                onClick={openCreateModal}
                className="gold-gradient text-slate-950 font-bold tracking-widest uppercase text-xs px-4 py-2.5 rounded-lg shadow-lg hover:opacity-90 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Issue Member Card
              </button>
            </div>
          </div>

          {/* Cards Dynamic Grid Grid */}
          {filteredCards.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-850 rounded-2xl p-12 text-center">
              <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="font-serif text-base font-bold text-slate-300">No Membership Records Located</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5">
                Refine your active filters, search criteria or issue a new custom luxury tier discount card immediately.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCards.map((card) => {
                // Determine gradient and text colors based on cardType
                let cardColorClasses = 'from-slate-700 via-slate-800 to-slate-950 text-slate-300 border-slate-700';
                let tagColor = 'bg-slate-950 border border-slate-800 text-slate-400';
                if (card.cardType === 'gold') {
                  cardColorClasses = 'from-amber-600 via-amber-800 to-slate-950 text-amber-200 border-amber-600/30';
                  tagColor = 'bg-amber-950/40 border border-amber-500/20 text-amber-400';
                } else if (card.cardType === 'platinum' || card.cardType === 'vip') {
                  cardColorClasses = 'from-[#121212] via-[#090909] to-[#1e1e1e] text-[#d4af37] border-[#c5a880]/35';
                  tagColor = 'border border-[#d4af37]/40 text-[#d4af37] bg-black/60';
                } else if (card.cardType === 'custom') {
                  cardColorClasses = 'from-fuchsia-700 via-fuchsia-900 to-slate-950 text-fuchsia-200 border-fuchsia-600/30';
                  tagColor = 'bg-fuchsia-950/40 border border-fuchsia-500/20 text-fuchsia-400';
                }

                const isNearExpiry = card.status === 'active' && Math.ceil((new Date(card.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24)) <= 30;
                const isFlipped = !!flippedCards[card.id];

                return (
                  <div
                    key={card.id}
                    id={`card-panel-${card.id}`}
                    className="group bg-slate-900 border border-slate-850/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-amber-500/30 shadow-lg flex flex-col justify-between"
                  >
                    {/* Visual Card Face */}
                    <div className="p-5 pb-3">
                      <div 
                        className="relative w-full aspect-[1.58/1] select-none cursor-pointer"
                        style={{ perspective: '1000px' }}
                        onClick={() => {
                          setSelectedCard(card);
                          setIsViewOpen(true);
                        }}
                      >
                        {/* Floating Flip Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlippedCards(prev => ({ ...prev, [card.id]: !prev[card.id] }));
                          }}
                          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-amber-400 border border-[#c5a880]/30 transition-all z-30 shadow-md flex items-center justify-center"
                          title="Flip card over"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>

                        <div 
                          className="w-full h-full relative"
                          style={{
                            transition: 'transform 0.6s',
                            transformStyle: 'preserve-3d',
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                          }}
                        >
                          {/* FRONT SIDE */}
                          <div 
                            className="absolute inset-0 w-full h-full rounded-xl overflow-hidden shadow-xl"
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                            }}
                          >
                            <PlatinumCardFront
                              cardNumber={card.cardNumber}
                              customerName={card.customerName}
                              expiryDate={card.expiryDate}
                              cardType={card.cardType}
                            />
                          </div>

                          {/* BACK SIDE */}
                          <div 
                            className="absolute inset-0 w-full h-full rounded-xl overflow-hidden shadow-xl"
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                            }}
                          >
                            <PlatinumCardBack 
                              barcodeText={card.barcodeText} 
                              customerName={card.customerName}
                              dob={card.dob}
                              cardType={card.cardType}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Metadata & Action Bar */}
                    <div className="px-5 py-3.5 border-t border-slate-850/60 flex flex-col gap-2 bg-slate-950/20 text-[10px] text-slate-400">
                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                        <div>
                          <span className="text-slate-500 uppercase text-[8px] font-bold tracking-wider block mb-0.5">Card Number</span>
                          <span className="font-mono font-bold text-slate-200">{card.cardNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[8px] font-bold tracking-wider block mb-0.5">Membership Tier</span>
                          <span className="font-bold text-amber-400 capitalize">{card.cardType}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[8px] font-bold tracking-wider block mb-0.5">Card Usage Count</span>
                          <span className="font-bold text-slate-200">{card.usageLogs.length} uses</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[8px] font-bold tracking-wider block mb-0.5">Total Member Savings</span>
                          <span className="font-bold text-emerald-400">{formatINR(card.totalSavings, { keepDecimals: true })}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[8px] font-bold tracking-wider block mb-0.5">Valid Until</span>
                          <span className="font-mono text-slate-200">{card.expiryDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[8px] font-bold tracking-wider block mb-0.5">Card Status</span>
                          <span className="font-bold">
                            {card.status === 'active' && (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            )}
                            {card.status === 'blocked' && (
                              <span className="text-red-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Blocked
                              </span>
                            )}
                            {card.status === 'expired' && (
                              <span className="text-slate-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                Expired
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Actions footer drawer */}
                    <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-850/50 grid grid-cols-4 gap-1.5">
                      <button
                        id={`btn-view-card-${card.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedCard(card);
                          setIsViewOpen(true);
                        }}
                        className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition text-[9px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1"
                        title="Open client metrics"
                      >
                        <Eye className="w-3 h-3" />
                        Stats
                      </button>

                      <PermissionButton
                        id={`btn-edit-card-${card.id}`}
                        module="discount-cards"
                        action="edit"
                        type="button"
                        onClick={() => openEditModal(card)}
                        className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-blue-400 transition text-[9px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1 cursor-pointer"
                        title="Edit details"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </PermissionButton>

                      <button
                        id={`btn-suspend-card-${card.id}`}
                        type="button"
                        onClick={() => handleToggleSuspend(card)}
                        className={`p-1.5 rounded text-[9px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1 transition ${card.status === 'blocked' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                        title={card.status === 'blocked' ? 'Re-activate card' : 'Suspend access'}
                      >
                        <Shield className="w-3 h-3" />
                        {card.status === 'blocked' ? 'Lift' : 'Block'}
                      </button>

                      <button
                        id={`btn-scan-sim-${card.id}`}
                        type="button"
                        onClick={() => triggerSimulationScan(card.cardNumber)}
                        className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition text-[9px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1"
                        title="Simulate terminal checkout scan"
                      >
                        <QrCode className="w-3 h-3" />
                        Scan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="space-y-6 animate-fade-in">
          {/* Analytics Overview and Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie chart of savings by membership tier */}
            <div className="bg-slate-900 border border-slate-850/60 rounded-2xl p-5 shadow-lg">
              <h3 className="font-serif text-sm font-bold text-slate-200 mb-1">Savings Ledger by Membership Tier</h3>
              <p className="text-[10px] text-slate-400 mb-4">Percentage of total luxury discount value given out by system category.</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartDataByTier.filter(d => d.savings > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="savings"
                    >
                      {chartDataByTier.filter(d => d.savings > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f8fafc', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                {chartDataByTier.map((tier, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index] }} />
                    <span className="text-slate-400 truncate">{tier.name}: <span className="font-bold text-slate-200">{formatINR(tier.savings, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart of issued member cards */}
            <div className="bg-slate-900 border border-slate-850/60 rounded-2xl p-5 shadow-lg lg:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h3 className="font-serif text-sm font-bold text-slate-200">Membership Tier Issued Count</h3>
                  <p className="text-[10px] text-slate-400">Analysis of count of active members in each luxury card category.</p>
                </div>
                <span className="text-[9px] bg-slate-950 border border-slate-800 px-2 py-1 rounded font-mono text-amber-400 font-bold">TOTAL: {totalCards}</span>
              </div>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataByTier}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f8fafc', fontSize: '11px' }}
                    />
                    <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]}>
                      {chartDataByTier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Usage Logs Reports */}
          <div className="bg-slate-900 border border-slate-850/60 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-850 pb-4 mb-4">
              <div>
                <h3 className="font-serif text-base font-bold text-slate-200">Card Utilization logs</h3>
                <p className="text-xs text-slate-400">Complete legal trace of every discount card billing scanned in showroom.</p>
              </div>
              <button
                id="btn-export-pdf"
                onClick={() => handleExportData('pdf')}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Export PDF Ledger
              </button>
            </div>

            {allUsageLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">
                No active usage logs found in system database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      <th className="py-2.5">Date / Time</th>
                      <th className="py-2.5">Card Number</th>
                      <th className="py-2.5">Customer Name</th>
                      <th className="py-2.5 text-right">Original Amt</th>
                      <th className="py-2.5 text-right">Discount Given</th>
                      <th className="py-2.5 text-right">Final Amt</th>
                      <th className="py-2.5 text-right">Order Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {allUsageLogs.map((log) => (
                      <tr key={log.id} className="text-slate-300 hover:bg-slate-950/40 transition">
                        <td className="py-3 font-mono">{new Date(log.date).toLocaleString()}</td>
                        <td className="py-3 font-mono text-amber-400 font-bold">{log.cardNumber}</td>
                        <td className="py-3">{formatMemberName(log.customerName)}</td>
                        <td className="py-3 text-right text-slate-400">{formatINR(log.originalAmount, { keepDecimals: true })}</td>
                        <td className="py-3 text-right text-amber-300 font-bold">-{formatINR(log.discountGiven, { keepDecimals: true })}</td>
                        <td className="py-3 text-right text-slate-200">{formatINR(log.finalAmount, { keepDecimals: true })}</td>
                        <td className="py-3 text-right">
                          <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-400 font-bold">
                            {log.invoiceNo}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-850/60 rounded-2xl p-5 shadow-lg">
            <h3 className="font-serif text-base font-bold text-slate-200">Simulated Expiry Notifications & Renewals</h3>
            <p className="text-xs text-slate-400 mt-1">
              Automated triggers near client card expiry dates. Send direct notifications via CRM or WhatsApp immediately.
            </p>

            <div className="mt-6 space-y-4">
              {cardsExpiringSoon.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  No memberships expiring within the next 30 calendar days. All active accounts secure.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Action Required ({cardsExpiringSoon.length} members):</p>
                  {cardsExpiringSoon.map((card) => {
                    const daysLeft = Math.ceil((new Date(card.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                    return (
                      <div key={card.id} className="bg-slate-950/40 border border-amber-500/10 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200">{formatMemberName(card.customerName)}</span>
                            <span className="font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[8px] uppercase">{card.cardType}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Card: <span className="font-mono text-slate-200 font-semibold">{card.cardNumber}</span> | Mobile: <span className="font-mono text-slate-200">{card.mobileNumber}</span></p>
                          <p className="text-[10px] text-red-400 font-bold mt-1">Expiring in {daysLeft} days ({card.expiryDate})</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            id={`btn-sms-whatsapp-${card.id}`}
                            onClick={() => handleSendWhatsAppNotice(card, 'expiry')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                          >
                            <Share2 className="w-3 h-3" />
                            WhatsApp Alert
                          </button>
                          <button
                            id={`btn-bday-whatsapp-${card.id}`}
                            onClick={() => handleSendWhatsAppNotice(card, 'birthday')}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                          >
                            <Gift className="w-3 h-3 text-pink-400" />
                            Birthday Offer
                          </button>
                          <button
                            id={`btn-renew-direct-${card.id}`}
                            disabled={card.status === 'blocked' || isUpdatingMembership}
                            onClick={() => handleRenewCard(card)}
                            className="gold-gradient text-slate-950 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={card.status === 'blocked' ? "Membership cannot be extended while the card is suspended or blocked." : "Renew 1 Year"}
                          >
                            <RefreshCw className={`w-3 h-3 ${isUpdatingMembership && renewCardTarget?.id === card.id ? 'animate-spin' : ''}`} />
                            {isUpdatingMembership && renewCardTarget?.id === card.id ? 'Updating...' : 'Renew 1 Year'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-850/60 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <div>
                <h3 className="font-serif text-base font-bold text-slate-200">Administrative Security Audit Trail</h3>
                <p className="text-xs text-slate-400 mt-1">Read-only system logging of card generation, parameter overrides, suspensions, and exports.</p>
              </div>
              <button
                id="btn-clear-logs"
                onClick={() => {
                  setIsConfirmWipeOpen(true);
                }}
                className="text-red-400 hover:text-red-300 font-mono text-[9px] uppercase tracking-wider bg-red-950/20 border border-red-500/10 px-2 py-1 rounded"
              >
                Clear Audit Trail
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="border-l-2 border-amber-500/40 pl-4 py-1.5 hover:bg-slate-950/20 transition">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-200 uppercase tracking-wide text-[11px]">{log.action}</span>
                    <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{log.details}</p>
                  <div className="flex gap-4 text-[9px] text-slate-500 mt-1.5">
                    <span>Operator: <span className="text-slate-400">{log.user}</span></span>
                    <span>Stamp: <span className="text-slate-400">{log.timestamp}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
      )}

      {/* CREATE CARD OVERLAY MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative">
            <button
              id="close-create-modal"
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <h2 className="font-serif text-xl font-bold text-amber-100">Issue Luxury Discount Card</h2>
              <p className="text-xs text-slate-400 mt-1">Provision a custom membership tier connected to customer records.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form column */}
              <form onSubmit={handleCreateCardSubmit} className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Card Number */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Card Number</label>
                    <div className="flex gap-1.5">
                      <input
                        id="form-card-number"
                        type="text"
                        required
                        value={cardForm.cardNumber}
                        onChange={(e) => setCardForm(prev => ({ ...prev, cardNumber: e.target.value.toUpperCase() }))}
                        placeholder="1503 2026 0000 0001"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none placeholder-slate-700"
                      />
                      <button
                        id="btn-gen-card-no"
                        type="button"
                        onClick={triggerCardNumberGeneration}
                        className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 text-[10px] px-2 rounded font-mono uppercase font-semibold"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  {/* Barcode Number */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Barcode Number</label>
                    <input
                      id="form-barcode-text"
                      type="text"
                      required
                      value={cardForm.barcodeText}
                      onChange={(e) => setCardForm(prev => ({ ...prev, barcodeText: e.target.value.toUpperCase() }))}
                      placeholder="SFSA 2026 2706 2008"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none placeholder-slate-700"
                    />
                  </div>

                  {/* Card Type Selection */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Card Type</label>
                    <select
                      id="form-card-type"
                      value={cardForm.cardType}
                      onChange={(e) => handleCardTypeChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      {membershipTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} Card
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Patron Name */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Patron Full Name</label>
                    <input
                      id="form-customer-name"
                      type="text"
                      required
                      value={cardForm.customerName}
                      onChange={(e) => setCardForm(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Jane Doe"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none placeholder-slate-700"
                    />
                  </div>

                  {/* Date of Birth */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Date of Birth (DD/MM/YYYY)</label>
                    <div className="relative premium-date-container group">
                      <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-amber-500/80 group-hover:text-amber-300 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                      <input
                        id="form-dob"
                        type="text"
                        required
                        value={cardForm.dob}
                        onChange={(e) => setCardForm(prev => ({ ...prev, dob: e.target.value }))}
                        placeholder="15/05/1975"
                        className="peer w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Mobile phone */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Mobile Phone</label>
                    <input
                      id="form-mobile-number"
                      type="text"
                      required
                      value={cardForm.mobileNumber}
                      onChange={(e) => setCardForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                      placeholder="+1-202-555-0199"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none placeholder-slate-700"
                    />
                  </div>

                  {/* Optional Email */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Email Address (Optional)</label>
                    <input
                      id="form-email"
                      type="email"
                      value={cardForm.email}
                      onChange={(e) => setCardForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="jane@milangalleria.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none placeholder-slate-700"
                    />
                  </div>

                  {/* Expiry date */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Expiry Date</label>
                    <div className="relative premium-date-container group">
                      <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
                      <input
                        id="form-expiry-date"
                        type="date"
                        required
                        value={cardForm.expiryDate}
                        onChange={(e) => setCardForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                        className="peer w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    id="btn-cancel-create"
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 bg-slate-950 border border-slate-850 text-slate-400 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-create"
                    type="submit"
                    className="flex-1 gold-gradient text-slate-950 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition shadow-lg hover:opacity-90"
                  >
                    Issue Member Card
                  </button>
                </div>
              </form>

              {/* Dynamic Live Card Preview column */}
              <div className="lg:col-span-5 flex flex-col justify-center items-center bg-slate-950/40 p-6 rounded-2xl border border-slate-850">
                <div className="flex justify-between items-center w-full mb-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Dynamic Live Visual Card Preview</p>
                  <button
                    type="button"
                    onClick={() => setPreviewFlipped(p => !p)}
                    className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-850 px-2 py-1 rounded text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Flip Preview
                  </button>
                </div>
                
                {/* Dynamically Styled Live Card */}
                {(() => {
                  let previewGradient = 'from-slate-700 via-slate-800 to-slate-950 text-slate-300 border-slate-700';
                  let previewTag = 'bg-slate-950 border border-slate-800 text-slate-400';
                  if (cardForm.cardType === 'gold') {
                    previewGradient = 'from-amber-600 via-amber-800 to-slate-950 text-amber-200 border-amber-600/30';
                    previewTag = 'bg-amber-950/40 border border-amber-500/20 text-amber-400';
                  } else if (cardForm.cardType === 'platinum' || cardForm.cardType === 'vip') {
                    previewGradient = 'from-[#121212] via-[#090909] to-[#1e1e1e] text-[#d4af37] border-[#c5a880]/35';
                    previewTag = 'border border-[#d4af37]/40 text-[#d4af37] bg-black/60';
                  } else if (cardForm.cardType === 'custom') {
                    previewGradient = 'from-fuchsia-700 via-fuchsia-900 to-slate-950 text-fuchsia-200 border-fuchsia-600/30';
                    previewTag = 'bg-fuchsia-950/40 border border-fuchsia-500/20 text-fuchsia-400';
                  }

                  return (
                    <div 
                      className="relative w-full aspect-[1.58/1] select-none"
                      style={{ perspective: '1000px' }}
                    >
                      <div 
                        className="w-full h-full relative"
                        style={{
                          transition: 'transform 0.6s',
                          transformStyle: 'preserve-3d',
                          transform: previewFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        }}
                      >
                        {/* FRONT SIDE */}
                        <div 
                          className="absolute inset-0 w-full h-full rounded-xl overflow-hidden shadow-2xl"
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                          }}
                        >
                          <PlatinumCardFront
                            cardNumber={cardForm.cardNumber || '8902 4512 8890 2026'}
                            customerName={cardForm.customerName || 'Loyal Club Member'}
                            expiryDate={cardForm.expiryDate || 'YYYY-MM-DD'}
                            cardType={cardForm.cardType}
                          />
                        </div>

                        {/* BACK SIDE */}
                        <div 
                          className="absolute inset-0 w-full h-full rounded-xl overflow-hidden shadow-2xl"
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                          }}
                        >
                          <PlatinumCardBack 
                            barcodeText={cardForm.barcodeText || 'SFXX 2026 1505 1975'} 
                            customerName={cardForm.customerName || 'Loyal Club Member'}
                            dob={cardForm.dob || '15/05/1975'}
                            cardType={cardForm.cardType}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-4 text-center space-y-1">
                  <p className="text-[10px] text-amber-500/70 font-semibold uppercase tracking-wider">Concierge Printing Auto-Spooling</p>
                  <p className="text-[9px] text-slate-400">Generates instant unique PDF / thermal cards for card laminating.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CARD OVERLAY MODAL */}
      {isEditOpen && selectedCard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative">
            <button
              id="close-edit-modal"
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <h2 className="font-serif text-xl font-bold text-amber-100">Edit Member Card: {selectedCard.cardNumber}</h2>
              <p className="text-xs text-slate-400 mt-1">Modify customer contact registry fields or discount percentage override.</p>
            </div>

            <form onSubmit={handleEditCardSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Card Number */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Card Number</label>
                  <input
                    id="edit-card-number"
                    type="text"
                    required
                    value={cardForm.cardNumber}
                    onChange={(e) => setCardForm(prev => ({ ...prev, cardNumber: e.target.value.toUpperCase() }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none"
                  />
                </div>

                {/* Barcode Number */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Barcode Number</label>
                  <input
                    id="edit-barcode-text"
                    type="text"
                    required
                    value={cardForm.barcodeText}
                    onChange={(e) => setCardForm(prev => ({ ...prev, barcodeText: e.target.value.toUpperCase() }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none"
                  />
                </div>

                {/* Patron Name */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Patron Name</label>
                  <input
                    id="edit-customer-name"
                    type="text"
                    required
                    value={cardForm.customerName}
                    onChange={(e) => setCardForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Date of Birth */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Date of Birth (DD/MM/YYYY)</label>
                  <input
                    id="edit-dob"
                    type="text"
                    required
                    value={cardForm.dob}
                    onChange={(e) => setCardForm(prev => ({ ...prev, dob: e.target.value }))}
                    placeholder="15/05/1975"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                </div>

                {/* Mobile Phone */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Mobile Phone</label>
                  <input
                    id="edit-mobile-number"
                    type="text"
                    required
                    value={cardForm.mobileNumber}
                    onChange={(e) => setCardForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                </div>

                {/* Optional Email */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Email Address (Optional)</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={cardForm.email}
                    onChange={(e) => setCardForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Status Selection */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Card Status</label>
                  <select
                    id="edit-card-status"
                    value={cardForm.status}
                    onChange={(e) => setCardForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="active">Active circulation</option>
                    <option value="blocked">Blocked / Suspended</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                {/* Card Type Selection */}
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Card Type</label>
                  <select
                    id="edit-card-type"
                    value={cardForm.cardType}
                    onChange={(e) => handleCardTypeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    {membershipTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} Card
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  id="btn-cancel-edit"
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 bg-slate-950 border border-slate-850 text-slate-400 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit"
                  type="submit"
                  className="flex-1 gold-gradient text-slate-950 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition shadow-lg hover:opacity-90"
                >
                  Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECURITY PIN OVERRIDE MODAL */}
      {isSecurityPinOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="font-serif text-base font-bold text-slate-100">Manager Security Override Needed</h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
              Custom discount rates exceeding 25% require active showroom executive PIN validation.
            </p>

            <form onSubmit={handleSecurityPinSubmit} className="mt-4 space-y-3">
              <input
                id="override-pin-input"
                type="password"
                required
                maxLength={4}
                value={securityPinInput}
                onChange={(e) => setSecurityPinInput(e.target.value)}
                placeholder="ENTER 4-DIGIT OVERRIDE PIN"
                className="w-full text-center tracking-widest bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-amber-200 font-mono focus:outline-none focus:border-red-500/50"
              />
              {securityPinError && (
                <p className="text-[10px] text-red-400 font-medium leading-none">{securityPinError}</p>
              )}
              <p className="text-[9px] text-slate-500">Hint: Enter the default PIN code <span className="font-bold text-amber-500">2026</span> to bypass.</p>

              <div className="flex gap-2 pt-2">
                <button
                  id="btn-cancel-pin"
                  type="button"
                  onClick={() => setIsSecurityPinOpen(false)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-400 py-2 rounded text-xs uppercase font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-verify-pin"
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded text-xs uppercase font-bold transition"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT DIALOG DIALOG OVERLAY */}
      {isPrintOpen && selectedCard && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <style>{`
            @media screen {
              .print-only {
                display: none !important;
              }
              .no-scrollbar::-webkit-scrollbar {
                display: none !important;
              }
              .no-scrollbar {
                -ms-overflow-style: none !important;
                scrollbar-width: none !important;
              }
            }
            @media print {
              .print-hide {
                display: none !important;
              }
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
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .print-stack {
                display: flex !important;
                flex-direction: column !important;
                gap: 20px !important;
              }
            }
          `}</style>

          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-lg h-[90vh] max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-fade-in">
            {isPrinting && (
              <div 
                className={`absolute inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 transition-all duration-300 ${isFadeOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                {/* Premium Gold rotating loader */}
                <div className="relative w-16 h-16 mb-6">
                  {/* Outer glowing ambient ring */}
                  <div className="absolute inset-0 rounded-full border border-amber-500/10 scale-110 animate-pulse"></div>
                  {/* Subtle inner tracks */}
                  <div className="absolute inset-0 rounded-full border-2 border-slate-850"></div>
                  {/* Rotating gold indicator */}
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-t-amber-400 border-r-amber-500/40 border-b-transparent border-l-transparent animate-spin"
                    style={{
                      animationDuration: '0.8s',
                      animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  ></div>
                  <div className="absolute inset-3 rounded-full border border-amber-500/20 bg-slate-950/50 flex items-center justify-center">
                    <span className="font-mono text-[10px] text-amber-400 font-bold">{printProgress}%</span>
                  </div>
                </div>

                {/* Animated Card Preview */}
                <div 
                  className="w-72 aspect-[1.58/1] mb-6 rounded-xl overflow-hidden shadow-2xl border border-amber-500/30 bg-slate-950 flex flex-col justify-between"
                  style={{
                    transform: `scale(${0.98 + (printProgress / 100) * 0.02})`,
                    filter: `blur(${4 * (1 - printProgress / 100)}px)`,
                    opacity: 0.1 + (printProgress / 100) * 0.9,
                    transition: 'transform 100ms ease-in-out, filter 100ms ease-in-out, opacity 100ms ease-in-out'
                  }}
                >
                  <PlatinumCardFront
                    cardNumber={selectedCard.cardNumber}
                    customerName={selectedCard.customerName}
                    expiryDate={selectedCard.expiryDate}
                    cardType={selectedCard.cardType}
                  />
                </div>

                {/* Current Stage Title */}
                <h4 className="font-serif text-sm font-bold text-amber-100 uppercase tracking-widest text-center h-5">
                  {printProgress <= 20 && "Preparing Membership Card..."}
                  {printProgress > 20 && printProgress <= 45 && "Rendering Front Side..."}
                  {printProgress > 45 && printProgress <= 70 && "Rendering Back Side..."}
                  {printProgress > 70 && printProgress <= 90 && "Generating Print Layout..."}
                  {printProgress > 90 && "Opening Print Preview..."}
                </h4>

                <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-wide">
                  High-fidelity Spool Engine
                </p>

                {/* Animated progress bar container */}
                <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
                  <div 
                    className="h-full gold-gradient rounded-full transition-all duration-75"
                    style={{ width: `${printProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Sticky Header */}
            <div className="p-5 border-b border-slate-850 bg-slate-900 flex-none flex justify-between items-center relative z-10">
              <div>
                <h3 className="font-serif text-base font-bold text-amber-100 flex items-center gap-2">
                  <span>🖨</span> Membership Card Printer Driver
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Generate high-fidelity, printable PDF card laminates or optical QR badges.</p>
              </div>
              <button
                id="close-print-modal"
                onClick={() => !isPrinting && setIsPrintOpen(false)}
                disabled={isPrinting}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-400 hover:text-amber-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Preview Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-slate-950/60 scroll-smooth no-scrollbar flex flex-col items-center justify-start gap-4">
              {/* White Print Sheet */}
              <div className="w-full max-w-[420px] bg-white text-slate-950 rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">Print Sheet - Standard Layout</span>
                  <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Dual Side Spool</span>
                </div>

                {/* Printable Stack */}
                <div className="space-y-6 print-stack" id="printable-area">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold print-hide">Front Card</span>
                    <div id="card-front-printable" className="aspect-[1.58/1] w-full relative rounded-xl overflow-hidden shadow-lg border border-slate-100">
                      <PlatinumCardFront
                        cardNumber={selectedCard.cardNumber}
                        customerName={selectedCard.customerName}
                        expiryDate={selectedCard.expiryDate}
                        cardType={selectedCard.cardType}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold print-hide">Back Card</span>
                    <div id="card-back-printable" className="aspect-[1.58/1] w-full relative rounded-xl overflow-hidden shadow-lg border border-slate-100">
                      <PlatinumCardBack 
                        barcodeText={selectedCard.barcodeText} 
                        customerName={selectedCard.customerName}
                        dob={selectedCard.dob}
                        cardType={selectedCard.cardType}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="p-5 border-t border-slate-850 bg-slate-900 flex-none flex gap-3 relative z-10">
              <button
                id="btn-cancel-print-modal"
                onClick={() => !isPrinting && setIsPrintOpen(false)}
                disabled={isPrinting}
                className="flex-1 bg-slate-950 border border-slate-800 text-slate-400 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition disabled:opacity-40 disabled:cursor-not-allowed hover:text-amber-400 hover:border-amber-500/30"
              >
                Close
              </button>
              <button
                id="btn-trigger-print-laminate"
                onClick={executeCardPrint}
                disabled={isPrinting}
                className="flex-1 gold-gradient text-slate-950 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                {isPrinting ? 'Generating...' : 'Print Laminate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {cardToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-center text-slate-100">Delete Record</h3>
            <p className="text-xs text-center text-slate-400 mt-2 leading-relaxed">
              This action cannot be undone.
              <br />
              Are you sure you want to permanently delete this record?
              {cardToDelete.customerName && (
                <span className="block mt-2 font-mono text-[10px] text-red-400 bg-slate-950 px-2 py-1 rounded">
                  Target: {cardToDelete.customerName} ({cardToDelete.cardNumber})
                </span>
              )}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                id="btn-cancel-delete"
                onClick={() => setCardToDelete(null)}
                className="flex-1 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-300 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                onClick={() => {
                  deleteDiscountCard(cardToDelete.id);
                  const num = cardToDelete.cardNumber;
                  const name = cardToDelete.customerName;
                  setCardToDelete(null);
                  setIsViewOpen(false);
                  showToast(`Card ${num} Deleted from registry`, 'error');
                  writeAuditLog('Card Deleted', `Removed Card ${num} issued to ${name}.`);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR LOGS CONFIRMATION MODAL */}
      {isConfirmWipeOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-center text-slate-100">Wipe Local Security Logs?</h3>
            <p className="text-xs text-center text-slate-400 mt-2 leading-relaxed">
              Are you absolutely sure you want to clear the administrative security audit trail?
              <br /> This action itself will be logged to initiate a fresh audit cycle.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                id="btn-cancel-wipe"
                onClick={() => setIsConfirmWipeOpen(false)}
                className="flex-1 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-300 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-wipe"
                onClick={() => {
                  const fresh = [{ id: 'aud_init', timestamp: new Date().toISOString(), action: 'Log Purge Requested', details: 'Operator wiped local audit logs.', user: 'Showroom Admin' }];
                  setAuditLogs(fresh);
                  setIsConfirmWipeOpen(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition"
              >
                Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENEW/EXTEND CONFIRMATION MODAL */}
      {renewCardTarget && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <RefreshCw className={`w-6 h-6 ${isUpdatingMembership ? 'animate-spin' : ''}`} />
            </div>
            <h3 className="font-serif text-lg font-bold text-center text-slate-100 text-amber-100 uppercase tracking-wide">Extend Membership Validity</h3>
            <p className="text-xs text-center text-slate-400 mt-2 leading-relaxed">
              {new Date(renewCardTarget.expiryDate).getTime() < Date.now()
                ? "This membership has expired. Do you still want to renew it for one year?"
                : "Are you sure you want to extend this membership by 1 year?"}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                id="btn-cancel-renew"
                disabled={isUpdatingMembership}
                onClick={() => setRenewCardTarget(null)}
                className="flex-1 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-300 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-renew"
                disabled={isUpdatingMembership}
                onClick={executeRenewCard}
                className="flex-1 gold-gradient text-slate-950 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                {isUpdatingMembership ? 'Updating Membership...' : 'Extend Membership'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Customer Warning Modal */}
      <DuplicateCustomerModal
        isOpen={cardDuplicateModal.isOpen}
        existingCustomer={cardDuplicateModal.existingCustomer}
        onOpenExisting={handleOpenExistingCardCustomer}
        onCancel={() => setCardDuplicateModal({ isOpen: false, existingCustomer: null })}
        moduleContext="Discount Cards & Membership Registration"
      />
    </div>
  );
};
