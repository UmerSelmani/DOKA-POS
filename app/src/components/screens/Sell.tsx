import { useState, useRef } from 'react';
import { Barcode, Camera, Minus, Plus, Search, X } from 'lucide-react';
import type { Product, ProductSize, Discount } from '@/types';

interface SellProps {
  products: Product[];
  cart: {
    productId: number;
    model: string;
    color: string;
    size: string;
    barcode: string;
    price: number;
    qty: number;
  }[];
  location: string;
  discount: Discount | null;
  formatCurrency: (amount: number, currency?: 'MKD' | 'EUR') => string;
  formatBoth: (amount: number) => { mkd: string; eur: string };
  onAddToCart: (product: Product, size: ProductSize) => boolean;
  onUpdateQty: (index: number, delta: number) => void;
  onApplyDiscount: (type: 'percent' | 'fixed', value: number) => void;
  onRemoveDiscount: () => void;
  onCheckout: () => void;
}

export function Sell({
  products,
  cart,
  discount,
  formatCurrency,
  formatBoth,
  onAddToCart,
  onUpdateQty,
  onApplyDiscount,
  onRemoveDiscount,
  onCheckout
}: SellProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Search by barcode, code, or model
  const filteredProducts = searchQuery.length >= 2
    ? products.filter(p => {
        // Search by barcode in sizes
        const hasBarcode = p.sizes.some(s => s.barcode.includes(searchQuery));
        return hasBarcode || 
               p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               p.model?.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : [];

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setShowResults(value.length >= 2);
    setSelectedProduct(null);
  };

  const handleSelectSize = (product: Product, size: ProductSize) => {
    const success = onAddToCart(product, size);
    if (success) {
      setSearchQuery('');
      setShowResults(false);
      setSelectedProduct(null);
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  const handleScan = () => {
    // Simulate barcode scanning
    if (products.length > 0) {
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      const randomSize = randomProduct.sizes[Math.floor(Math.random() * randomProduct.sizes.length)];
      if (randomSize) {
        handleSelectSize(randomProduct, randomSize);
      }
    }
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  let discountAmount = 0;
  if (discount) {
    discountAmount = discount.type === 'percent' 
      ? subtotal * discount.value / 100 
      : discount.value;
  }
  const total = Math.max(0, subtotal - discountAmount);

  const subtotalFormatted = formatBoth(subtotal);
  const totalFormatted = formatBoth(total);

  return (
    <div className="screen bg-slate-50 flex flex-col">
      {/* Search Bar */}
      <div className="p-4 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-12 pr-12"
            placeholder="Skano barkodin ose kërko..."
          />
          <button
            onClick={handleScan}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results */}
        {showResults && filteredProducts.length > 0 && !selectedProduct && (
          <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-xl max-h-80 overflow-y-auto z-20">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold">{product.code}</p>
                    <p className="text-sm text-slate-600">{product.model}</p>
                    <p className="text-xs text-slate-500">{product.color}</p>
                  </div>
                  <p className="font-bold text-indigo-600">{formatCurrency(product.price)}</p>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Numra: {product.sizes.map(s => `${s.size}(${s.quantity})`).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Size Selection */}
        {selectedProduct && (
          <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-xl p-4 z-20">
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold">Zgjidh numrin:</p>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="text-sm text-slate-500"
              >
                Kthehu
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {selectedProduct.sizes.map(size => (
                <button
                  key={size.size}
                  onClick={() => handleSelectSize(selectedProduct, size)}
                  disabled={size.quantity < 1}
                  className={`p-3 rounded-xl text-sm font-bold transition-colors ${
                    size.quantity < 1
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  {size.size}
                  <p className="text-[10px] font-normal">{size.quantity}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {showResults && filteredProducts.length === 0 && (
          <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-xl p-4 z-20">
            <p className="text-center text-slate-400">Nuk u gjet asnjë produkt</p>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-80">
        {cart.length === 0 ? (
          <div className="text-center text-slate-400 mt-20">
            <Barcode className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Shporta është bosh</p>
            <p className="text-sm mt-1">Skano ose kërko produkte</p>
          </div>
        ) : (
          cart.map((item, index) => (
            <div key={`${item.productId}-${item.size}`} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Barcode className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">{item.model}</p>
                  <p className="text-xs text-slate-500">{item.color} • Nr. {item.size}</p>
                  <p className="text-xs text-slate-400">{item.barcode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onUpdateQty(index, -1)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold w-4 text-center">{item.qty}</span>
                <button
                  onClick={() => onUpdateQty(index, 1)}
                  className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div 
          id="cartSummary" 
          className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-30 max-w-[430px] mx-auto"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-slate-600 text-sm font-medium">Nëntotali</span>
            <div className="text-right">
              <span className="font-bold text-slate-800 block">{subtotalFormatted.mkd}</span>
              <span className="text-xs text-slate-400">{subtotalFormatted.eur}</span>
            </div>
          </div>

          {/* Discount Buttons */}
          {!discount && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => {
                  const value = prompt('Zbritje %:');
                  if (value && !isNaN(Number(value)) && Number(value) > 0) {
                    onApplyDiscount('percent', Number(value));
                  }
                }}
                className="flex-1 py-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Zbritje %
              </button>
              <button
                onClick={() => {
                  const value = prompt('Shuma e zbritjes (ден):');
                  if (value && !isNaN(Number(value)) && Number(value) > 0) {
                    onApplyDiscount('fixed', Number(value));
                  }
                }}
                className="flex-1 py-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Shuma Fikse
              </button>
            </div>
          )}

          {/* Discount Display */}
          {discount && discountAmount > 0 && (
            <div className="flex justify-between items-center mb-3 text-emerald-600">
              <span className="text-sm font-medium">Zbritje</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                <button 
                  onClick={onRemoveDiscount}
                  className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-4 pt-3 border-t border-slate-100">
            <span className="text-lg font-bold text-slate-800">Totali</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-indigo-600 block">{totalFormatted.mkd}</span>
              <span className="text-sm text-slate-400">{totalFormatted.eur}</span>
            </div>
          </div>

          <button onClick={onCheckout} className="btn btn-primary">
            Përfundo Shitjen
          </button>
        </div>
      )}
    </div>
  );
}
