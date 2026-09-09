/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DateFilter {
  preset: string;
  fromDate: string;
  toDate: string;
  startTime?: string;
  endTime?: string;
}

export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last-7', label: 'Last 7 Days' },
  { id: 'this-week', label: 'This Week' },
  { id: 'last-week', label: 'Last Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-30', label: 'Last 30 Days' },
  { id: 'this-quarter', label: 'This Quarter' },
  { id: 'this-year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

export function getLocalYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculatePresetDates(preset: string): { fromDate: string; toDate: string } {
  const today = new Date();
  const toStr = getLocalYYYYMMDD(today);
  let fromStr = toStr;

  switch (preset) {
    case 'today':
      fromStr = toStr;
      break;
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesStr = getLocalYYYYMMDD(yesterday);
      return { fromDate: yesStr, toDate: yesStr };
    }
    case 'last-7': {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      fromStr = getLocalYYYYMMDD(past);
      break;
    }
    case 'this-week': {
      // Monday to Sunday (or Sunday to Saturday)
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      fromStr = getLocalYYYYMMDD(monday);
      break;
    }
    case 'last-week': {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const prevMonday = new Date(today);
      prevMonday.setDate(diff);
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);
      return {
        fromDate: getLocalYYYYMMDD(prevMonday),
        toDate: getLocalYYYYMMDD(prevSunday)
      };
    }
    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      fromStr = getLocalYYYYMMDD(start);
      break;
    }
    case 'last-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        fromDate: getLocalYYYYMMDD(start),
        toDate: getLocalYYYYMMDD(end)
      };
    }
    case 'last-30': {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      fromStr = getLocalYYYYMMDD(past);
      break;
    }
    case 'this-quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), quarter * 3, 1);
      fromStr = getLocalYYYYMMDD(start);
      break;
    }
    case 'this-year': {
      const start = new Date(today.getFullYear(), 0, 1);
      fromStr = getLocalYYYYMMDD(start);
      break;
    }
    default:
      fromStr = toStr;
      break;
  }

  return { fromDate: fromStr, toDate: toStr };
}

export function isWithinDateTimeRange(
  itemDateStr: string | undefined | null,
  fromDate: string, // YYYY-MM-DD
  toDate: string,   // YYYY-MM-DD
  startTime?: string, // HH:MM
  endTime?: string    // HH:MM
): boolean {
  if (!itemDateStr) return false;

  // If itemDateStr matches standard YYYY-MM-DD (like discount card issueDate)
  if (/^\d{4}-\d{2}-\d{2}$/.test(itemDateStr)) {
    return itemDateStr >= fromDate && itemDateStr <= toDate;
  }

  const d = new Date(itemDateStr);
  if (isNaN(d.getTime())) return false;

  const itemDateYYYYMMDD = getLocalYYYYMMDD(d);
  if (itemDateYYYYMMDD < fromDate || itemDateYYYYMMDD > toDate) {
    return false;
  }

  // If time filtering is active, check the time part of the itemDateStr
  if (startTime || endTime) {
    const itemHours = d.getHours();
    const itemMinutes = d.getMinutes();
    const itemTimeVal = itemHours * 60 + itemMinutes;

    if (startTime && startTime.trim() !== '') {
      const [sh, sm] = startTime.split(':').map(Number);
      const startVal = sh * 60 + sm;
      if (itemTimeVal < startVal) return false;
    }
    if (endTime && endTime.trim() !== '') {
      const [eh, em] = endTime.split(':').map(Number);
      const endVal = eh * 60 + em;
      if (itemTimeVal > endVal) return false;
    }
  }

  return true;
}

export function formatNiceDateRange(fromDate: string, toDate: string): string {
  const f = new Date(fromDate);
  const t = new Date(toDate);
  
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  
  if (fromDate === toDate) {
    return isNaN(f.getTime()) ? fromDate : f.toLocaleDateString('en-IN', options);
  }
  
  const fStr = isNaN(f.getTime()) ? fromDate : f.toLocaleDateString('en-IN', options);
  const tStr = isNaN(t.getTime()) ? toDate : t.toLocaleDateString('en-IN', options);
  return `${fStr} → ${tStr}`;
}
