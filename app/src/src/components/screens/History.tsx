import { Receipt, Calendar, User, Store } from 'lucide-react';
import type { Sale } from '@/types';

interface HistoryProps {
  sales: Sale[];
  formatBoth: (amount: number) => { mkd: string; eur: string };
  locationNames?: Record<string, string>;
}

export function History({ sales, formatBoth, locationNames = {} }: HistoryProps) {
  const sortedSales = [...sales].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getLocationLabel = (loc: string) => locationNames[loc] || loc;

  return (
    <div className="screen bg-slate-50 pb-20">
      <div className="p-4 space-y-3">
        {sortedSales.length > 0 ? (
          sortedSales.map(sale => {
            const formatted = formatBoth(sale.total);
            return (
              <div key={sale.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-indigo-500" />
                    <span className="font-bold">Shitja #{String(sale.id).slice(-5)}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatted.mkd}</p>
                    <p className="text-xs text-slate-400">{formatted.eur}</p>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(sale.date).toLocaleString('sq-AL')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{sale.user}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    <span>{getLocationLabel(sale.location)}</span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Artikujt:</p>
                  <div className="space-y-1">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-slate-700">{item.model} ({item.color}) Nr.{item.size} x{item.qty}</span>
                        <span className="text-slate-500">
                          {(item.price * item.qty).toLocaleString()} ден
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {sale.discount > 0 && (
                  <div className="mt-2 text-emerald-600 text-sm flex justify-between">
                    <span>Zbritje:</span>
                    <span>-{sale.discount.toLocaleString()} ден</span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center text-slate-400 py-12">
            <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nuk ka histori shitjesh</p>
          </div>
        )}
      </div>
    </div>
  );
}
