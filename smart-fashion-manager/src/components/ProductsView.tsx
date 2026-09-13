/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppState } from '../context/StateContext';
import { useDebounce } from '../hooks/useDebounce';
import { safeLocalStorage } from '../utils/safeStorage';
import { PermissionButton } from './common/PermissionGuard';

const localStorage = safeLocalStorage;
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Barcode,
  FolderMinus,
  CheckCircle,
  AlertCircle,
  X,
  History,
  Printer,
  ArrowLeft,
  Eye,
  Minus,
  Layers,
  Save,
  Grid,
  Maximize2,
  Sliders,
  FileCode,
  Shirt,
  Tag,
  Palette,
  Gift,
  Ruler,
  Scissors,
} from 'lucide-react';
import { Product } from '../types';
import { formatINR } from '../utils/currency';
import { buildCompleteBarcodePrintPageHtml, extractPrintableBarcodeHtml } from '../utils/printBarcodeHtml';
import { printInCurrentDocument, triggerWindowPrint } from '../utils/printWindowHelper';
import { CategoriesMasterView } from './masters/CategoriesMasterView';
import { BrandsMasterView } from './masters/BrandsMasterView';
import { SizesMasterView } from './masters/SizesMasterView';
import { ColorsMasterView } from './masters/ColorsMasterView';
import { GiftsMasterView } from './GiftsMasterView';
import { FabricsDirectoryView } from './FabricsDirectoryView';

export const ProductsView: React.FC = () => {
  const {
    products,
    fabrics = [],
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    inventoryHistory,
    settings,
    categoriesList,
    brandsList,
    sizesList,
    colorsList,
    gifts = [],
    addCategory,
    addBrand,
    addSize,
    addColor,
  } = useAppState();

  const activeCategories = useMemo(() => categoriesList.filter((c) => c.status === 'active'), [categoriesList]);
  const activeBrands = useMemo(() => brandsList.filter((b) => b.status === 'active'), [brandsList]);
  const activeSizes = useMemo(() => sizesList.filter((s) => s.status === 'active'), [sizesList]);
  const activeColors = useMemo(() => colorsList.filter((col) => col.status === 'active'), [colorsList]);

  const storeName = settings?.storeProfile?.name || 'SMART FASHION';

  const [activeSubTab, setActiveSubTab] = useState<'products' | 'fabrics' | 'categories' | 'brands' | 'sizes' | 'colors' | 'gifts'>(() => {
    const rawHash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const parts = rawHash.split('/');
    if (parts[0] === 'products' && parts[1]) {
      const validTabs = ['products', 'fabrics', 'categories', 'brands', 'sizes', 'colors', 'gifts'];
      if (validTabs.includes(parts[1])) {
        return parts[1] as any;
      }
    }
    const saved = localStorage.getItem('sf_products_active_tab');
    if (saved && ['products', 'fabrics', 'categories', 'brands', 'sizes', 'colors', 'gifts'].includes(saved)) {
      return saved as any;
    }
    return 'products';
  });

  useEffect(() => {
    localStorage.setItem('sf_products_active_tab', activeSubTab);
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#products')) {
      window.location.hash = `products/${activeSubTab}`;
    }
  }, [activeSubTab]);

  useEffect(() => {
    const handleHash = () => {
      const rawHash = window.location.hash.slice(1);
      const parts = rawHash.split('/');
      if (parts[0] === 'products' && parts[1]) {
        const validTabs = ['products', 'fabrics', 'categories', 'brands', 'sizes', 'colors', 'gifts'];
        if (validTabs.includes(parts[1]) && parts[1] !== activeSubTab) {
          setActiveSubTab(parts[1] as any);
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [activeSubTab]);
  const [miniModalType, setMiniModalType] = useState<'category' | 'brand' | 'size' | 'color' | null>(null);
  const [miniModalValue, setMiniModalValue] = useState('');

  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem('sf_global_search_term');
    if (saved) {
      localStorage.removeItem('sf_global_search_term');
      return saved;
    }
    return '';
  });
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('All'); // All, Low, Out

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [currentStock, setCurrentStock] = useState(10);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Stock Adjust Modal states
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustType, setAdjustType] = useState<'stock-in' | 'stock-out' | 'adjustment' | 'damaged'>('stock-in');
  const [adjustReason, setAdjustReason] = useState('');

  // Barcode Printer Modal
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recordId: string | null; recordName?: string }>({ isOpen: false, recordId: null });
  const handleConfirmDelete = () => {
    if (deleteConfirm.recordId) {
      try {
        deleteProduct(deleteConfirm.recordId);
        showToast('Record deleted successfully.', 'success');
      } catch (err) {
        showToast('Failed to delete record.', 'error');
      }
    }
    setDeleteConfirm({ isOpen: false, recordId: null });
  };
  const [printQty, setPrintQty] = useState(1);
  const [paperSize, setPaperSize] = useState('50x25');
  const [customWidth, setCustomWidth] = useState(50);
  const [customHeight, setCustomHeight] = useState(25);

  // Enterprise Barcode Printing State Variables
  const [barcodeType, setBarcodeType] = useState<'code128' | 'code39' | 'ean13'>('code128');
  
  // Label Content Options:
  const [showBrand, setShowBrand] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showBarcodeNumber, setShowBarcodeNumber] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSize, setShowSize] = useState(true);
  const [showColor, setShowColor] = useState(true);

  // Barcode Appearance:
  const [barcodeWidthScale, setBarcodeWidthScale] = useState(1.5);
  const [barcodeHeight, setBarcodeHeight] = useState(32);
  const [labelFontSize, setLabelFontSize] = useState(8);
  const [labelPadding, setLabelPadding] = useState(2);
  const [barcodeTextPosition, setBarcodeTextPosition] = useState<'below' | 'above' | 'hidden'>('below');

  // Batch Printing:
  const [printBatchType] = useState<'current' | 'selected'>('current');

  // Sheet Layout:
  const [sheetPaperSize, setSheetPaperSize] = useState<'Roll' | 'A4' | 'Letter'>('Roll');
  const [sheetColumns, setSheetColumns] = useState(1);
  const [sheetRows, setSheetRows] = useState(1);
  const [sheetHorizGap, setSheetHorizGap] = useState(2);
  const [sheetVertGap, setSheetVertGap] = useState(2);
  const [sheetTopMargin, setSheetTopMargin] = useState(5);
  const [sheetLeftMargin, setSheetLeftMargin] = useState(5);

  // Margin Control for precise label positioning:
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);

  // Printer Type:
  const [printerType, setPrinterType] = useState<'thermal' | 'laser' | 'inkjet'>('thermal');

  // Inkjet A4 Page Margin Control States:
  const [inkjetOrientation, setInkjetOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [inkjetPaperSize, setInkjetPaperSize] = useState<'A4' | 'A5' | 'Letter' | 'Legal'>('A4');
  const [inkjetMarginTop, setInkjetMarginTop] = useState<number>(10);
  const [inkjetMarginBottom, setInkjetMarginBottom] = useState<number>(10);
  const [inkjetMarginLeft, setInkjetMarginLeft] = useState<number>(10);
  const [inkjetMarginRight, setInkjetMarginRight] = useState<number>(10);
  const [inkjetOffsetX, setInkjetOffsetX] = useState<number>(0);
  const [inkjetOffsetY, setInkjetOffsetY] = useState<number>(0);
  const [inkjetScaling, setInkjetScaling] = useState<'100%' | 'Fit to Page' | 'Actual Size' | 'Custom %'>('100%');
  const [inkjetCustomScaling, setInkjetCustomScaling] = useState<number>(100);

  // Custom interactive designer states:
  const [designerSearchTerm, setDesignerSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Selected Products Multi-Select State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Reusable label templates
  interface LabelTemplate {
    id: string;
    name: string;
    paperSize: string;
    customWidth: number;
    customHeight: number;
    barcodeType: 'code128' | 'code39' | 'ean13';
    showBrand: boolean;
    showProductName: boolean;
    showSku: boolean;
    showBarcodeNumber: boolean;
    showPrice: boolean;
    showMrp: boolean;
    showSize: boolean;
    showColor: boolean;
    barcodeWidthScale: number;
    barcodeHeight: number;
    labelFontSize: number;
    labelPadding: number;
    barcodeTextPosition: 'below' | 'above' | 'hidden';
    sheetPaperSize: 'Roll' | 'A4' | 'Letter';
    sheetColumns: number;
    sheetRows: number;
    sheetHorizGap: number;
    sheetVertGap: number;
    sheetTopMargin: number;
    sheetLeftMargin: number;
    printerType: 'thermal' | 'laser' | 'inkjet';
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
  }

  // Prepopulated Default Enterprise Templates
  const DEFAULT_TEMPLATES: LabelTemplate[] = [
    {
      id: 'template-thermal-classic',
      name: 'Showroom Classical (50x25 mm)',
      paperSize: '50x25',
      customWidth: 50,
      customHeight: 25,
      barcodeType: 'code128',
      showBrand: true,
      showProductName: true,
      showSku: true,
      showBarcodeNumber: true,
      showPrice: true,
      showMrp: true,
      showSize: true,
      showColor: true,
      barcodeWidthScale: 1.5,
      barcodeHeight: 32,
      labelFontSize: 8,
      labelPadding: 2,
      barcodeTextPosition: 'below',
      sheetPaperSize: 'Roll',
      sheetColumns: 1,
      sheetRows: 1,
      sheetHorizGap: 0,
      sheetVertGap: 0,
      sheetTopMargin: 0,
      sheetLeftMargin: 0,
      printerType: 'thermal'
    },
    {
      id: 'template-jewelry',
      name: 'Micro Tag (20x10 mm)',
      paperSize: '20x10',
      customWidth: 20,
      customHeight: 10,
      barcodeType: 'code128',
      showBrand: false,
      showProductName: true,
      showSku: true,
      showBarcodeNumber: false,
      showPrice: true,
      showMrp: false,
      showSize: false,
      showColor: false,
      barcodeWidthScale: 1.0,
      barcodeHeight: 18,
      labelFontSize: 6,
      labelPadding: 1,
      barcodeTextPosition: 'hidden',
      sheetPaperSize: 'Roll',
      sheetColumns: 1,
      sheetRows: 1,
      sheetHorizGap: 0,
      sheetVertGap: 0,
      sheetTopMargin: 0,
      sheetLeftMargin: 0,
      printerType: 'thermal'
    },
    {
      id: 'template-luxury-tag',
      name: 'Large Boutique Tag (60x30 mm)',
      paperSize: '60x30',
      customWidth: 60,
      customHeight: 30,
      barcodeType: 'code128',
      showBrand: true,
      showProductName: true,
      showSku: true,
      showBarcodeNumber: true,
      showPrice: true,
      showMrp: true,
      showSize: true,
      showColor: true,
      barcodeWidthScale: 1.8,
      barcodeHeight: 38,
      labelFontSize: 9,
      labelPadding: 3,
      barcodeTextPosition: 'below',
      sheetPaperSize: 'Roll',
      sheetColumns: 1,
      sheetRows: 1,
      sheetHorizGap: 0,
      sheetVertGap: 0,
      sheetTopMargin: 0,
      sheetLeftMargin: 0,
      printerType: 'thermal'
    },
    {
      id: 'template-a4-sheet',
      name: 'Laser Grid A4 (3 Columns x 10 Rows)',
      paperSize: '50x25',
      customWidth: 50,
      customHeight: 25,
      barcodeType: 'code128',
      showBrand: true,
      showProductName: true,
      showSku: true,
      showBarcodeNumber: true,
      showPrice: true,
      showMrp: true,
      showSize: true,
      showColor: true,
      barcodeWidthScale: 1.5,
      barcodeHeight: 32,
      labelFontSize: 8,
      labelPadding: 2,
      barcodeTextPosition: 'below',
      sheetPaperSize: 'A4',
      sheetColumns: 3,
      sheetRows: 10,
      sheetHorizGap: 2,
      sheetVertGap: 2,
      sheetTopMargin: 10,
      sheetLeftMargin: 10,
      printerType: 'laser'
    }
  ];

  const [labelTemplates, setLabelTemplates] = useState<LabelTemplate[]>(() => {
    const saved = localStorage.getItem('sf_label_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return DEFAULT_TEMPLATES;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);

  // Barcode Type Encoders
  const EAN13_A = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const EAN13_B = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const EAN13_C = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
  const EAN13_PARITY = ['AAAAAA', 'AABABB', 'AABBAB', 'AABBBA', 'ABAABB', 'ABBAAB', 'ABBBAA', 'ABABAB', 'ABABBA', 'ABBABA'];

  const CODE128_PATTERNS: Record<string, string> = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '10011100110', '2': '11001110100', '3': '11001110010',
    '4': '11001011100', '5': '11001001110', '6': '11001100110', '7': '11001101110',
    '8': '11001110010', '9': '11001110110', ':': '11101101100', ';': '11101100110',
    '<': '11100101100', '=': '11100100110', '>': '11100111010', '?': '11100111011',
    '@': '11101110100', 'A': '11101110010', 'B': '11100111010', 'C': '11100111011',
    'D': '11011011100', 'E': '11011001110', 'F': '11011100110', 'G': '11011101100',
    'H': '11011100110', 'I': '11011101110', 'J': '11101101110', 'K': '11101100110',
    'L': '11100110110', 'M': '11100110011', 'N': '11100111011', 'O': '11001110110',
    'P': '11001110111', 'Q': '11110110110', 'R': '11011110110', 'S': '11011110111',
    'T': '11101111010', 'U': '11101111011', 'V': '11110110110', 'W': '11110110111',
    'X': '11110111010', 'Y': '11110111011', 'Z': '11110111101', '[': '11111011101',
    '\\': '11111011110', ']': '11111011111', '^': '11111101111', '_': '11111101111'
  };

  const CODE39_PATTERNS: Record<string, string> = {
    '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
    '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
    '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
    'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
    'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
    'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
    'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
    'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
    'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
    '-': '100101011011', '.': '110010101101', ' ': '100110101101', '$': '100100100101',
    '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101'
  };

  const generateEAN13Bars = (sku: string) => {
    const digitsOnly = sku.replace(/\D/g, '');
    let code = digitsOnly.slice(0, 12);
    if (code.length < 12) {
      code = code.padEnd(12, '0');
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const fullCode = code + checkDigit;

    const parityStr = EAN13_PARITY[parseInt(fullCode[0], 10)] || 'AAAAAA';
    
    let binary = '101';
    for (let i = 1; i <= 6; i++) {
      const digit = parseInt(fullCode[i], 10);
      const isA = parityStr[i - 1] === 'A';
      binary += isA ? EAN13_A[digit] : EAN13_B[digit];
    }
    binary += '01010';
    for (let i = 7; i <= 12; i++) {
      const digit = parseInt(fullCode[i], 10);
      binary += EAN13_C[digit];
    }
    binary += '101';

    return { binary, displayValue: fullCode };
  };

  const generateCode39Bars = (sku: string) => {
    const cleanSku = sku.toUpperCase().replace(/[^0-9A-Z\-.\s$/+%]/g, '');
    const fullString = `*${cleanSku}*`;
    let binary = '';
    for (let i = 0; i < fullString.length; i++) {
      const char = fullString[i];
      const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS[' '];
      binary += pattern + '0';
    }
    return { binary, displayValue: fullString };
  };

  const generateCode128Bars = (sku: string) => {
    const CODE128_ORDER = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_';
    const cleanSku = sku.slice(0, 30);
    let sum = 104;
    for (let i = 0; i < cleanSku.length; i++) {
      const char = cleanSku[i];
      const codeIndex = CODE128_ORDER.indexOf(char);
      const val = codeIndex >= 0 ? codeIndex : 0;
      sum += val * (i + 1);
    }
    const checkIndex = sum % 103;
    
    let binary = '11010010000';
    for (let i = 0; i < cleanSku.length; i++) {
      const char = cleanSku[i];
      const pattern = CODE128_PATTERNS[char] || CODE128_PATTERNS[' '];
      binary += pattern;
    }
    
    const checkChar = CODE128_ORDER[checkIndex] || ' ';
    binary += CODE128_PATTERNS[checkChar] || CODE128_PATTERNS[' '];
    
    binary += '1100011101011';
    
    return { binary, displayValue: cleanSku };
  };

  const getBarcodeDetails = (sku: string) => {
    const cleanSku = sku ? sku.trim() : '000000000000';
    if (barcodeType === 'ean13') {
      return generateEAN13Bars(cleanSku);
    } else if (barcodeType === 'code39') {
      return generateCode39Bars(cleanSku);
    } else {
      return generateCode128Bars(cleanSku);
    }
  };

  const renderBarcodeSVG = (sku: string) => {
    const { binary } = getBarcodeDetails(sku);
    const scale = barcodeWidthScale;
    const height = barcodeHeight;
    const barWidth = 1.2 * scale;
    const svgWidth = binary.length * barWidth;
    
    return (
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${svgWidth} ${height}`} 
        preserveAspectRatio="none"
        className="mx-auto block"
      >
        {binary.split('').map((bit, idx) => {
          if (bit === '1') {
            return (
              <rect
                key={idx}
                x={idx * barWidth}
                y={0}
                width={barWidth}
                height={height}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>
    );
  };

  const saveLabelTemplate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newTemplate: LabelTemplate = {
      id: 'template-' + Date.now(),
      name: trimmed,
      paperSize,
      customWidth,
      customHeight,
      barcodeType,
      showBrand,
      showProductName,
      showSku,
      showBarcodeNumber,
      showPrice,
      showMrp,
      showSize,
      showColor,
      barcodeWidthScale,
      barcodeHeight,
      labelFontSize,
      labelPadding,
      barcodeTextPosition,
      sheetPaperSize,
      sheetColumns,
      sheetRows,
      sheetHorizGap,
      sheetVertGap,
      sheetTopMargin,
      sheetLeftMargin,
      printerType,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
    };
    const updated = [...labelTemplates, newTemplate];
    setLabelTemplates(updated);
    localStorage.setItem('sf_label_templates', JSON.stringify(updated));
    setSelectedTemplateId(newTemplate.id);
  };

  const loadLabelTemplate = (id: string) => {
    const found = labelTemplates.find(t => t.id === id);
    if (!found) return;
    setSelectedTemplateId(id);
    setPaperSize(found.paperSize);
    setCustomWidth(found.customWidth);
    setCustomHeight(found.customHeight);
    if (found.barcodeType === 'code128' || found.barcodeType === 'code39' || found.barcodeType === 'ean13') {
      setBarcodeType(found.barcodeType);
    } else {
      setBarcodeType('code128');
    }
    setShowBrand(found.showBrand);
    setShowProductName(found.showProductName);
    setShowSku(found.showSku);
    setShowBarcodeNumber(found.showBarcodeNumber);
    setShowPrice(found.showPrice);
    setShowMrp(found.showMrp);
    setShowSize(found.showSize);
    setShowColor(found.showColor);
    setBarcodeWidthScale(found.barcodeWidthScale);
    setBarcodeHeight(found.barcodeHeight);
    setLabelFontSize(found.labelFontSize);
    setLabelPadding(found.labelPadding);
    setBarcodeTextPosition(found.barcodeTextPosition);
    setSheetPaperSize(found.sheetPaperSize);
    setSheetColumns(found.sheetColumns);
    setSheetRows(found.sheetRows);
    setSheetHorizGap(found.sheetHorizGap);
    setSheetVertGap(found.sheetVertGap);
    setSheetTopMargin(found.sheetTopMargin);
    setSheetLeftMargin(found.sheetLeftMargin);
    setPrinterType(found.printerType);
    setMarginTop(found.marginTop !== undefined ? found.marginTop : 0);
    setMarginBottom(found.marginBottom !== undefined ? found.marginBottom : 0);
    setMarginLeft(found.marginLeft !== undefined ? found.marginLeft : 0);
    setMarginRight(found.marginRight !== undefined ? found.marginRight : 0);
  };

  const deleteLabelTemplate = (id: string) => {
    if (DEFAULT_TEMPLATES.some(t => t.id === id)) {
      alert('System default templates cannot be deleted.');
      return;
    }
    const updated = labelTemplates.filter(t => t.id !== id);
    setLabelTemplates(updated);
    localStorage.setItem('sf_label_templates', JSON.stringify(updated));
    if (selectedTemplateId === id) {
      setSelectedTemplateId('');
    }
  };

  const getProductsToPrint = (): Product[] => {
    if (printBatchType === 'selected') {
      const selected = products.filter(p => selectedProductIds.has(p.id));
      return selected.length > 0 ? selected : (barcodeProduct ? [barcodeProduct] : []);
    }
    return barcodeProduct ? [barcodeProduct] : [];
  };

  const getLabelPrintQueue = (): Product[] => {
    const baseProds = getProductsToPrint();
    const queue: Product[] = [];
    baseProds.forEach(p => {
      for (let i = 0; i < printQty; i++) {
        queue.push(p);
      }
    });
    return queue;
  };

  const LabelComponent = ({ product }: { product: Product }) => {
    const widthMm = paperSize === 'custom' ? customWidth : Number(paperSize.split('x')[0]);
    const heightMm = paperSize === 'custom' ? customHeight : Number(paperSize.split('x')[1]);
    
    const showBarcode = barcodeType === 'code128' || barcodeType === 'code39' || barcodeType === 'ean13';

    const finalPrice = product.discount > 0
      ? (product.discountType === 'percentage'
          ? Math.round(product.sellingPrice * (1 - product.discount / 100))
          : Math.max(0, product.sellingPrice - product.discount))
      : product.sellingPrice;

    return (
      <div
        className="font-mono flex flex-col justify-between relative border animate-fadeIn"
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          paddingTop: `${Number(labelPadding) + Number(marginTop)}mm`,
          paddingBottom: `${Number(labelPadding) + Number(marginBottom)}mm`,
          paddingLeft: `${Number(labelPadding) + Number(marginLeft)}mm`,
          paddingRight: `${Number(labelPadding) + Number(marginRight)}mm`,
          fontSize: `${labelFontSize}px`,
          lineHeight: '1.2',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          color: '#000000',
          borderColor: '#e2e8f0'
        }}
      >
        <div className="text-center shrink-0" style={{ borderBottom: showBrand ? `0.5px dashed #64748b80` : 'none', paddingBottom: '2px' }}>
          {showBrand && (
            <div className="font-sans font-black uppercase tracking-[1.5px] text-center text-slate-900" style={{ fontSize: `${labelFontSize - 1}px` }}>
              {storeName}
            </div>
          )}
        </div>

        <div className="text-center my-0.5 shrink-0 flex flex-col gap-0.5">
          {showProductName && (
            <div className="font-sans font-bold uppercase truncate text-center text-slate-950" style={{ fontSize: `${labelFontSize}px` }}>
              {product.name}
            </div>
          )}
          
          <div className="flex justify-center items-center gap-1 flex-wrap uppercase opacity-80 text-slate-800" style={{ fontSize: `${labelFontSize - 1.5}px` }}>
            {showSize && <span>SZ: {product.size}</span>}
            {showSize && showColor && product.color && <span>|</span>}
            {showColor && product.color && <span className="truncate max-w-[50px]">{product.color}</span>}
            {(showSize || showColor) && showBrand && <span>|</span>}
            {showBrand && <span className="truncate max-w-[50px] font-serif italic">{product.brand}</span>}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 my-1 overflow-hidden shrink-0">
          {showBarcode && (
            <div className="flex-1 flex flex-col items-center justify-center">
              {barcodeTextPosition === 'above' && showSku && (
                <span className="font-bold tracking-[1.5px] mb-0.5 text-slate-900" style={{ fontSize: `${labelFontSize - 2}px` }}>{product.sku}</span>
              )}
              {renderBarcodeSVG(product.sku)}
              {barcodeTextPosition === 'below' && showSku && (
                <span className="font-bold tracking-[1.5px] mt-0.5 text-slate-900" style={{ fontSize: `${labelFontSize - 2}px` }}>{product.sku}</span>
              )}
            </div>
          )}
        </div>

        <div className="pt-0.5 flex justify-between items-center px-0.5 shrink-0" style={{ borderTop: `0.5px dashed #64748b80`, fontSize: `${labelFontSize - 1}px`, color: '#000000' }}>
          {showMrp && (
            <div className="flex items-center gap-0.5 font-bold">
              <span>MRP:</span>
              <span className={product.discount > 0 ? "line-through opacity-60 font-medium" : ""}>
                ₹{product.sellingPrice}
              </span>
            </div>
          )}
          {showPrice && (
            <div className="font-sans font-black flex items-center gap-0.5">
              <span>POS:</span>
              <span>₹{finalPrice}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSettingChange = (updater: () => void) => {
    updater();
  };

  const isPrintingRef = useRef(false);
  const triggerPrintBarcodeRef = useRef<() => void>(() => {});

  const triggerPrintBarcode = () => {
    if (isPrintingRef.current) return;

    if (!barcodeProduct) {
      showToast('Please select a product before printing.', 'error');
      return;
    }
    if (!barcodeProduct.sku) {
      showToast('Barcode data is unavailable.', 'error');
      return;
    }

    const queue = getLabelPrintQueue();
    if (queue.length === 0) {
      showToast('The printable label queue is empty. Please select active items.', 'error');
      return;
    }

    const printAreaEl = document.getElementById('barcode-direct-print-area');
    if (!printAreaEl) {
      showToast('Barcode print area is not ready.', 'error');
      return;
    }

    try {
      isPrintingRef.current = true;

      const labelW = paperSize === 'custom' ? customWidth : Number(paperSize.split('x')[0]);
      const labelH = paperSize === 'custom' ? customHeight : Number(paperSize.split('x')[1]);

      let printPageW = labelW;
      let printPageH = labelH;

      if (printerType === 'laser') {
        printPageW = sheetPaperSize === 'A4' ? 210 : 215.9;
        printPageH = sheetPaperSize === 'A4' ? 297 : 279.4;
      } else if (printerType === 'inkjet') {
        if (inkjetPaperSize === 'A4') {
          printPageW = 210;
          printPageH = 297;
        } else if (inkjetPaperSize === 'A5') {
          printPageW = 148;
          printPageH = 210;
        } else if (inkjetPaperSize === 'Letter') {
          printPageW = 215.9;
          printPageH = 279.4;
        } else if (inkjetPaperSize === 'Legal') {
          printPageW = 215.9;
          printPageH = 355.6;
        }
        if (inkjetOrientation === 'landscape') {
          const temp = printPageW;
          printPageW = printPageH;
          printPageH = temp;
        }
      }

      // Copy the complete real barcode label HTML rendered in #barcode-direct-print-area
      const printContentHtml = extractPrintableBarcodeHtml(printAreaEl);

      // Populate using the unified current-document printing architecture
      const printableHtml = buildCompleteBarcodePrintPageHtml(printContentHtml, {
        pageWidthMm: printPageW,
        pageHeightMm: printPageH,
        title: `Barcode - ${barcodeProduct.sku} - Smart Fashion Manager`
      });

      void printInCurrentDocument(printableHtml, `Barcode - ${barcodeProduct.sku}`);
    } catch (err) {
      console.error('Failed to prepare barcode print:', err);
      showToast('Error preparing barcode print.', 'error');
    } finally {
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 1000);
    }
  };

  useEffect(() => {
    triggerPrintBarcodeRef.current = triggerPrintBarcode;
  });

  const handleRestoreDefaultMargins = () => {
    setInkjetMarginTop(10);
    setInkjetMarginBottom(10);
    setInkjetMarginLeft(10);
    setInkjetMarginRight(10);
    setInkjetOffsetX(0);
    setInkjetOffsetY(0);
    setInkjetOrientation('portrait');
    setInkjetPaperSize('A4');
    setInkjetScaling('100%');
    setInkjetCustomScaling(100);
    showToast('Inkjet margins restored to defaults.', 'success');
  };

  const handleApplyMargins = () => {
    showToast('Inkjet page margins applied successfully.', 'success');
  };

  const renderAdjustableInput = (
    label: string, 
    value: number, 
    onChange: (val: number) => void, 
    min = 0, 
    max = 50, 
    step = 0.5
  ) => {
    return (
      <div>
        <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">{label}</label>
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, Math.min(max, Number((value - step).toFixed(2)))))}
            className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer active:scale-95 transition"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
            className="w-full bg-transparent border-none text-center text-xs text-slate-300 font-mono focus:outline-none p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            step={step}
            min={min}
            max={max}
          />
          <button
            type="button"
            onClick={() => onChange(Math.max(min, Math.min(max, Number((value + step).toFixed(2)))))}
            className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer active:scale-95 transition"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  const renderPageLayoutPreview = () => {
    let pageW = 210;
    let pageH = 297;
    if (inkjetPaperSize === 'A4') { pageW = 210; pageH = 297; }
    else if (inkjetPaperSize === 'A5') { pageW = 148; pageH = 210; }
    else if (inkjetPaperSize === 'Letter') { pageW = 215.9; pageH = 279.4; }
    else if (inkjetPaperSize === 'Legal') { pageW = 215.9; pageH = 355.6; }

    if (inkjetOrientation === 'landscape') {
      const temp = pageW;
      pageW = pageH;
      pageH = temp;
    }

    const previewBoxWidth = 240; 
    const scale = previewBoxWidth / pageW;
    const previewBoxHeight = pageH * scale;

    const mTop = inkjetMarginTop * scale;
    const mBottom = (pageH - inkjetMarginBottom) * scale;
    const mLeft = inkjetMarginLeft * scale;
    const mRight = (pageW - inkjetMarginRight) * scale;

    const labelW = paperSize === 'custom' ? customWidth : Number(paperSize.split('x')[0]);
    const labelH = paperSize === 'custom' ? customHeight : Number(paperSize.split('x')[1]);

    let scaleFactor = 1.0;
    if (inkjetScaling === 'Custom %') {
      scaleFactor = inkjetCustomScaling / 100;
    } else if (inkjetScaling === 'Fit to Page') {
      const gridW = (sheetColumns * labelW) + ((sheetColumns - 1) * sheetHorizGap);
      const gridH = (sheetRows * labelH) + ((sheetRows - 1) * sheetVertGap);
      const printableW = pageW - inkjetMarginLeft - inkjetMarginRight;
      const printableH = pageH - inkjetMarginTop - inkjetMarginBottom;
      if (gridW > 0 && gridH > 0 && printableW > 0 && printableH > 0) {
        scaleFactor = Math.min(printableW / gridW, printableH / gridH);
      }
    }

    const scaledWidth = labelW * scaleFactor;
    const scaledHeight = labelH * scaleFactor;
    const scaledHorizGap = sheetHorizGap * scaleFactor;
    const scaledVertGap = sheetVertGap * scaleFactor;

    const startX = (inkjetMarginLeft + inkjetOffsetX) * scale;
    const startY = (inkjetMarginTop + inkjetOffsetY) * scale;

    const rects: React.ReactNode[] = [];
    for (let r = 0; r < sheetRows; r++) {
      for (let c = 0; c < sheetColumns; c++) {
        const rx = startX + c * (scaledWidth + scaledHorizGap) * scale;
        const ry = startY + r * (scaledHeight + scaledVertGap) * scale;
        const rw = scaledWidth * scale;
        const rh = scaledHeight * scale;

        const isOut = 
          rx < mLeft - 0.1 || 
          (rx + rw) > mRight + 0.1 || 
          ry < mTop - 0.1 || 
          (ry + rh) > mBottom + 0.1;

        rects.push(
          <div
            key={`${r}-${c}`}
            className={`absolute border transition duration-150 ${
              isOut 
                ? 'border-red-500 bg-red-500/15' 
                : 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10'
            }`}
            style={{
              left: `${rx}px`,
              top: `${ry}px`,
              width: `${rw}px`,
              height: `${rh}px`,
            }}
            title={isOut ? `Label [Row ${r+1}, Col ${c+1}] exceeds printable area!` : `Label [Row ${r+1}, Col ${c+1}]`}
          />
        );
      }
    }

    return (
      <div className="space-y-2 mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Page Layout Preview ({inkjetPaperSize})</span>
        <div className="flex justify-center py-2">
          <div 
            className="relative bg-slate-900 border border-slate-700 overflow-hidden shadow-inner"
            style={{
              width: `${previewBoxWidth}px`,
              height: `${previewBoxHeight}px`,
            }}
          >
            <div className="absolute inset-0 border border-dashed border-slate-800 pointer-events-none" />

            <div 
              className="absolute bg-slate-950/40 border border-emerald-500/20 pointer-events-none"
              style={{
                left: `${mLeft}px`,
                top: `${mTop}px`,
                width: `${mRight - mLeft}px`,
                height: `${mBottom - mTop}px`,
              }}
            />

            <div 
              className="absolute left-0 right-0 border-t border-red-500/40 border-dotted pointer-events-none"
              style={{ top: `${mTop}px` }}
            />
            <div 
              className="absolute left-0 right-0 border-t border-red-500/40 border-dotted pointer-events-none"
              style={{ top: `${mBottom}px` }}
            />
            <div 
              className="absolute top-0 bottom-0 border-l border-red-500/40 border-dotted pointer-events-none"
              style={{ left: `${mLeft}px` }}
            />
            <div 
              className="absolute top-0 bottom-0 border-l border-red-500/40 border-dotted pointer-events-none"
              style={{ left: `${mRight}px` }}
            />

            {rects}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono text-slate-400 border-t border-slate-900 pt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 border border-amber-500/50 bg-amber-500/10 rounded" />
            <span>Label (Safe)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 border border-red-500 bg-red-500/20 rounded" />
            <span className="text-red-400">Label (Cut Off)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-1.5 border border-dashed border-emerald-500/30 rounded" />
            <span>Printable region</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-px border-t border-dotted border-red-500/60" />
            <span>Margin Guides</span>
          </div>
        </div>
      </div>
    );
  };

  // History Log Modal
  const [historyOpen, setHistoryOpen] = useState(false);

  // Unique categories loaded dynamically from categoriesList
  const categories = useMemo(() => ['All', ...activeCategories.map((c) => c.name)], [activeCategories]);

  // Filters logic memoized for instant responsiveness
  const filteredProducts = useMemo(() => {
    const term = (debouncedSearchTerm || '').toLowerCase().trim();

    return products.filter((p) => {
      let matchSearch = true;
      if (term) {
        matchSearch =
          (p.name || '').toLowerCase().includes(term) ||
          (p.sku || '').includes(term) ||
          (p.brand || '').toLowerCase().includes(term);
      }

      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;

      let matchStock = true;
      if (stockFilter === 'Low') {
        matchStock = p.currentStock <= p.minStockAlert && p.currentStock > 0;
      } else if (stockFilter === 'Out') {
        matchStock = p.currentStock === 0;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [products, debouncedSearchTerm, selectedCategory, stockFilter]);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    // Generate simple 12 digit barcode/SKU
    setSku(String(Math.floor(100000000000 + Math.random() * 900000000000)));
    setCategory(activeCategories[0]?.name || '');
    setBrand(activeBrands[0]?.name || '');
    setSize(activeSizes[0]?.name || '');
    setColor(activeColors[0]?.name || '');
    setPurchasePrice(0);
    setSellingPrice(0);
    setDiscount(0);
    setDiscountType('percentage');
    setCurrentStock(10);
    setMinStockAlert(5);
    setStatus('active');
    setFormOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setSku(p.sku);
    setCategory(p.category);
    setBrand(p.brand);
    setSize(p.size);
    setColor(p.color);
    setPurchasePrice(p.purchasePrice);
    setSellingPrice(p.sellingPrice);
    setDiscount(p.discount);
    setDiscountType(p.discountType);
    setCurrentStock(p.currentStock);
    setMinStockAlert(p.minStockAlert);
    setStatus(p.status);
    setFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || !brand || purchasePrice <= 0 || sellingPrice <= 0) {
      alert('Please fill all mandatory fields with correct rates.');
      return;
    }

    const payload = {
      sku,
      name,
      category,
      brand,
      size,
      color,
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      discount: Number(discount),
      discountType,
      currentStock: Number(currentStock),
      minStockAlert: Number(minStockAlert),
      status,
      imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=300',
    };

    if (editingId) {
      updateProduct(editingId, payload);
    } else {
      addProduct(payload);
    }
    setFormOpen(false);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || adjustQty <= 0 || !adjustReason) {
      alert('Please select valid details and text explanation.');
      return;
    }

    // stock-out, adjustment, or damaged subtract from database
    const multiplier = adjustType === 'stock-in' ? 1 : -1;
    adjustStock(adjustProduct.id, adjustQty * multiplier, adjustType, adjustReason);
    setAdjustOpen(false);
  };

  useEffect(() => {
    if (barcodeOpen && barcodeProduct) {
    const labelW = paperSize === 'custom' ? customWidth : Number(paperSize.split('x')[0]);
    const labelH = paperSize === 'custom' ? customHeight : Number(paperSize.split('x')[1]);

    let printPageW = labelW;
    let printPageH = labelH;

    if (printerType === 'laser') {
      printPageW = sheetPaperSize === 'A4' ? 210 : 215.9;
      printPageH = sheetPaperSize === 'A4' ? 297 : 279.4;
    } else if (printerType === 'inkjet') {
      if (inkjetPaperSize === 'A4') {
        printPageW = 210;
        printPageH = 297;
      } else if (inkjetPaperSize === 'A5') {
        printPageW = 148;
        printPageH = 210;
      } else if (inkjetPaperSize === 'Letter') {
        printPageW = 215.9;
        printPageH = 279.4;
      } else if (inkjetPaperSize === 'Legal') {
        printPageW = 215.9;
        printPageH = 355.6;
      }
      if (inkjetOrientation === 'landscape') {
        const temp = printPageW;
        printPageW = printPageH;
        printPageH = temp;
      }
    }
  
      // reset config values on modal open
      setPrintQty(1);
      setPaperSize('50x25');
    }
  }, [barcodeOpen, barcodeProduct]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!barcodeOpen) return;
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isMetaOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        e.preventDefault();
        setBarcodeOpen(false);
      } else if (isMetaOrCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        triggerPrintBarcodeRef.current();
      } else if (isMetaOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowSaveTemplateModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeOpen]);

  if (barcodeOpen && barcodeProduct) {
    const labelW = paperSize === 'custom' ? customWidth : Number(paperSize.split('x')[0]);
    const labelH = paperSize === 'custom' ? customHeight : Number(paperSize.split('x')[1]);

    let printPageW = labelW;
    let printPageH = labelH;

    if (printerType === 'laser') {
      printPageW = sheetPaperSize === 'A4' ? 210 : 215.9;
      printPageH = sheetPaperSize === 'A4' ? 297 : 279.4;
    } else if (printerType === 'inkjet') {
      if (inkjetPaperSize === 'A4') {
        printPageW = 210;
        printPageH = 297;
      } else if (inkjetPaperSize === 'A5') {
        printPageW = 148;
        printPageH = 210;
      } else if (inkjetPaperSize === 'Letter') {
        printPageW = 215.9;
        printPageH = 279.4;
      } else if (inkjetPaperSize === 'Legal') {
        printPageW = 215.9;
        printPageH = 355.6;
      }
      if (inkjetOrientation === 'landscape') {
        const temp = printPageW;
        printPageW = printPageH;
        printPageH = temp;
      }
    }

    const designerFilteredProducts = () => {
      const term = designerSearchTerm.trim().toLowerCase();
      if (!term) return [];
      return products.filter(p => 
        (p.name || '').toLowerCase().includes(term) || 
        (p.sku || '').toLowerCase().includes(term) ||
        (p.brand || '').toLowerCase().includes(term)
      ).slice(0, 5);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
      const zoomFactor = 0.1;
      const newZoom = e.deltaY < 0 ? zoom + zoomFactor : zoom - zoomFactor;
      setZoom(Math.min(Math.max(newZoom, 0.25), 4));
    };

    const handleAutoFit = () => {
      setZoom(1.5);
      setPan({ x: 0, y: 0 });
    };

    return (
      <div id="barcode-studio-workspace" className="fixed top-[var(--header-height)] left-0 right-0 bottom-0 h-[calc(100vh-var(--header-height))] z-[100] bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-fadeIn select-none">
        {/* CSS overrides */}
        <style>{`
          @media screen {
            #barcode-direct-print-area,
            .print-only {
              display: none !important;
            }
          }
          @media print {
            @page {
              size: ${printPageW}mm ${printPageH}mm;
              margin: 0 !important;
            }
            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: auto !important;
              height: auto !important;
              min-height: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              overflow: visible !important;
            }
            body > * {
              visibility: hidden !important;
            }
            #barcode-studio-workspace {
              visibility: visible !important;
              position: static !important;
              width: auto !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              background: #ffffff !important;
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #barcode-direct-print-area,
            #barcode-direct-print-area * {
              visibility: visible !important;
            }
            #barcode-direct-print-area {
              display: block !important;
              position: static !important;
              width: auto !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
            }
            .no-print,
            .global-app-header,
            header,
            nav,
            aside,
            footer,
            button,
            #invoice-print-area,
            #printable-area {
              display: none !important;
              height: 0 !important;
              width: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              overflow: hidden !important;
            }
            .barcode-print-label-item {
              width: ${labelW}mm !important;
              height: ${labelH}mm !important;
              max-width: ${labelW}mm !important;
              max-height: ${labelH}mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
              background: #ffffff !important;
              border: none !important;
              box-shadow: none !important;
            }
            .barcode-print-label-item:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .barcode-print-sheet-item {
              width: ${printPageW}mm !important;
              height: ${printPageH}mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              margin: 0 !important;
              display: block !important;
              background: #ffffff !important;
            }
            .barcode-print-sheet-item:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .barcode-print-label-item > div {
              border-color: transparent !important;
              box-shadow: none !important;
            }
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* TOOLBAR AREA */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setBarcodeOpen(false)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/30 text-slate-400 hover:text-amber-500 transition duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Back to Products</span>
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <h1 className="font-serif text-base font-bold text-amber-100 tracking-tight leading-none">Enterprise Barcode Label Studio</h1>
              <p className="text-[10px] text-slate-400 mt-1">v3.0 ERP Engine • Real-time Calibrated Canvas</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs bg-slate-950/60 border border-slate-800/80 px-4 py-1.5 rounded-xl">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Current Product</span>
              <span className="font-bold text-slate-200">{barcodeProduct.name}</span>
            </div>
            <div className="h-6 w-px bg-slate-800/50" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 block">SKU Code</span>
              <span className="font-mono text-amber-500 font-bold">{barcodeProduct.sku}</span>
            </div>
            <div className="h-6 w-px bg-slate-800/50" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Category</span>
              <span className="text-slate-300 font-medium">{barcodeProduct.category}</span>
            </div>
          </div>
        </div>

        {/* THREE COLUMNS WORKSPACE AREA */}
        <div className="flex-1 flex overflow-hidden w-full no-print">
          {/* LEFT SIDEBAR (25-30%) */}
          <aside className="w-[340px] bg-slate-900 p-5 overflow-y-auto flex flex-col gap-5 border-r border-slate-800/80 shrink-0">
            {/* Template Block */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <FileCode className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Label Templates</span>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] uppercase text-slate-500 font-bold">Select Active Template</label>
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => loadLabelTemplate(e.target.value)}
                    className="bg-transparent border-none text-slate-200 text-xs font-semibold focus:ring-0 cursor-pointer w-full"
                  >
                    <option value="" className="bg-slate-950">--- Default Layout ---</option>
                    {labelTemplates.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-950">
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateId && !DEFAULT_TEMPLATES.some(t => t.id === selectedTemplateId) && (
                    <button
                      type="button"
                      onClick={() => deleteLabelTemplate(selectedTemplateId)}
                      className="p-1 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Save template inline action inside column */}
              {showSaveTemplateModal ? (
                <div className="bg-slate-950 border border-amber-500/30 p-3 rounded-xl space-y-2.5 animate-fadeIn">
                  <span className="block text-[9px] uppercase tracking-wider text-amber-400 font-bold">Save Current Config</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Template Name..."
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (newTemplateName.trim()) {
                          saveLabelTemplate(newTemplateName);
                          setNewTemplateName('');
                          setShowSaveTemplateModal(false);
                          showToast('Preset template saved successfully!', 'success');
                        }
                      }}
                      className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-95 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowSaveTemplateModal(false)}
                      className="bg-slate-800 text-slate-300 px-2.5 rounded-lg text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="w-full py-1.5 bg-slate-950 hover:bg-slate-800/50 border border-slate-800 rounded-lg text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Current As Template
                </button>
              )}
            </div>

            {/* Design Target Switcher */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <span className="block text-[10px] uppercase text-slate-500 font-bold">Change Design Target Product</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Type product name, sku, brand..."
                  value={designerSearchTerm}
                  onChange={(e) => setDesignerSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-9 pr-3 py-2 text-xs rounded-xl focus:ring-1 focus:ring-amber-500 focus:border-amber-500 placeholder-slate-600 transition"
                />
                {designerSearchTerm.trim() !== '' && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {designerFilteredProducts().map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setBarcodeProduct(p);
                          setDesignerSearchTerm('');
                        }}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-amber-500/10 hover:text-white transition flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-xs truncate max-w-[180px]">{p.name}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider bg-slate-950 text-amber-500 px-1.5 py-0.5 rounded border border-slate-800">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dimension Preset & Calibration */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Maximize2 className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Calibration & Sizing</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] uppercase text-slate-500 font-bold mb-1">Label Size Preset</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="50x25">50mm x 25mm</option>
                    <option value="38x25">38mm x 25mm</option>
                    <option value="75x50">75mm x 50mm</option>
                    <option value="100x50">100mm x 50mm</option>
                    <option value="custom">Custom Dimensions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase text-slate-500 font-bold mb-1">Copies to Print</label>
                  <input
                    type="number"
                    value={printQty}
                    onChange={(e) => setPrintQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                    min="1"
                  />
                </div>
              </div>

              {paperSize === 'custom' && (
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 animate-slideDown">
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Width (mm)</label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Math.max(10, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Height (mm)</label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Math.max(10, Number(e.target.value)))}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] uppercase text-slate-500 font-bold mb-1">Label Padding (mm)</label>
                  <input
                    type="number"
                    value={labelPadding}
                    onChange={(e) => setLabelPadding(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-slate-500 font-bold mb-1">Font Size (px)</label>
                  <input
                    type="number"
                    value={labelFontSize}
                    onChange={(e) => setLabelFontSize(Math.max(6, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                    min="6"
                  />
                </div>
              </div>
            </div>

            {/* Printer Calibration Block */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Sliders className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Printer & Paper Configuration</span>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase text-slate-500 font-bold">Printer Hardware Type</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                  {[
                    { id: 'thermal', label: 'Thermal' },
                    { id: 'laser', label: 'Laser' },
                    { id: 'inkjet', label: 'Inkjet' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSettingChange(() => setPrinterType(p.id as 'thermal' | 'laser' | 'inkjet'))}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                        printerType === p.id 
                          ? 'bg-amber-500 text-slate-950' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {printerType !== 'thermal' && (
                <div className="space-y-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800 animate-slideDown">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Paper Sheet Size</label>
                      <select
                        value={sheetPaperSize}
                        onChange={(e) => handleSettingChange(() => setSheetPaperSize(e.target.value as 'Roll' | 'A4' | 'Letter'))}
                        className="w-full bg-slate-900 border border-slate-850 rounded p-1.5 text-[10px] text-slate-200 cursor-pointer"
                      >
                        <option value="A4">A4 Sheet</option>
                        <option value="Letter">Letter Sheet</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Layout Grid Cols</label>
                      <input
                        type="number"
                        value={sheetColumns}
                        onChange={(e) => handleSettingChange(() => setSheetColumns(Math.max(1, Number(e.target.value))))}
                        className="w-full bg-slate-900 border border-slate-850 rounded p-1.5 text-[10px] text-slate-200 font-mono"
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Grid Rows</label>
                      <input
                        type="number"
                        value={sheetRows}
                        onChange={(e) => handleSettingChange(() => setSheetRows(Math.max(1, Number(e.target.value))))}
                        className="w-full bg-slate-900 border border-slate-850 rounded p-1.5 text-[10px] text-slate-200 font-mono"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Horiz Gap (mm)</label>
                      <input
                        type="number"
                        value={sheetHorizGap}
                        onChange={(e) => handleSettingChange(() => setSheetHorizGap(Math.max(0, Number(e.target.value))))}
                        className="w-full bg-slate-900 border border-slate-850 rounded p-1.5 text-[10px] text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* A4 PAGE MARGIN CONTROL (Inkjet-specific) or Standard Margin Control */}
            {printerType === 'inkjet' ? (
              <div className="space-y-4 pt-3 border-t border-slate-800 animate-fadeIn">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Sliders className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">A4 Page Margin Control</span>
                </div>

                {/* Page Orientation & Paper Size */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Page Orientation</label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                      {(['portrait', 'landscape'] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => handleSettingChange(() => setInkjetOrientation(o))}
                          className={`py-1 rounded text-[9px] font-bold uppercase transition cursor-pointer ${
                            inkjetOrientation === o
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Paper Size</label>
                    <select
                      value={inkjetPaperSize}
                      onChange={(e) => handleSettingChange(() => setInkjetPaperSize(e.target.value as any))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="A4">A4 (210x297mm)</option>
                      <option value="A5">A5 (148x210mm)</option>
                      <option value="Letter">Letter (8.5x11")</option>
                      <option value="Legal">Legal (8.5x14")</option>
                    </select>
                  </div>
                </div>

                {/* Page Margins (mm) */}
                <div className="space-y-2">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Page Margins (mm)</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {renderAdjustableInput("Top Margin", inkjetMarginTop, (v) => handleSettingChange(() => setInkjetMarginTop(v)), 0, 50, 0.5)}
                    {renderAdjustableInput("Bottom Margin", inkjetMarginBottom, (v) => handleSettingChange(() => setInkjetMarginBottom(v)), 0, 50, 0.5)}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {renderAdjustableInput("Left Margin", inkjetMarginLeft, (v) => handleSettingChange(() => setInkjetMarginLeft(v)), 0, 50, 0.5)}
                    {renderAdjustableInput("Right Margin", inkjetMarginRight, (v) => handleSettingChange(() => setInkjetMarginRight(v)), 0, 50, 0.5)}
                  </div>
                </div>

                {/* Label Alignment */}
                <div className="space-y-2 border-t border-slate-900 pt-3">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Label Alignment Offsets</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {renderAdjustableInput("Horizontal (mm)", inkjetOffsetX, (v) => handleSettingChange(() => setInkjetOffsetX(v)), -50, 50, 0.5)}
                    {renderAdjustableInput("Vertical (mm)", inkjetOffsetY, (v) => handleSettingChange(() => setInkjetOffsetY(v)), -50, 50, 0.5)}
                  </div>
                </div>

                {/* Print Scaling */}
                <div className="space-y-2 border-t border-slate-900 pt-3">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Print Scaling</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                    {(['100%', 'Fit to Page', 'Actual Size', 'Custom %'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSettingChange(() => setInkjetScaling(s))}
                        className={`py-1 rounded text-[9px] font-bold transition cursor-pointer ${
                          inkjetScaling === s
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {inkjetScaling === 'Custom %' && (
                    <div className="mt-2 animate-slideDown">
                      {renderAdjustableInput("Custom Scale %", inkjetCustomScaling, (v) => handleSettingChange(() => setInkjetCustomScaling(v)), 10, 500, 1)}
                    </div>
                  )}
                </div>

                {/* Live Page Layout Preview */}
                {renderPageLayoutPreview()}

                {/* Control Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={handleRestoreDefaultMargins}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition cursor-pointer active:scale-95 text-center"
                  >
                    Restore Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyMargins}
                    className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer active:scale-95 text-center shadow-lg shadow-amber-500/10"
                  >
                    Apply Margins
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Sliders className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Margin Control</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Top Margin (mm)</label>
                    <input
                      type="number"
                      value={marginTop}
                      onChange={(e) => handleSettingChange(() => setMarginTop(Math.max(0, Math.min(50, Number(e.target.value)))))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                      min="0"
                      max="50"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Right Margin (mm)</label>
                    <input
                      type="number"
                      value={marginRight}
                      onChange={(e) => handleSettingChange(() => setMarginRight(Math.max(0, Math.min(50, Number(e.target.value)))))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                      min="0"
                      max="50"
                      step="0.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Left Margin (mm)</label>
                    <input
                      type="number"
                      value={marginLeft}
                      onChange={(e) => handleSettingChange(() => setMarginLeft(Math.max(0, Math.min(50, Number(e.target.value)))))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                      min="0"
                      max="50"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase text-slate-500 font-bold mb-1">Bottom Margin (mm)</label>
                    <input
                      type="number"
                      value={marginBottom}
                      onChange={(e) => handleSettingChange(() => setMarginBottom(Math.max(0, Math.min(50, Number(e.target.value)))))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none"
                      min="0"
                      max="50"
                      step="0.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* CENTER WORKSPACE (45-50%) */}
          <main 
            className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing border-r border-l border-slate-900"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Design Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_14px]" />
            
            {/* Real-time Rendering Canvas Box */}
            <div 
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.05s ease-out'
              }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-amber-500/20 rounded overflow-hidden bg-white">
                <LabelComponent product={barcodeProduct} />
              </div>
            </div>

            {/* Float Calibration Status Overlay */}
            <div className="absolute bottom-4 left-4 z-10 bg-slate-900/85 backdrop-blur border border-slate-800/60 rounded-xl px-3 py-1.5 flex gap-4 text-[10px] font-mono text-slate-400 pointer-events-none shadow-lg">
              <div>
                <span className="text-slate-500">ZOOM:</span> {Math.round(zoom * 100)}%
              </div>
              <div>
                <span className="text-slate-500">SIZE:</span> {paperSize === 'custom' ? `${customWidth}x${customHeight}` : paperSize}mm
              </div>
            </div>

            {/* Quick Drafting Board Control Panel */}
            <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-lg z-10 text-[10px] text-slate-400 font-mono">
              <button 
                onClick={() => handleSettingChange(() => setZoom(prev => Math.max(0.25, prev - 0.25)))} 
                className="hover:text-amber-500 transition px-1 font-bold cursor-pointer"
                title="Zoom Out"
              >
                -
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button 
                onClick={() => handleSettingChange(() => setZoom(prev => Math.min(4.0, prev + 0.25)))} 
                className="hover:text-amber-500 transition px-1 font-bold cursor-pointer"
                title="Zoom In"
              >
                +
              </button>
              <div className="w-px h-3 bg-slate-800" />
              <button 
                onClick={handleAutoFit} 
                className="hover:text-amber-500 transition font-bold px-1 uppercase text-amber-500/80 text-[9px] cursor-pointer"
              >
                Auto-Fit
              </button>
            </div>
          </main>

          {/* RIGHT SIDEBAR (25-30%) */}
          <aside className="w-[320px] bg-slate-900 p-5 overflow-y-auto flex flex-col gap-4 shrink-0 border-l border-slate-800/80">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Eye className="w-4 h-4 text-amber-500 animate-pulse" />
              <h2 className="font-bold uppercase tracking-wider text-xs">Label Content Controls</h2>
            </div>

            <div className="space-y-3.5 pt-2 animate-fadeIn">
              {[
                { label: '✔ Product Name', value: showProductName, setter: setShowProductName, desc: 'Primary item descriptor line' },
                { label: '✔ Brand', value: showBrand, setter: setShowBrand, desc: 'Garment collection banner' },
                { label: '✔ SKU', value: showSku, setter: setShowSku, desc: 'Stock keeping code format' },
                { label: '✔ Barcode', value: showBarcodeNumber, setter: setShowBarcodeNumber, desc: 'Linear vector rendering code' },
                { label: '✔ Size', value: showSize, setter: setShowSize, desc: 'Garment scale indicators' },
                { label: '✔ Color', value: showColor, setter: setShowColor, desc: 'Garment hue designation' },
                { label: '✔ MRP', value: showMrp, setter: setShowMrp, desc: 'Maximum retail pricing line' },
                { label: '✔ Sale Price', value: showPrice, setter: setShowPrice, desc: 'Showroom point-of-sale' },
              ].map((item) => (
                <label key={item.label} className="flex items-start gap-3 cursor-pointer group">
                  <input
                     type="checkbox"
                     checked={item.value}
                     onChange={(e) => handleSettingChange(() => item.setter(e.target.checked))}
                     className="mt-0.5 rounded border-slate-750 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 transition h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition block leading-tight">{item.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </aside>
        </div>

        {/* BOTTOM STICKY ACTION BAR */}
        <footer className="h-16 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-center shrink-0 shadow-2xl z-20 no-print">
          <button
            type="button"
            id="barcode-studio-print-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerPrintBarcode();
            }}
            className="px-12 py-3 rounded-xl gold-gradient text-slate-950 text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer min-w-[280px]"
          >
            <Printer className="w-4.5 h-4.5 text-slate-950" />
            PRINT
          </button>
        </footer>

        {/* Native Browser Direct Printable Area */}
        <div id="barcode-direct-print-area" className="print-only">
          {printerType === 'thermal' ? (
            getLabelPrintQueue().map((prod, idx) => (
              <div
                key={idx}
                className="barcode-print-label-item"
                style={{
                  width: `${labelW}mm`,
                  height: `${labelH}mm`,
                  pageBreakAfter: idx === getLabelPrintQueue().length - 1 ? 'avoid' : 'always',
                  breakAfter: idx === getLabelPrintQueue().length - 1 ? 'avoid' : 'page',
                }}
              >
                <LabelComponent product={prod} />
              </div>
            ))
          ) : (
            Array.from({ length: Math.ceil(getLabelPrintQueue().length / (sheetColumns * sheetRows)) }).map((_, pageIdx) => {
              const queue = getLabelPrintQueue();
              const itemsPerPage = sheetColumns * sheetRows;
              const pageItems = queue.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
              const isLastPage = pageIdx === Math.ceil(queue.length / itemsPerPage) - 1;

              return (
                <div
                  key={pageIdx}
                  className="barcode-print-sheet-item"
                  style={{
                    width: `${printPageW}mm`,
                    height: `${printPageH}mm`,
                    paddingTop: `${printerType === 'inkjet' ? (inkjetMarginTop + inkjetOffsetY) : sheetTopMargin}mm`,
                    paddingLeft: `${printerType === 'inkjet' ? (inkjetMarginLeft + inkjetOffsetX) : sheetLeftMargin}mm`,
                    pageBreakAfter: isLastPage ? 'avoid' : 'always',
                    breakAfter: isLastPage ? 'avoid' : 'page',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${sheetColumns}, ${labelW}mm)`,
                      gap: `${sheetVertGap}mm ${sheetHorizGap}mm`,
                    }}
                  >
                    {pageItems.map((prod, itemIdx) => (
                      <div key={itemIdx} style={{ width: `${labelW}mm`, height: `${labelH}mm` }}>
                        <LabelComponent product={prod} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>


      </div>
    );
  }

  return (
    <div className="space-y-4" id="products-view-container">
      {/* Custom Dynamic Toast for Barcode Studio Alerts */}
      {toast && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-xs border fixed top-6 right-6 z-[9999] shadow-2xl animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navigation Bar on Products & Catalog */}
      <div 
        id="products-catalog-top-navbar" 
        className="bg-slate-900/95 backdrop-blur-md border border-slate-800/80 rounded-xl p-1 shadow-lg select-none"
      >
        <div 
          role="tablist" 
          aria-label="Products and Catalog navigation" 
          className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent py-0.5 px-0.5"
        >
          {[
            { id: 'products', name: 'Products Directory', icon: Shirt, count: products.length },
            { id: 'fabrics', name: 'Fabrics Directory', icon: Scissors, count: (fabrics || []).length },
            { id: 'categories', name: 'Categories Master', icon: Layers, count: categoriesList.length },
            { id: 'brands', name: 'Brands Master', icon: Tag, count: brandsList.length },
            { id: 'sizes', name: 'Sizes Master', icon: Ruler, count: sizesList.length },
            { id: 'colors', name: 'Colors Master', icon: Palette, count: colorsList.length },
            { id: 'gifts', name: 'Gifts Master', icon: Gift, count: (gifts || []).length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-products-${tab.id}`}
                aria-selected={isActive}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400/80'
                  }`}
                />
                <span>{tab.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none border transition-colors ${
                    isActive
                      ? 'bg-amber-500/25 text-amber-200 border-amber-500/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 group-hover:border-slate-700 group-hover:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeSubTab === 'fabrics' && (
        <FabricsDirectoryView
          onOpenBarcode={(fab) => {
            setBarcodeProduct({
              id: fab.id,
              name: fab.name,
              sku: fab.sku,
              barcode: fab.sku,
              category: fab.categoryName || 'Fabrics',
              brand: fab.brandName || 'House',
              size: fab.width || '58"',
              color: fab.colorName || '',
              sellingPrice: fab.retailRate || 0,
              mrp: fab.retailRate || 0,
              purchasePrice: fab.purchaseRate || 0,
              stock: Math.floor(fab.stockMeters || 0),
              minStockAlert: Math.floor(fab.minStockAlertMeters || 10),
              status: fab.status || 'active',
              description: fab.description || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            setBarcodeOpen(true);
          }}
        />
      )}
      {activeSubTab === 'categories' && <CategoriesMasterView />}
      {activeSubTab === 'brands' && <BrandsMasterView />}
      {activeSubTab === 'sizes' && <SizesMasterView />}
      {activeSubTab === 'colors' && <ColorsMasterView />}
      {activeSubTab === 'gifts' && <GiftsMasterView />}

      {activeSubTab === 'products' && (
        <>
          {/* Compact Flex Header for Products Directory */}
          <div 
            id="products-directory-header" 
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 border border-slate-800/70 rounded-xl px-4 py-2.5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Shirt className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-base sm:text-lg font-bold tracking-tight text-amber-100 leading-tight">
                    Apparel Products Directory
                  </h1>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 hidden sm:inline-block">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Manage clothing pieces, adjust inventory stock, and print designer barcodes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                id="view-inventory-history"
                onClick={() => setHistoryOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
                title="View Stock Ledger History"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Stock Ledger</span>
              </button>
              <PermissionButton
                id="add-new-product"
                module="products"
                action="add"
                onClick={openAddModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 gold-gradient text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-wider transition hover:opacity-90 active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>New Apparel</span>
              </PermissionButton>
            </div>
          </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="product-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Name, SKU / Barcode, or Brand..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none transition"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            id="stock-filter"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none transition"
          >
            <option value="All">All Stocks</option>
            <option value="Low">Low Stocks</option>
            <option value="Out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.has(p.id))}
                    onChange={(e) => {
                      const updated = new Set(selectedProductIds);
                      if (e.target.checked) {
                        filteredProducts.forEach(p => updated.add(p.id));
                      } else {
                        filteredProducts.forEach(p => updated.delete(p.id));
                      }
                      setSelectedProductIds(updated);
                    }}
                    className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                </th>
                <th className="p-4">SKU & Label</th>
                <th className="p-4">Category / Brand</th>
                <th className="p-4 text-center">Specs (Size / Color)</th>
                <th className="p-4 text-right font-mono">Purchase (₹)</th>
                <th className="p-4 text-right font-mono">Retail (₹)</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <FolderMinus className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    No products found in showroom inventory. Click "New Apparel" to add.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert && p.currentStock > 0;
                  const isOut = p.currentStock === 0;

                  return (
                    <tr key={p.id} className={`hover:bg-slate-800/20 transition ${selectedProductIds.has(p.id) ? 'bg-amber-500/5' : ''}`}>
                      <td className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(p.id)}
                          onChange={() => {
                            const updated = new Set(selectedProductIds);
                            if (updated.has(p.id)) {
                              updated.delete(p.id);
                            } else {
                              updated.add(p.id);
                            }
                            setSelectedProductIds(updated);
                          }}
                          className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                      {/* SKU and Name */}
                      <td className="p-4">
                        <div>
                          <h4 className="font-bold text-slate-200">{p.name}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                            <Barcode className="w-3.5 h-3.5 text-amber-500/50" />
                            {p.sku}
                          </div>
                        </div>
                      </td>

                      {/* Category and Brand */}
                      <td className="p-4">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {p.category}
                          </span>
                          <p className="text-[10px] text-amber-500/80 mt-1 font-serif italic">{p.brand}</p>
                        </div>
                      </td>

                      {/* Specs */}
                      <td className="p-4 text-center">
                        <div className="inline-flex gap-1">
                          <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                            {p.size}
                          </span>
                          {p.color && (
                            <span className="text-[10px] text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded max-w-[80px] truncate">
                              {p.color}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchase Price */}
                      <td className="p-4 text-right font-mono font-medium text-slate-400">
                        {formatINR(p.purchasePrice, { keepDecimals: true })}
                      </td>

                      {/* Retail Price */}
                      <td className="p-4 text-right font-mono font-bold text-amber-200">
                        {formatINR(p.sellingPrice, { keepDecimals: true })}
                        {p.discount > 0 && (
                          <span className="block text-[8px] text-amber-500 font-mono">
                            {p.discountType === 'percentage' ? `-${p.discount}%` : `-${formatINR(p.discount, { keepDecimals: true })}`}
                          </span>
                        )}
                      </td>

                      {/* Stock Alert State */}
                      <td className="p-4 text-center">
                        <div>
                          <span className={`font-mono font-bold text-sm ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-200'}`}>
                            {p.currentStock}
                          </span>
                          {isOut ? (
                            <span className="flex items-center justify-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-red-500 mt-1">
                              <AlertCircle className="w-2.5 h-2.5" /> Out
                            </span>
                          ) : isLow ? (
                            <span className="flex items-center justify-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-500 mt-1 animate-pulse">
                              <AlertCircle className="w-2.5 h-2.5" /> Low Stock
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
                              <CheckCircle className="w-2.5 h-2.5 text-slate-600" /> Optimal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* Print Barcode button */}
                          <button
                            id={`btn-barcode-${p.id}`}
                            title="Print Barcode Tag"
                            onClick={() => {
                              setBarcodeProduct(p);
                              setBarcodeOpen(true);
                            }}
                            className="p-1.5 rounded bg-slate-950 text-amber-500/80 hover:text-amber-400 border border-slate-800 hover:border-amber-500/20 transition"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Adjust Stock */}
                          <PermissionButton
                            id={`btn-adjust-${p.id}`}
                            module="products"
                            action="update_stock"
                            title="Adjust Stock In-Out"
                            onClick={() => {
                              setAdjustProduct(p);
                              setAdjustQty(1);
                              setAdjustReason('');
                              setAdjustType('stock-in');
                              setAdjustOpen(true);
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-300 transition"
                          >
                            Stock ±
                          </PermissionButton>

                          {/* Edit button */}
                          <PermissionButton
                            id={`btn-edit-${p.id}`}
                            module="products"
                            action="edit"
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded bg-slate-950 text-blue-400 hover:text-blue-300 border border-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </PermissionButton>

                          {/* Delete button */}
                          <PermissionButton
                            id={`btn-del-${p.id}`}
                            module="products"
                            action="delete"
                            onClick={() => {
                              setDeleteConfirm({ isOpen: true, recordId: p.id, recordName: p.name });
                            }}
                            className="p-1.5 rounded bg-slate-950 text-red-400 hover:bg-red-500/10 border border-slate-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </PermissionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Apparel Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/10 rounded-2xl w-full max-w-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-xl font-bold text-amber-100">
                  {editingId ? 'Refine Apparel SKU' : 'Add Luxury Garment SKU'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Complete garment profile & procurement rates with SAP/ERP precision.</p>
              </div>
              <button
                id="close-form-modal"
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5 text-xs">
              {/* Garment Name (Full Width) */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Garment Name *</label>
                <input
                  id="form-product-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Royal Italian Silk Wedding Vest"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <hr className="border-slate-800/80" />

              {/* SKU / Barcode and Category */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">SKU / Barcode Code *</label>
                  <input
                    id="form-product-sku"
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="890123456001"
                    className="w-full bg-slate-950 border border-slate-800 font-mono focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Category *</label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-product-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                    >
                      {activeCategories.length === 0 ? (
                        <option value="">No Active Categories</option>
                      ) : (
                        activeCategories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('category');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap"
                      title="Add New Category"
                    >
                      + New
                    </button>
                  </div>
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Brand, Size, Color (3 Columns) */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Designer Brand *</label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-product-brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Select Brand</option>
                      {activeBrands.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('brand');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap"
                      title="Add New Brand"
                    >
                      + New
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Size Spec *</label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-product-size"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Select Size</option>
                      {activeSizes.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('size');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap"
                      title="Add New Size"
                    >
                      + New
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Color Lining</label>
                  <div className="flex items-center gap-2.5">
                    <select
                      id="form-product-color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="">Select Color</option>
                      {activeColors.map((col) => (
                        <option key={col.id} value={col.name}>{col.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setMiniModalType('color');
                        setMiniModalValue('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline bg-transparent border-0 p-0 whitespace-nowrap"
                      title="Add New Color"
                    >
                      + New
                    </button>
                  </div>
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Purchase Price and Selling Price */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Purchase Cost Price (₹) *</label>
                  <input
                    id="form-product-buy"
                    type="number"
                    value={purchasePrice || ''}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    placeholder="120"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="1"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Selling Retail Price (₹) *</label>
                  <input
                    id="form-product-sell"
                    type="number"
                    value={sellingPrice || ''}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    placeholder="299"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Default Discount and Discount Type */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Default POS discount</label>
                  <input
                    id="form-product-discount"
                    type="number"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    placeholder="5"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Discount Type</label>
                  <select
                    id="form-product-discount-type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Cash Value (₹)</option>
                  </select>
                </div>
              </div>

              <hr className="border-slate-800/80" />

              {/* Current Stock, Minimum Alert, Status */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Current Stock Qty *</label>
                  <input
                    id="form-product-stock"
                    type="number"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(Number(e.target.value))}
                    placeholder="15"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0"
                    required
                    disabled={editingId !== null} // edits should use stock adjust modal to maintain logs!
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Min Alert Threshold *</label>
                  <input
                    id="form-product-alert"
                    type="number"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(Number(e.target.value))}
                    placeholder="5"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="0"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Showroom Status</label>
                  <select
                    id="form-product-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active On Display</option>
                    <option value="inactive">Archived / Hidden</option>
                  </select>
                </div>
              </div>

              {editingId && (
                <p className="text-[10px] text-amber-500/80 italic font-medium pt-1">
                  Note: Updating current stock directly is locked. Please use the "Stock ±" quick button on the table page to audit entries.
                </p>
              )}

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-800">
                <button
                  id="cancel-form"
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-5 py-2.5 rounded-lg font-bold transition active:scale-95 text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  id="submit-product-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-7 py-2.5 rounded-lg font-extrabold uppercase tracking-widest transition active:scale-95 shadow-lg text-xs"
                >
                  {editingId ? 'Refine SKU' : 'Add Garment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock ± Adjustment Modal */}
      {adjustOpen && adjustProduct && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs select-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Audit Stock Level</h3>
                <p className="text-[10px] text-slate-400">Log stock procurement or damages for: <span className="text-amber-500 font-bold">{adjustProduct.name}</span></p>
              </div>
              <button
                id="close-adjust-modal"
                onClick={() => setAdjustOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Adjust Type */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Adjustment Category</label>
                  <select
                    id="adjust-type-select"
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-300 focus:outline-none"
                  >
                    <option value="stock-in">Restock In (+)</option>
                    <option value="stock-out">Stock Out (-)</option>
                    <option value="adjustment">Stock Audit Audit (±)</option>
                    <option value="damaged">Damaged Garment (-)</option>
                  </select>
                </div>

                {/* Adjust Qty */}
                <div className="space-y-1">
                  <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Quantity Affected</label>
                  <input
                    id="adjust-qty-input"
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Adjust Reason */}
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">Explanation / Audit Text Reason *</label>
                <textarea
                  id="adjust-reason-input"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Procured 20 pieces from Vittorio Sartorial Fabrics for festive rack placement"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 focus:outline-none h-20"
                  required
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between font-mono">
                <span className="text-slate-400">Current Stock:</span>
                <span className="font-bold text-amber-500">{adjustProduct.currentStock}</span>
                <span className="text-slate-400">→ Forecasted Stock:</span>
                <span className="font-bold text-amber-300">
                  {adjustProduct.currentStock + adjustQty * (adjustType === 'stock-in' ? 1 : -1)}
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustOpen(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  id="submit-adjust-form"
                  type="submit"
                  className="gold-gradient text-slate-950 px-6 py-2 rounded-lg font-extrabold uppercase tracking-widest"
                >
                  Commit Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Ledger History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-2xl p-6 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">Store Stock Ledger Logs</h3>
                <p className="text-[10px] text-slate-400">Historic record of showroom restocks, retail POS sales, and damage write-offs.</p>
              </div>
              <button
                id="close-history-modal"
                onClick={() => setHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase font-bold text-slate-400">
                    <th className="p-3">Date</th>
                    <th className="p-3">Garment / SKU</th>
                    <th className="p-3">Action</th>
                    <th className="p-3 text-center">Amount</th>
                    <th className="p-3 text-center font-mono">Stock Flow</th>
                    <th className="p-3">Explanation Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inventoryHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No logs created in the ledger.
                      </td>
                    </tr>
                  ) : (
                    inventoryHistory.map((log) => {
                      const isAdd = log.type === 'stock-in';
                      const isDamage = log.type === 'damaged';
                      const isOut = log.type === 'stock-out';

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/20">
                          <td className="p-3 text-slate-500 font-mono whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3">
                            <h5 className="font-bold text-slate-300">{log.productName}</h5>
                          </td>
                          <td className="p-3">
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isAdd ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              isDamage ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              isOut ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            {isAdd ? '+' : '-'}{Math.abs(log.quantity)}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-500">
                            {log.prevStock} → <span className="text-slate-300 font-semibold">{log.newStock}</span>
                          </td>
                          <td className="p-3 text-slate-400 italic font-sans max-w-[200px] truncate" title={log.reason}>
                            {log.reason}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Mini-Modal for Masters */}
      {miniModalType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs" onClick={() => setMiniModalType(null)} />
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h4 className="font-serif text-xs font-bold text-amber-200 uppercase tracking-wide">
                Quick Add {miniModalType}
              </h4>
              <button
                onClick={() => setMiniModalType(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = miniModalValue.trim();
                if (!trimmed) {
                  alert('Please enter a valid value.');
                  return;
                }
                if (miniModalType === 'category') {
                  const item = addCategory(trimmed);
                  setCategory(item.name);
                } else if (miniModalType === 'brand') {
                  const item = addBrand(trimmed);
                  setBrand(item.name);
                } else if (miniModalType === 'size') {
                  const item = addSize(trimmed);
                  setSize(item.name);
                } else if (miniModalType === 'color') {
                  const item = addColor(trimmed);
                  setColor(item.name);
                }
                setMiniModalType(null);
                setMiniModalValue('');
              }}
              className="p-4 space-y-3 text-xs"
            >
              <div className="space-y-1">
                <label className="block text-slate-400 uppercase font-bold text-[9px] tracking-wider">
                  {miniModalType} Name *
                </label>
                <input
                  type="text"
                  value={miniModalValue}
                  onChange={(e) => setMiniModalValue(e.target.value)}
                  placeholder={`e.g. New ${miniModalType}`}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-xs text-slate-200 focus:outline-none placeholder-slate-600 transition"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setMiniModalType(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 gold-gradient text-slate-950 font-bold uppercase tracking-wider rounded-lg transition hover:opacity-90 active:scale-95 shadow-md"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl" id="delete-confirm-dialog">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-serif text-lg font-bold text-slate-100">Delete Record</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This action cannot be undone.
                  <br />
                  Are you sure you want to permanently delete this record{deleteConfirm.recordName ? ` "${deleteConfirm.recordName}"` : ''}?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                id="btn-delete-cancel"
                onClick={() => setDeleteConfirm({ isOpen: false, recordId: null })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-delete-confirm"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/10 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
};
