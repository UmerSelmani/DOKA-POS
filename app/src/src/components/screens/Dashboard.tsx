import { 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart, 
  Package, 
  Truck, 
  BarChart3,
  ChevronRight
} from 'lucide-react';
import type { Sale } from '@/types';

interface DashboardProps {
  todaySales: number;
  lowStockCount: number;
  recentSales: Sale[];
  formatBoth: (amount: number) => { mkd: string; eur: string };
  isOwner: boolean;
  onNavigate: (screen: string) => void;
}

export function Dashboard({ 
  todaySales, 
  lowStockCount, 
  recentSales, 
  formatBoth, 
  isOwner,
  onNavigate 
}: DashboardProps) {
  const todayFormatted = formatBoth(todaySales);

  const actions = [
    { id: 'inventory', label: 'Shitje / Stoku', icon: Package, color: 'bg-indigo-500', visible: true },
    { id: 'history', label: 'Historia', icon: ShoppingCart, color: 'bg-emerald-500', visible: true },
    { id: 'transfer', label: 'Transfer', icon: Truck, color: 'bg-amber-500', visible: isOwner },
    { id: 'analytics', label: 'Raporte', icon: BarChart3, color: 'bg-purple-500', visible: isOwner },
  ];

  return (
    <div className="screen bg-slate-50 pb-20">
      {/* Stats Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-slate-500 font-bold uppercase">Shitjet Sot</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-slate-800">{todayFormatted.mkd}</p>
          <p className="text-xs text-slate-400">{todayFormatted.eur}</p>
        </div>
        <button className="card text-left w-full active:scale-95 transition-transform" onClick={() => onNavigate('inventory:lowstock')}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-slate-500 font-bold uppercase">Stok i Ulët</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{lowStockCount}</p>
          <p className="text-xs text-red-600 flex items-center gap-1">Shiko artikujt <ChevronRight className="w-3 h-3" /></p>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Veprime</h3>
        <div className="grid grid-cols-4 gap-2">
          {actions.filter(a => a.visible).map(action => (
            <button 
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-14 h-14 ${action.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-600">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase">Shitjet e Fundit</h3>
          <button 
            onClick={() => onNavigate('history')}
            className="text-xs text-slate-600 font-bold flex items-center gap-1"
          >
            Shiko të Gjitha
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-3">
          {recentSales.length > 0 ? (
            recentSales.map(sale => {
              const formatted = formatBoth(sale.total);
              return (
                <div key={sale.id} className="card flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">Shitja #{String(sale.id).slice(-5)}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(sale.date).toLocaleTimeString('sq-AL', {hour:'2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatted.mkd}</p>
                    <p className="text-xs text-slate-400">{formatted.eur}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-slate-400 py-8">Nuk ka shitje ende</p>
          )}
        </div>
      </div>
    </div>
  );
}
