import { Check, Share2, Download } from 'lucide-react';
import type { Sale } from '@/types';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  formatBoth: (amount: number) => { mkd: string; eur: string };
}

export function ReceiptModal({ sale, onClose, formatBoth }: ReceiptModalProps) {
  if (!sale) return null;

  const subtotalFormatted = formatBoth(sale.subtotal);
  const totalFormatted = formatBoth(sale.total);

  const handleShare = async () => {
    const text = `Fatura Doka #${String(sale.id).padStart(3, '0')}\nTotali: ${totalFormatted.mkd}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Fatura Doka',
          text,
        });
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
      alert('Fatura u kopjua në clipboard');
    }
  };

  const handleDownload = () => {
    const content = `FATURA DOKA
================
Nr: ${String(sale.id).padStart(3, '0')}
Data: ${new Date(sale.date).toLocaleString('sq-AL')}
Shitesi: ${sale.user}
Lokacioni: ${sale.location}

ARTIKUJT:
${sale.items.map(i => `- ${i.model} (${i.color}) Nr.${i.size} x${i.qty}: ${(i.price * i.qty).toLocaleString()} ден`).join('\n')}

Nëntotali: ${sale.subtotal.toLocaleString()} ден
${sale.discount > 0 ? `Zbritje: -${sale.discount.toLocaleString()} ден\n` : ''}
Totali: ${sale.total.toLocaleString()} ден

Faleminderit për blerjen!`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fatura-${String(sale.id).padStart(3, '0')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal">
      <div className="modal-backdrop" onPointerDown={onClose} />
      <div className="bg-white w-full max-w-sm rounded-2xl relative z-10 p-6 max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">Doka</h3>
          <p className="text-xs text-slate-500 mt-1">
            Fatura #{String(sale.id).slice(-5)}
          </p>
          <p className="text-xs text-slate-400">
            {new Date(sale.date).toLocaleString('sq-AL')}
          </p>
        </div>

        {/* Items */}
        <div className="border-t border-b border-dashed border-slate-300 py-4 mb-4 space-y-2">
          {sale.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.model} ({item.color}) Nr.{item.size} x{item.qty}</span>
              <span className="font-bold">{(item.price * item.qty).toLocaleString()} ден</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between">
            <span className="text-slate-600">Nëntotali</span>
            <div className="text-right">
              <span className="font-bold block">{subtotalFormatted.mkd}</span>
              <span className="text-xs text-slate-400">{subtotalFormatted.eur}</span>
            </div>
          </div>
          
          {sale.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Zbritje</span>
              <span className="font-bold">-{sale.discount.toLocaleString()} ден</span>
            </div>
          )}
          
          <div className="flex justify-between text-lg font-bold text-slate-800 pt-3 border-t-2 border-slate-800 mt-3">
            <span>Totali</span>
            <div className="text-right">
              <span className="block">{totalFormatted.mkd}</span>
              <span className="text-sm text-slate-400 font-normal">{totalFormatted.eur}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mb-4">Faleminderit!</p>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleShare}
            className="btn btn-primary flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" />
            Shpërndaj
          </button>
          <button
            onClick={handleDownload}
            className="btn btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Shkarko
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-slate-500 font-medium hover:text-slate-700"
          >
            Mbyll
          </button>
        </div>
      </div>
    </div>
  );
}
