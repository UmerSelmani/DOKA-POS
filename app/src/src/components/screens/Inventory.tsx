import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Package, X, Plus, Search, ChevronDown, ChevronUp, Printer, ShoppingCart, Minus, Tag, Trash2, Edit2, Check, Barcode, AlertTriangle } from 'lucide-react';
import type { Product, ProductSize, Category, Discount } from '@/types';

interface InventoryProps {
  products: Product[];
  categories: Category[];
  formatCurrency: (amount: number) => string;
  formatBoth: (amount: number) => { mkd: string; eur: string };
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<{ product: Product; isDuplicate: boolean }> | { product: Product; isDuplicate: boolean };
  onUpdateProduct: (id: number, updates: Partial<Omit<Product, 'id' | 'createdAt'>>) => void;
  onDeleteProduct: (id: number) => void;
  onAddCategory: (name: string, sizeOptions: string[]) => Promise<Category> | Category;
  onDeleteCategory: (id: number) => void | Promise<void>;
  onUpdateCategory: (id: number, name: string, sizeOptions: string[]) => void | Promise<void>;
  onRestock: (productId: number, size: string, quantity: number) => void | Promise<void>;
  isOwner: boolean;
  isBarcodeUsed: (barcode: string, excludeProductId?: number) => boolean;
  cart: { productId: number; model: string; color: string; size: string; barcode: string; price: number; qty: number }[];
  onAddToCart: (product: Product, size: ProductSize) => boolean;
  onUpdateQty: (index: number, delta: number) => void;
  onRemoveFromCart: (index: number) => void;
  discount: Discount | null;
  onApplyDiscount: (type: 'percent' | 'fixed', value: number) => void;
  onRemoveDiscount: () => void;
  onCheckout: () => void;
  location: string;
  locations?: import('@/types').Location[];
  initialFilter?: string | null;
}

interface SizeInput {
  size: string;
  barcode: string;
  quantity: number;
  alertQty: number;
  notAvailable: boolean;
}

type ModalMode = 'new' | 'restock' | 'category' | 'edit';

function buildSizeInputsFromProduct(product: Product, categoryOptions: string[]): SizeInput[] {
  return categoryOptions.map(size => {
    const existing = product.sizes.find(s => s.size === size);
    return existing
      ? { size, barcode: existing.barcode, quantity: existing.quantity, alertQty: existing.alertQty ?? 3, notAvailable: false }
      : { size, barcode: '', quantity: 0, alertQty: 3, notAvailable: true };
  });
}

export function Inventory({
  products, categories, formatCurrency, formatBoth,
  onAddProduct, onUpdateProduct, onDeleteProduct,
  onAddCategory, onDeleteCategory, onUpdateCategory,
  onRestock, isOwner, isBarcodeUsed,
  cart, onAddToCart, onUpdateQty, onRemoveFromCart,
  discount, onApplyDiscount, onRemoveDiscount, onCheckout,
  location, locations = [], initialFilter,
}: InventoryProps) {
  // Returns location-specific qty. If locationQty exists → use it (0 if not set for this loc). 
  // If locationQty is undefined (legacy product) → fall back to global quantity.
  const getLocQty = (s: { quantity: number; locationQty?: Record<string, number> }) =>
    s.locationQty ? (s.locationQty[location] ?? 0) : s.quantity;

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('new');
  const [showCategoryOverlay, setShowCategoryOverlay] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [restockSize, setRestockSize] = useState('');
  const [restockQty, setRestockQty] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(initialFilter === 'lowstock');
  const [registerLocation, setRegisterLocation] = useState<string>(() => location || locations[0]?.id || 'main');
  const [flippedCard, setFlippedCard] = useState<number | null>(null);
  const [sizeInputs, setSizeInputs] = useState<SizeInput[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [barcodeErrors, setBarcodeErrors] = useState<Record<number, string>>({});
  const [catName, setCatName] = useState('');
  const [catSizes, setCatSizes] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [newModel, setNewModel] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Barcode scan
  const [showScanner, setShowScanner] = useState(false);
  const [scanQuery, setScanQuery] = useState('');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  let discountAmount = 0;
  if (discount) discountAmount = discount.type === 'percent' ? subtotal * discount.value / 100 : discount.value;
  const total = Math.max(0, subtotal - discountAmount);

  const filteredProducts = products.filter(p => {
    if (lowStockOnly) {
      const hasLow = p.sizes.some(s => {
        const qty = getLocQty(s);
        return qty <= (s.alertQty ?? 3) && qty >= 0;
      });
      if (!hasLow) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.color.toLowerCase().includes(q) ||
      p.sizes.some(s => s.barcode.toLowerCase().includes(q))
    );
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCategorySelect = (catId: number, keepExisting = false) => {
    setSelectedCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      if (keepExisting && editingProduct) {
        setSizeInputs(buildSizeInputsFromProduct(editingProduct, cat.sizeOptions));
      } else {
        setSizeInputs(cat.sizeOptions.map(s => ({ size: s, barcode: '', quantity: 0, alertQty: 3, notAvailable: false })));
      }
    }
  };

  const validateBarcodes = (excludeId?: number): boolean => {
    const errors: Record<number, string> = {};
    const seenInForm: string[] = [];
    sizeInputs.forEach((si, i) => {
      if (si.notAvailable || !si.barcode) return;
      const b = si.barcode.trim();
      if (seenInForm.includes(b)) {
        errors[i] = 'Barkod i dyfishtë në formular';
      } else if (isBarcodeUsed(b, excludeId)) {
        errors[i] = 'Ky barkod është i zënë';
      } else {
        seenInForm.push(b);
      }
    });
    setBarcodeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openModal = (mode: ModalMode) => {
    setModalMode(mode);
    setRegisterLocation(location || locations[0]?.id || 'main');
    setShowModal(true);
    setShowAddMenu(false);
    setPhotoPreview(null);
    setSelectedProductId(null);
    setRestockSize('');
    setRestockQty(1);
    setSizeInputs([]);
    setSelectedCategoryId(null);
    setDuplicateWarning(null);
    setBarcodeErrors({});
    setNewModel(''); setNewColor(''); setNewCode(''); setNewPrice(''); setNewCost('');
    setCatName(''); setCatSizes(''); setEditCatId(null);
    setEditingProduct(null);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setModalMode('edit');
    setShowModal(true);
    setShowAddMenu(false);
    setFlippedCard(null);
    setDuplicateWarning(null);
    setBarcodeErrors({});
    setNewModel(product.model);
    setNewColor(product.color === '-' ? '' : product.color);
    setNewCode(product.code);
    setNewPrice(String(product.price));
    setNewCost(String(product.cost));
    setPhotoPreview(product.photo);
    // find category
    const cat = categories.find(c => c.id === product.categoryId) ||
                 categories.find(c => c.name === product.type);
    if (cat) {
      setSelectedCategoryId(cat.id);
      setSizeInputs(buildSizeInputsFromProduct(product, cat.sizeOptions));
    } else {
      setSelectedCategoryId(null);
      setSizeInputs(product.sizes.map(s => ({ size: s.size, barcode: s.barcode, quantity: s.quantity, alertQty: s.alertQty ?? 3, notAvailable: false })));
    }
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) { alert('Ju lutem zgjidhni një kategori'); return; }
    if (!validateBarcodes()) return;
    const cat = categories.find(c => c.id === selectedCategoryId);
    const validSizes = sizeInputs.filter(s => !s.notAvailable && s.barcode);
    if (validSizes.length === 0) { alert('Ju lutem shtoni të paktën një numër me barkod'); return; }
    const totalQty = validSizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const result = await onAddProduct({
      model: newModel, color: newColor || '-', type: cat?.name || 'Përgjithshëm',
      categoryId: selectedCategoryId, code: newCode,
      price: parseInt(newPrice) || 0, cost: parseInt(newCost) || 0,
      sizes: validSizes.map(s => ({
        size: s.size, barcode: s.barcode,
        quantity: Number(s.quantity) || 0,
        alertQty: Number(s.alertQty) || 3,
        locationQty: { [registerLocation]: Number(s.quantity) || 0 },
      })),
      stock: { [registerLocation]: totalQty }, photo: photoPreview,
    });
    if (result.isDuplicate) {
      setDuplicateWarning(`Artikulli me kodin "${newCode}" dhe ngjyrën "${newColor || '-'}" ekziston tashmë! Përdorni "Furnizo" për të shtuar stok.`);
      return;
    }
    setShowModal(false);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!validateBarcodes(editingProduct.id)) return;
    const cat = categories.find(c => c.id === selectedCategoryId);
    const validSizes = sizeInputs.filter(s => !s.notAvailable && s.barcode);
    if (validSizes.length === 0) { alert('Ju lutem shtoni të paktën një numër me barkod'); return; }
    await onUpdateProduct(editingProduct.id, {
      model: newModel, color: newColor || '-',
      type: cat?.name || editingProduct.type,
      categoryId: selectedCategoryId ?? editingProduct.categoryId,
      code: newCode, price: parseInt(newPrice) || 0, cost: parseInt(newCost) || 0,
      sizes: validSizes.map(s => {
        const existing = editingProduct?.sizes.find(es => es.size === s.size);
        return {
          size: s.size, barcode: s.barcode,
          quantity: Number(s.quantity) || 0,
          alertQty: Number(s.alertQty) || 3,
          locationQty: existing?.locationQty || {},
        };
      }),
      stock: editingProduct?.stock || {}, photo: photoPreview,
    });
    setShowModal(false);
  };

  const handleRestock = async () => {
    if (selectedProductId && restockSize && restockQty > 0) {
      await onRestock(selectedProductId, restockSize, restockQty);
      setShowModal(false);
      setSelectedProductId(null); setRestockSize(''); setRestockQty(1);
    }
  };

  const handleSaveCategory = async () => {
    if (!catName.trim() || !catSizes.trim()) { alert('Emri dhe numrat janë të detyrueshëm'); return; }
    const sizes = catSizes.split(',').map(s => s.trim()).filter(Boolean);
    if (sizes.length === 0) { alert('Ju lutem vendosni të paktën një numër'); return; }
    if (editCatId) { await onUpdateCategory(editCatId, catName.trim(), sizes); setEditCatId(null); }
    else { await onAddCategory(catName.trim(), sizes); }
    setCatName(''); setCatSizes('');
  };

  const startEditCat = (cat: Category) => {
    setEditCatId(cat.id);
    setCatName(cat.name);
    setCatSizes(cat.sizeOptions.join(', '));
  };

  // Barcode scan handler
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScan = useCallback((value: string) => {
    if (!value.trim()) return;
    stopCamera();
    for (const product of products) {
      const size = product.sizes.find(s => s.barcode === value.trim());
      if (size) {
        onAddToCart(product, size);
        setScanQuery('');
        setShowScanner(false);
        setShowCart(true);
        return;
      }
    }
    setScanQuery('');
    setSearchQuery(value.trim());
    setShowScanner(false);
  }, [products, onAddToCart, stopCamera]);

  const closeScanner = useCallback(() => {
    stopCamera();
    setShowScanner(false);
    setScanQuery('');
    setCameraError('');
  }, [stopCamera]);

  // Start camera scanning
  useEffect(() => {
    if (!showScanner || scanMode !== 'camera') return;
    let cancelled = false;

    const startCamera = async () => {
      try {
        setCameraError('');
        setScanning(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Try BarcodeDetector API
        if ('BarcodeDetector' in window) {
          // @ts-ignore
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'data_matrix']
          });
          const detect = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                handleScan(barcodes[0].rawValue);
                return;
              }
            } catch (_) {}
            animFrameRef.current = requestAnimationFrame(detect);
          };
          animFrameRef.current = requestAnimationFrame(detect);
        } else {
          // BarcodeDetector not available — fall back to manual
          setCameraError('Kamera u hap. Skanerit automatik nuk mbështetet — shkruani barkodin manualisht.');
          setScanMode('manual');
          stopCamera();
        }
      } catch (err: any) {
        if (cancelled) return;
        setCameraError('Nuk mund të aksesohet kamera. Përdorni modalitetin manual.');
        setScanMode('manual');
        setScanning(false);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setScanning(false);
    };
  }, [showScanner, scanMode, handleScan, stopCamera]);

  // Focus manual input when switching modes
  useEffect(() => {
    if (showScanner && scanMode === 'manual') {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [showScanner, scanMode]);

  const printLabel = (product: Product) => {
    const date = new Date().toLocaleDateString('sq-AL');
    const html = `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title>Deklaratë - ${product.code} / Декларација - ${product.code}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: white; padding: 15mm; }
  .page { max-width: 180mm; margin: auto; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 16px; font-weight: bold; letter-spacing: 2px; }
  .header p { font-size: 10px; color: #555; margin-top: 2px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 8px; letter-spacing: 0.5px; }
  .field { margin-bottom: 5px; line-height: 1.5; }
  .field label { font-weight: bold; color: #333; }
  .divider { border: none; border-top: 1px dashed #aaa; margin: 14px 0; }
  .barcode-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
  .footer { margin-top: 14px; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 6px; text-align: center; }
  .lang-divider { text-align: center; font-size: 10px; font-weight: bold; color: #888; margin: 14px 0 10px; letter-spacing: 2px; }
  .sizes-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .sizes-table th, .sizes-table td { border: 1px solid #ccc; padding: 3px 6px; text-align: center; font-size: 10px; }
  .sizes-table th { background: #f0f0f0; font-weight: bold; }
  .input-line { display: inline-block; border-bottom: 1px solid #000; min-width: 60px; padding: 0 2px; }
  @media print { body { padding: 10mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>DOKA POS</h1>
    <p>Palma Mall / Tetovë &nbsp;|&nbsp; Deklaratë Produkti / Декларација за Производ</p>
  </div>

  <!-- ALBANIAN -->
  <div class="section">
    <div class="section-title">🇦🇱 Shqip</div>
    <p style="margin-bottom:8px; font-size:10px;">
      Kjo deklaratë lëshohet në përputhje me rregulloret për mbrojtjen e konsumatorit në Republikën e Maqedonisë së Veriut.
    </p>
    <div class="field">
      <label>Emri i dyqanit:</label> DOKA, me adresë Palma Mall / Tetovë, deklaron se produkti
      <strong> ${product.type} </strong>(lloji i produktit)
    </div>
    <div class="field"><label>Materiali (përbërja):</label> <span class="input-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div class="field"><label>Madhësia:</label> ${product.sizes.map(s => s.size).join(', ')}</div>
    <div class="field"><label>Ngjyra:</label> ${product.color}</div>
    <div class="field"><label>Çmimi final (me TVSH):</label> ${formatCurrency(product.price)}</div>
    <div class="field"><label>Metoda e pastrimit / mirëmbajtjes:</label> <span class="input-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div class="field"><label>Vendi i origjinës:</label> Turqia &nbsp;&nbsp; <label>Importues:</label> Sabah Cargo</div>
    <div class="field barcode-row"><label>Kodi / Barkodi:</label> <strong>${product.code}</strong>
      &nbsp;|&nbsp; ${product.sizes.map(s => `Nr.${s.size}: ${s.barcode}`).join('  &nbsp; ')}
    </div>
    <p style="margin-top:8px; font-size:9px; color:#555;">
      Me këtë konfirmohet se produkti është i deklaruar në mënyrë të qartë dhe në përputhje me kërkesat ligjore për informimin e konsumatorëve.
    </p>
  </div>

  <hr class="divider">

  <!-- MACEDONIAN -->
  <div class="section">
    <div class="section-title">🇲🇰 Македонски</div>
    <p style="margin-bottom:8px; font-size:10px;">
      Оваа декларација се издава во согласност со прописите за заштита на потрошувачите во Република Северна Македонија.
    </p>
    <div class="field">
      <label>Ime на продавницата:</label> DOKA, со адреса Palma Mall / Тетово, изјавува дека производот
      <strong> ${product.type} </strong>(вид на производот)
    </div>
    <div class="field"><label>Материјал (состав):</label> <span class="input-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div class="field"><label>Големина:</label> ${product.sizes.map(s => s.size).join(', ')}</div>
    <div class="field"><label>Боја:</label> ${product.color}</div>
    <div class="field"><label>Крајна цена (со ДДВ):</label> ${formatCurrency(product.price)}</div>
    <div class="field"><label>Начин на одржување / перење:</label> <span class="input-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div class="field"><label>Земја на потекло:</label> Турција &nbsp;&nbsp; <label>Увозник:</label> Sabah Cargo</div>
    <div class="field barcode-row"><label>Код / Баркод:</label> <strong>${product.code}</strong>
      &nbsp;|&nbsp; ${product.sizes.map(s => `Бр.${s.size}: ${s.barcode}`).join('  &nbsp; ')}
    </div>
    <p style="margin-top:8px; font-size:9px; color:#555;">
      Со ова се потврдува дека производот е јасно декларiran и во согласност со законските барања за информирање на потрошувачите.
    </p>
  </div>

  <!-- Sizes table -->
  <div class="section">
    <div class="section-title">Numrat / Големини</div>
    <table class="sizes-table">
      <thead><tr><th>Nr / Бр</th><th>Barcode</th><th>Sasi / Количина</th></tr></thead>
      <tbody>
        ${product.sizes.map(s => `<tr><td><strong>${s.size}</strong></td><td>${s.barcode}</td><td>${s.locationQty ? (s.locationQty[location] || 0) : s.quantity}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Printuar / Испечатено: ${date} &nbsp;|&nbsp; DOKA POS &nbsp;|&nbsp; Palma Mall / Tetovë
  </div>
</div>
</body></html>`;
    // Use hidden iframe to avoid closing the app on mobile/PWA
    const existingFrame = document.getElementById('doka-print-frame');
    if (existingFrame) existingFrame.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'doka-print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 2000);
      }, 500);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const updateSizeBarcode = (index: number, barcode: string) => {
    setSizeInputs(prev => prev.map((s, i) => i === index ? { ...s, barcode } : s));
    setBarcodeErrors(prev => { const n = { ...prev }; delete n[index]; return n; });
  };

  };

  const sizeInputGridJsx = selectedCategoryId && sizeInputs.length > 0 ? (
    <div className="border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="grid gap-2 mb-1" style={{ gridTemplateColumns: '2.5rem 1fr 3.5rem 3.5rem 2rem' }}>
        <span /><span className="text-[10px] font-bold text-slate-400 uppercase">Barkodi</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Sasi</span>
        <span className="text-[10px] font-bold text-amber-500 uppercase text-center">Alert</span>
        <span />
      </div>
      {sizeInputs.map((si, index) => (
        <div key={si.size + index} className={`space-y-1 transition-opacity ${si.notAvailable ? 'opacity-40' : ''}`}>
          <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2.5rem 1fr 3.5rem 3.5rem 2rem' }}>
            <span className="font-bold text-sm text-center bg-slate-100 rounded-lg py-2">{si.size}</span>
            <input type="text" value={si.barcode}
              onChange={e => updateSizeBarcode(index, e.target.value)}
              className={`input text-xs ${barcodeErrors[index] ? 'border-red-400 bg-red-50' : ''}`} style={{padding:"8px"}}
              placeholder="Barkodi" disabled={si.notAvailable} />
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={si.quantity === 0 ? '' : si.quantity}
              onChange={e => setSizeInputs(prev => prev.map((s, i) => i === index ? { ...s, quantity: parseInt(e.target.value) || 0 } : s))}
              className="input text-xs" style={{padding:"8px"}} placeholder="Sasi" disabled={si.notAvailable} />
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={si.alertQty === 0 ? '' : si.alertQty}
              onChange={e => setSizeInputs(prev => prev.map((s, i) => i === index ? { ...s, alertQty: parseInt(e.target.value) || 0 } : s))}
              className="input text-xs border-amber-200 bg-amber-50" style={{padding:"8px"}} placeholder="Alert" disabled={si.notAvailable}
              title="Sasia minimale para paralajmërimit" />
            <button type="button" title="Ky numër nuk ekziston"
              onClick={() => setSizeInputs(prev => prev.map((s, i) => i === index ? { ...s, notAvailable: !s.notAvailable, barcode: '', quantity: 0 } : s))}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border-2 transition-colors ${si.notAvailable ? 'border-red-400 bg-red-100 text-red-600' : 'border-slate-200 text-slate-400 hover:border-red-300'}`}>
              /
            </button>
          </div>
          {barcodeErrors[index] && (
            <p className="text-xs text-red-500 flex items-center gap-1 ml-10">
              <AlertTriangle className="w-3 h-3" /> {barcodeErrors[index]}
            </p>
          )}
        </div>
      ))}
      <p className="text-[10px] text-slate-400 mt-1">Kliko "/" nëse ky numër nuk ekziston për këtë artikull</p>
    </div>
  ) : null;

  const ProductForm = ({ isEdit }: { isEdit?: boolean }) => (
    <form onSubmit={isEdit ? handleSubmitEdit : handleSubmitNew} className="space-y-4">
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {duplicateWarning}
        </div>
      )}
      <input value={newModel} onChange={e => setNewModel(e.target.value)} type="text" className="input" placeholder="Modeli *" required />
      <div className="grid grid-cols-2 gap-3">
        <input value={newColor} onChange={e => setNewColor(e.target.value)} type="text" className="input" placeholder="Ngjyra" />
        <input value={newCode} onChange={e => { setNewCode(e.target.value); setDuplicateWarning(null); }} type="text" className="input" placeholder="Kodi *" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={newPrice} onChange={e => setNewPrice(e.target.value.replace(/[^0-9]/g, ''))} type="text" inputMode="numeric" pattern="[0-9]*" className="input" placeholder="Çmimi (ден) *" required />
        <input value={newCost} onChange={e => setNewCost(e.target.value.replace(/[^0-9]/g, ''))} type="text" inputMode="numeric" pattern="[0-9]*" className="input" placeholder="Kosto (ден)" />
      </div>

      {/* Category */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">Kategoria *</label>
        {categories.length === 0 ? (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center">
            <Tag className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">Nuk ka kategori. Krijoni një para se të shtoni artikuj.</p>
            <button type="button" onClick={() => setShowCategoryOverlay(true)} className="btn btn-primary py-2 text-sm">+ Krijo Kategori</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {categories.map(cat => (
              <button type="button" key={cat.id} onClick={() => handleCategorySelect(cat.id, isEdit)}
                className={`p-3 rounded-xl text-sm font-semibold border-2 transition-colors ${selectedCategoryId === cat.id ? 'border-slate-800 bg-slate-50 text-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                {cat.name}
                <p className="text-[10px] font-normal text-slate-400 mt-0.5">{cat.sizeOptions.length} numra</p>
              </button>
            ))}
            <button type="button" onClick={() => setShowCategoryOverlay(true)}
              className="p-3 rounded-xl text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400">
              + Kategori e Re
            </button>
          </div>
        )}
      </div>

      {sizeInputGridJsx}

      {/* Photo */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer bg-slate-50 hover:bg-slate-100"
        onClick={() => document.getElementById('productPhoto')?.click()}>
        {photoPreview ? (
          <img src={photoPreview} alt="Preview" className="w-full h-36 object-cover rounded-lg" />
        ) : (
          <>
            <Camera className="w-8 h-8 text-slate-400 mx-auto mb-1" />
            <p className="text-sm text-slate-600 font-medium">Shto / Ndrysho Foton</p>
          </>
        )}
        <input type="file" id="productPhoto" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
      </div>
      {photoPreview && (
        <button type="button" onClick={() => setPhotoPreview(null)} className="text-xs text-red-500 font-medium flex items-center gap-1">
          <X className="w-3 h-3" /> Hiq foton
        </button>
      )}

      {/* Register location selector - only when adding new */}
      {!isEdit && locations.length > 1 && (
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Regjistro në Lokacion</label>
          <div className="grid grid-cols-2 gap-2">
            {locations.sort((a, b) => a.order - b.order).map(loc => (
              <button type="button" key={loc.id}
                onClick={() => setRegisterLocation(loc.id)}
                className={`p-3 rounded-xl text-sm font-semibold border-2 transition-colors flex items-center gap-2 ${registerLocation === loc.id ? 'border-slate-800 bg-slate-50 text-slate-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                <span>{loc.type === 'warehouse' ? '🏭' : '🏪'}</span>
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary flex-1">{isEdit ? 'Ruaj Ndryshimet' : 'Ruaj Artikullin'}</button>
        {isEdit && editingProduct && (
          <button type="button" onClick={() => { if (confirm(`Fshi artikullin "${editingProduct.model}"?`)) { onDeleteProduct(editingProduct.id); setShowModal(false); } }}
            className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-200">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="screen bg-slate-50 pb-24">
      {/* Search + Scanner + Cart */}
      <div className="p-4 bg-white border-b border-slate-100 sticky top-0 z-10 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input pl-12" placeholder="Kërko ose skano..." />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Scanner button */}
        <button onClick={() => { setShowScanner(true); setScanMode('camera'); setCameraError(''); setScanQuery(''); }}
          className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
          <Barcode className="w-5 h-5" />
        </button>
        {/* Cart button */}
        <button onClick={() => setShowCart(true)} className="relative w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white flex-shrink-0">
          <ShoppingCart className="w-5 h-5" />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{cartCount}</span>}
        </button>
      </div>

      {/* Low stock filter banner */}
      {lowStockOnly && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Duke shfaqur vetëm artikujt me stok të ulët
          </span>
          <button onClick={() => setLowStockOnly(false)} className="text-xs text-red-500 font-bold underline">Pastro</button>
        </div>
      )}

      {/* Add Buttons - Owner Only */}
      {isOwner && (
        <div className="p-4">
          <div className="relative">
            <button onClick={() => setShowAddMenu(!showAddMenu)} className="btn btn-primary flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> Shto {showAddMenu ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAddMenu && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-20">
                <button onClick={() => openModal('new')} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-emerald-600" /></div>
                  <div><p className="font-semibold text-slate-800">Model i Ri</p><p className="text-xs text-slate-500">Shto artikull të ri</p></div>
                </button>
                <button onClick={() => openModal('restock')} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4 text-amber-600" /></div>
                  <div><p className="font-semibold text-slate-800">Furnizo</p><p className="text-xs text-slate-500">Shto stok ekzistues</p></div>
                </button>
                <button onClick={() => { openModal('category'); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><Tag className="w-4 h-4 text-purple-600" /></div>
                  <div><p className="font-semibold text-slate-800">Kategorite</p><p className="text-xs text-slate-500">Shto ose ndrysho kategorinë</p></div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="product-grid pb-8">
        {filteredProducts.length > 0 ? filteredProducts.map(product => {
          const totalQty = product.sizes.reduce((sum, s) => sum + (getLocQty(s)), 0);
          const isLow = product.sizes.some(s => { const q = getLocQty(s); return q > 0 && q <= (s.alertQty ?? 3); });
          const isFlipped = flippedCard === product.id;
          return (
            <div key={product.id} className="relative cursor-pointer" style={{ perspective: '1000px', height: '220px' }}
              onClick={() => setFlippedCard(isFlipped ? null : product.id)}>
              <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transition: 'transform 0.4s ease', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* Front */}
                <div className="absolute inset-0 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100" style={{ backfaceVisibility: 'hidden' }}>
                  <div className="h-32 bg-slate-100 flex items-center justify-center relative">
                    {product.photo ? <img src={product.photo} alt={product.model} className="w-full h-full object-cover" /> : <Package className="w-10 h-10 text-slate-400" />}
                    {isLow && <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">STOK I ULËT</span>}
                    <span className="absolute bottom-2 right-2 bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalQty}</span>
                    <span className="absolute bottom-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{product.type}</span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-indigo-600 font-bold">{product.code}</p>
                    <h4 className="font-bold text-sm truncate">{product.model}</h4>
                    <p className="text-xs text-slate-500">{product.color}</p>
                    <p className="font-bold text-indigo-600 mt-1">{formatCurrency(product.price)}</p>
                  </div>
                </div>
                {/* Back */}
                <div className="absolute inset-0 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div className="p-3 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="text-xs text-indigo-600 font-bold">{product.code}</p>
                        <p className="text-xs text-slate-500">{product.model} · {product.color}</p>
                      </div>
                      <div className="flex gap-1">
                        {isOwner && (
                          <button onClick={e => { e.stopPropagation(); openEditModal(product); }}
                            className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-200">
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {isOwner && (
                          <button onClick={e => { e.stopPropagation(); printLabel(product); }}
                            className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200">
                            <Printer className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-600 mb-2">Kliko numrin → shporta:</p>
                    <div className="flex-1 overflow-y-auto">
                      {product.sizes.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">Nuk ka numra</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1">
                          {product.sizes.map(s => (
                            <button key={s.size}
                              onClick={e => { e.stopPropagation(); const lq = getLocQty(s); if (lq > 0) onAddToCart(product, s); }}
                              disabled={(getLocQty(s)) < 1}
                              className={`flex justify-between items-center text-xs rounded-lg p-2 transition-all active:scale-95 ${(getLocQty(s)) < 1 ? 'bg-slate-50 opacity-40 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 cursor-pointer'}`}>
                              <span className="font-bold text-slate-700">{s.size}</span>
                              <span className={`font-bold ${(getLocQty(s)) <= (s.alertQty ?? 3) ? 'text-red-500' : 'text-emerald-600'}`}>{getLocQty(s)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1 text-center">↩ Kliko kartën për t'u kthyer</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-2 text-center text-slate-400 py-12">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nuk ka artikuj</p>
            {isOwner && <p className="text-sm">Shtoni produktet tuaja</p>}
          </div>
        )}
      </div>

      {/* ===== CATEGORY OVERLAY (layered on top of product form) ===== */}
      {showCategoryOverlay && (
        <div className="modal" style={{ zIndex: 400 }}>
          <div className="modal-backdrop" onPointerDown={() => setShowCategoryOverlay(false)} />
          <div className="modal-content" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Kategorite</h3>
              <button onClick={() => setShowCategoryOverlay(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {categories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-700">Kategorite Ekzistuese</p>
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-start justify-between bg-slate-50 rounded-xl p-3">
                      {editCatId === cat.id ? (
                        <div className="flex-1 space-y-2">
                          <input value={catName} onChange={e => setCatName(e.target.value)} className="input text-sm" placeholder="Emri i kategorisë" />
                          <input value={catSizes} onChange={e => setCatSizes(e.target.value)} className="input text-sm" placeholder="Numrat e ndarë me presje" />
                          <div className="flex gap-2">
                            <button onClick={handleSaveCategory} className="btn btn-primary py-2 text-sm flex-1">Ruaj</button>
                            <button onClick={() => { setEditCatId(null); setCatName(''); setCatSizes(''); }} className="btn py-2 text-sm flex-1 bg-slate-200 text-slate-700">Anulo</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="font-bold text-slate-700 text-sm">{cat.name}</p>
                            <p className="text-xs text-slate-500">{cat.sizeOptions.join(', ')}</p>
                          </div>
                          <div className="flex gap-2 ml-2">
                            <button onClick={() => { setEditCatId(cat.id); setCatName(cat.name); setCatSizes(cat.sizeOptions.join(', ')); }}
                              className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => { if (confirm('Fshi kategorinë?')) onDeleteCategory(cat.id); }}
                              className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-bold text-slate-700 mb-3">Kategori e Re</p>
                <div className="space-y-3">
                  <input value={editCatId ? '' : catName} onChange={e => setCatName(e.target.value)} className="input" placeholder="Emri, p.sh. Këpucë, Rroba, Texans..." />
                  <input value={editCatId ? '' : catSizes} onChange={e => setCatSizes(e.target.value)} className="input" placeholder="Numrat e ndarë me presje: 39, 40, 41, 42..." />
                  <button onClick={async () => {
                    await handleSaveCategory();
                    setShowCategoryOverlay(false);
                  }} className="btn btn-primary">Shto Kategorinë</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== BARCODE SCANNER POPUP ===== */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Camera view */}
          {scanMode === 'camera' && (
            <div className="relative flex-1 flex flex-col">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay playsInline muted
              />
              {/* Overlay */}
              <div className="absolute inset-0 flex flex-col">
                {/* Top bar */}
                <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/60 to-transparent">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-amber-400" /> Skano Barkodin
                  </h3>
                  <button onClick={closeScanner} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
                {/* Scan frame */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative w-64 h-40">
                    <div className="absolute inset-0 border-2 border-amber-400 rounded-xl opacity-80" />
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                    {scanning && (
                      <div className="absolute left-2 right-2 h-0.5 bg-amber-400 opacity-80 animate-bounce" style={{ top: '50%' }} />
                    )}
                  </div>
                </div>
                {/* Bottom bar */}
                <div className="p-4 bg-gradient-to-t from-black/70 to-transparent flex flex-col gap-3">
                  {cameraError && (
                    <p className="text-amber-300 text-sm text-center">{cameraError}</p>
                  )}
                  <p className="text-white/70 text-sm text-center">Drejtoni kamerën drejt barkodit</p>
                  <button onClick={() => { stopCamera(); setScanMode('manual'); }}
                    className="w-full py-3 bg-white/20 rounded-xl text-white font-semibold text-sm">
                    Kalo te modaliteti manual
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual input mode */}
          {scanMode === 'manual' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900">
              <div className="w-full max-w-sm bg-white rounded-3xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-amber-500" /> Shkruaj Barkodin
                  </h3>
                  <button onClick={closeScanner} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                {cameraError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">{cameraError}</div>
                )}
                <p className="text-sm text-slate-500 mb-4">Shkruani barkodin ose skanoni me lexues fizik:</p>
                <div className="relative mb-4">
                  <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={scanInputRef}
                    type="text" value={scanQuery}
                    onChange={e => setScanQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleScan(scanQuery); }}
                    className="input pl-12 text-lg tracking-widest"
                    placeholder="Barkodi..."
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setCameraError(''); setScanMode('camera'); }}
                    className="flex-1 py-3 bg-slate-100 rounded-xl text-slate-700 font-semibold text-sm flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" /> Kamera
                  </button>
                  <button onClick={() => handleScan(scanQuery)} className="flex-1 btn btn-primary">
                    Kërko
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CART POPUP ===== */}
      {showCart && (
        <div className="fixed inset-0 flex flex-col" style={{ background: 'rgba(15,23,42,0.6)', zIndex: 150 }}>
          <div className="flex-1" onClick={() => setShowCart(false)} />
          <div className="bg-white rounded-t-3xl" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" /> Shporta
                {cartCount > 0 && <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>}
              </h3>
              <button onClick={() => setShowCart(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center text-slate-400 py-10">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Shporta është bosh</p>
                  <p className="text-sm mt-1">Hapni një kartë produkti dhe klikoni numrin</p>
                </div>
              ) : cart.map((item, index) => (
                <div key={`${item.productId}-${item.size}`} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.model}</p>
                    <p className="text-xs text-slate-500">{item.color} · Nr. {item.size}</p>
                    <p className="text-xs text-indigo-600 font-bold">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => onUpdateQty(index, -1)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-600 border border-slate-200"><Minus className="w-3 h-3" /></button>
                    <span className="font-bold w-5 text-center">{item.qty}</span>
                    <button onClick={() => onUpdateQty(index, 1)} className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => onRemoveFromCart(index)} className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-500 ml-1"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-100 space-y-3" style={{ paddingBottom: '16px' }}>
                {!discount && (
                  <div className="flex gap-2">
                    <button onClick={() => { const v = prompt('Zbritje %:'); if (v && !isNaN(Number(v)) && Number(v) > 0) onApplyDiscount('percent', Number(v)); }} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">Zbritje %</button>
                    <button onClick={() => { const v = prompt('Shuma e zbritjes (ден):'); if (v && !isNaN(Number(v)) && Number(v) > 0) onApplyDiscount('fixed', Number(v)); }} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">Shuma Fikse</button>
                  </div>
                )}
                {discount && discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600">
                    <span className="text-sm font-medium">Zbritje</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                      <button onClick={onRemoveDiscount} className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-800">Totali</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-indigo-600 block">{formatBoth(total).mkd}</span>
                    <span className="text-xs text-slate-400">{formatBoth(total).eur}</span>
                  </div>
                </div>
                <button onClick={() => { onCheckout(); setShowCart(false); }} className="btn btn-primary">Përfundo Shitjen</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODALS ===== */}
      {showModal && (
        <div className="modal">
          <div className="modal-backdrop" onPointerDown={() => setShowModal(false)} />
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">
                {modalMode === 'new' ? 'Model i Ri' : modalMode === 'edit' ? `Ndrysho: ${editingProduct?.model}` : modalMode === 'restock' ? 'Furnizo Stokun' : 'Kategorite'}
              </h3>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {modalMode === 'new' && <ProductForm isEdit={false} />}
            {modalMode === 'edit' && <ProductForm isEdit={true} />}

            {/* RESTOCK */}
            {modalMode === 'restock' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Zgjidh Artikullin</label>
                  <div className="product-selector max-h-48">
                    {products.length > 0 ? products.map(product => (
                      <div key={product.id} onClick={() => { setSelectedProductId(product.id); setRestockSize(''); }}
                        className={`product-option ${selectedProductId === product.id ? 'selected' : ''}`}>
                        <p className="font-bold text-sm">{product.code}</p>
                        <p className="text-xs text-slate-500">{product.model} - {product.color}</p>
                      </div>
                    )) : <p className="text-center text-slate-400 py-4">Nuk ka artikuj</p>}
                  </div>
                </div>
                {selectedProduct && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Zgjidh Numrin</label>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedProduct.sizes.map(s => (
                        <button key={s.size} onClick={() => setRestockSize(s.size)}
                          className={`p-3 rounded-xl text-sm font-bold transition-colors ${restockSize === s.size ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                          {s.size}<p className="text-[10px] font-normal opacity-70">{getLocQty(s)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {restockSize && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Sasia për numrin {restockSize}:</label>
                    <input type="number" value={restockQty} onChange={e => setRestockQty(parseInt(e.target.value) || 0)} className="input" placeholder="Sasia" min="1" />
                  </div>
                )}
                <button onClick={handleRestock} disabled={!selectedProductId || !restockSize || restockQty <= 0} className="btn btn-primary disabled:opacity-50">Furnizo Stokun</button>
              </div>
            )}

            {/* CATEGORIES */}
            {modalMode === 'category' && (
              <div className="space-y-4">
                {categories.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-700">Kategorite Ekzistuese</p>
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-start justify-between bg-slate-50 rounded-xl p-3">
                        {editCatId === cat.id ? (
                          <div className="flex-1 space-y-2">
                            <input value={catName} onChange={e => setCatName(e.target.value)} className="input text-sm" placeholder="Emri i kategorisë" />
                            <input value={catSizes} onChange={e => setCatSizes(e.target.value)} className="input text-sm" placeholder="Numrat e ndarë me presje" />
                            <div className="flex gap-2">
                              <button onClick={handleSaveCategory} className="flex-1 bg-indigo-600 text-white rounded-lg py-1.5 text-sm font-semibold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Ruaj</button>
                              <button onClick={() => { setEditCatId(null); setCatName(''); setCatSizes(''); }} className="flex-1 bg-slate-200 text-slate-700 rounded-lg py-1.5 text-sm font-semibold">Anulo</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="font-bold text-sm">{cat.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{cat.sizeOptions.join(', ')}</p>
                            </div>
                            <div className="flex gap-2 ml-3">
                              <button onClick={() => startEditCat(cat)} className="w-7 h-7 bg-slate-200 rounded-lg flex items-center justify-center text-slate-600"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => { if (confirm(`Fshi kategorinë "${cat.name}"?`)) onDeleteCategory(cat.id); }} className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!editCatId && (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-slate-700">Krijo Kategori të Re</p>
                    <input value={catName} onChange={e => setCatName(e.target.value)} className="input" placeholder="Emri, p.sh. Këpucë, Rroba, Texans..." />
                    <div>
                      <input value={catSizes} onChange={e => setCatSizes(e.target.value)} className="input" placeholder="Numrat e ndarë me presje: 39, 40, 41, 42..." />
                      <p className="text-xs text-slate-400 mt-1">Vendosni të gjitha numrat e mundshme për këtë kategori</p>
                    </div>
                    <button onClick={handleSaveCategory} className="btn btn-primary">+ Shto Kategori</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
