import { useMemo } from 'react';
import { TrendingUp, Package, Users, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import type { Sale, Product } from '@/types';

interface AnalyticsProps {
  sales: Sale[];
  products: Product[];
  formatBoth: (amount: number) => { mkd: string; eur: string };
}

export function Analytics({ sales, products, formatBoth }: AnalyticsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todaySales = sales.filter(s => new Date(s.date).toDateString() === today);
    const weekSales = sales.filter(s => new Date(s.date) >= thisWeek);
    const monthSales = sales.filter(s => new Date(s.date) >= thisMonth);

    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const weekTotal = weekSales.reduce((sum, s) => sum + s.total, 0);
    const monthTotal = monthSales.reduce((sum, s) => sum + s.total, 0);
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

    const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.qty, 0), 0);
    
    const avgOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

    const lowStockItems = products.filter(p =>
      p.sizes.some(s => s.quantity <= (s.alertQty ?? 3) && s.quantity >= 0)
    );

    return {
      today: { count: todaySales.length, total: todayTotal },
      week: { count: weekSales.length, total: weekTotal },
      month: { count: monthSales.length, total: monthTotal },
      allTime: { count: sales.length, total: totalRevenue, items: totalItems },
      avgOrderValue,
      lowStockCount: lowStockItems.length,
    };
  }, [sales, products]);

  const StatCard = ({ 
    title, 
    value, 
    subValue, 
    icon: Icon, 
    color 
  }: { 
    title: string; 
    value: string; 
    subValue?: string;
    icon: typeof TrendingUp;
    color: string;
  }) => (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-slate-500 font-bold uppercase">{title}</span>
        <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      {subValue && <p className="text-xs text-slate-400">{subValue}</p>}
    </div>
  );

  if (sales.length === 0) {
    return (
      <div className="screen bg-slate-50 flex items-center justify-center">
        <div className="card text-center py-12 max-w-sm mx-auto">
          <TrendingUp className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="font-bold text-slate-800 text-lg">Nuk ka të dhëna</h3>
          <p className="text-slate-500 text-sm mt-2">Filloni shitjet për analitika</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen bg-slate-50 pb-20">
      <div className="p-4 space-y-4">
        {/* Revenue Stats */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Të Ardhurat</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Sot"
              value={formatBoth(stats.today.total).mkd}
              subValue={`${stats.today.count} shitje`}
              icon={Calendar}
              color="bg-emerald-500"
            />
            <StatCard
              title="Këtë Javë"
              value={formatBoth(stats.week.total).mkd}
              subValue={`${stats.week.count} shitje`}
              icon={TrendingUp}
              color="bg-indigo-500"
            />
            <StatCard
              title="Këtë Muaj"
              value={formatBoth(stats.month.total).mkd}
              subValue={`${stats.month.count} shitje`}
              icon={DollarSign}
              color="bg-purple-500"
            />
            <StatCard
              title="Gjithsej"
              value={formatBoth(stats.allTime.total).mkd}
              subValue={`${stats.allTime.count} shitje`}
              icon={DollarSign}
              color="bg-amber-500"
            />
          </div>
        </div>

        {/* Performance Stats */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Performanca</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Artikuj të Shitur"
              value={stats.allTime.items.toLocaleString()}
              icon={Package}
              color="bg-blue-500"
            />
            <StatCard
              title="Vlera Mesatare"
              value={formatBoth(stats.avgOrderValue).mkd}
              icon={Users}
              color="bg-pink-500"
            />
          </div>
        </div>

        {/* Alerts */}
        {stats.lowStockCount > 0 && (
          <div className="card bg-red-50 border border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-red-800">Stok i Ulët</p>
                <p className="text-sm text-red-600">{stats.lowStockCount} artikuj kanë stok të ulët</p>
              </div>
            </div>
          </div>
        )}

        {/* Top Products */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Produktet më të Shitura</h3>
          <div className="card">
            {(() => {
              const productSales: Record<string, { name: string; code: string; qty: number; revenue: number }> = {};
              sales.forEach(sale => {
                sale.items.forEach(item => {
                  const key = `${item.model}-${item.color}`;
                  if (!productSales[key]) {
                    productSales[key] = { name: item.model, code: '', qty: 0, revenue: 0 };
                  }
                  productSales[key].qty += item.qty;
                  productSales[key].revenue += item.price * item.qty;
                });
              });
              
              const topProducts = Object.values(productSales)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);

              return topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product, idx) => (
                    <div key={product.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-sm">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm">{product.qty} njësi</span>
                        <p className="text-xs text-slate-400">{formatBoth(product.revenue).mkd}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4">Nuk ka të dhëna</p>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
