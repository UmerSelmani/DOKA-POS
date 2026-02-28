import { useState } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import type { Product, LocationType, Location } from '@/types';

interface TransferProps {
  products: Product[];
  onTransfer: (from: LocationType, to: LocationType, items: { productId: number; size: string; qty: number }[]) => void;
  locationNames?: Record<string, string>;
  locations?: Location[];
}

export function Transfer({ products, onTransfer, locationNames = {}, locations: locList = [] }: TransferProps) {
  const [from, setFrom] = useState<LocationType>(() => locList[0]?.id || 'main');
  const [to, setTo] = useState<LocationType>(() => locList[1]?.id || 'shop1');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  const locations: { value: LocationType; label: string }[] = locList.length > 0
    ? locList.sort((a,b) => a.order - b.order).map(l => ({ value: l.id, label: l.name }))
    : [
        { value: 'main', label: locationNames['main'] || 'Magazina' },
        { value: 'shop1', label: locationNames['shop1'] || 'Dyqani 1' },
        { value: 'shop2', label: locationNames['shop2'] || 'Dyqani 2' },
      ];

  // Products with stock in 'from' location
  const availableProducts = products.filter(p =>
    p.sizes.some(s => (s.locationQty?.[from] ?? s.quantity) > 0)
  );

  const handleToggleSize = (productId: number, size: string) => {
    const key = `${productId}|${size}`;
    setSelectedItems(prev => {
      if (prev[key]) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: 1 };
    });
  };

  const getFromQty = (size: { quantity: number; locationQty?: Record<string, number> }) => size.locationQty?.[from] ?? size.quantity;

  const handleQtyChange = (productId: number, size: string, qty: number, maxQty: number) => {
    const key = `${productId}|${size}`;
    const validQty = Math.max(1, Math.min(qty, maxQty));
    setSelectedItems(prev => ({ ...prev, [key]: validQty }));
  };

  const handleTransfer = () => {
    if (from === to) {
      alert('Zgjidh vendndodhje të ndryshme');
      return;
    }

    const items = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [productId, ...sizeParts] = key.split('|'); const size = sizeParts.join('|');
        return { productId: Number(productId), size, qty };
      });

    if (items.length === 0) {
      alert('Zgjidh artikujt');
      return;
    }

    onTransfer(from, to, items);
    setSelectedItems({});
    alert(`${items.length} artikuj u transferuan`);
  };

  return (
    <div className="screen bg-slate-50 pb-20">
      <div className="p-4 space-y-4">
        {/* Transfer Settings */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4">Transfero Mall</h3>
          <div className="space-y-3">
            <select
              value={from}
              onChange={(e) => {
                setFrom(e.target.value as LocationType);
                setSelectedItems({});
              }}
              className="input"
            >
              {locations.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
            <div className="flex justify-center">
              <ArrowDown className="w-6 h-6 text-indigo-500" />
            </div>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value as LocationType)}
              className="input"
            >
              {locations.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products List */}
        <div className="card">
          <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">Zgjidh Artikujt</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availableProducts.length > 0 ? (
              availableProducts.map(product => {
                const isExpanded = expandedProduct === product.id;
                const totalStock = product.sizes.reduce((sum, s) => sum + (s.locationQty?.[from] ?? s.quantity), 0);
                
                return (
                  <div key={product.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Product Header */}
                    <div
                      onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                      className="p-3 bg-slate-50 cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-sm">{product.code}</p>
                        <p className="text-xs text-slate-500">{product.model} - {product.color}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600">{totalStock} copë</span>
                        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* Sizes List */}
                    {isExpanded && (
                      <div className="p-3 space-y-2 border-t border-slate-200">
                        {product.sizes.filter(s => (s.locationQty?.[from] ?? s.quantity) > 0).map(size => {
                          const key = `${product.id}-${size.size}`;
                          const isSelected = !!selectedItems[key];
                          const selectedQty = selectedItems[key] || 1;

                          return (
                            <div
                              key={size.size}
                              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                isSelected ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSize(product.id, size.size)}
                                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label className="flex-1 cursor-pointer">
                                  <p className="font-bold text-sm">Nr. {size.size}</p>
                                  <p className="text-xs text-slate-500">Në dispozicion: {getFromQty(size)}</p>
                                  <p className="text-[10px] text-slate-400">{size.barcode}</p>
                                </label>
                              </div>
                              {isSelected && (
                                <input
                                  type="number"
                                  value={selectedQty}
                                  onChange={(e) => handleQtyChange(product.id, size.size, parseInt(e.target.value) || 1, getFromQty(size))}
                                  min="1"
                                  max={getFromQty(size)}
                                  className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-slate-400 py-4">Nuk ka artikuj me stok</p>
            )}
          </div>

          <button
            onClick={handleTransfer}
            disabled={Object.keys(selectedItems).length === 0}
            className="btn btn-primary mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-5 h-5" />
            Konfirmo Transferin
          </button>
        </div>
      </div>
    </div>
  );
}
