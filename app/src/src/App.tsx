import { useState, useCallback } from 'react';
import { Login } from '@/components/screens/Login';
import { Dashboard } from '@/components/screens/Dashboard';
import { Inventory } from '@/components/screens/Inventory';
import { Transfer } from '@/components/screens/Transfer';
import { Analytics } from '@/components/screens/Analytics';
import { Workers } from '@/components/screens/Workers';
import { History } from '@/components/screens/History';
import { Header } from '@/components/ui/Header';
import { Navigation } from '@/components/ui/Navigation';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { Toast } from '@/components/ui/Toast';
import { useStore } from '@/hooks/useStore';
import './App.css';

type ScreenType = 'dashboard' | 'inventory' | 'transfer' | 'analytics' | 'workers' | 'history';

function App() {
  const store = useStore();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    const saved = sessionStorage.getItem('doka_screen');
    return (saved as ScreenType) || 'dashboard';
  });
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<import('@/types').Sale | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [loginError, setLoginError] = useState('');

  const showToast = useCallback((message: string) => setToast({ message, visible: true }), []);
  const hideToast = useCallback(() => setToast({ message: '', visible: false }), []);

  const handleLogin = useCallback((role: 'owner' | 'worker', username: string, password: string): boolean => {
    setLoginError('');
    const success = role === 'owner' ? store.authenticateOwner(username, password) : store.authenticateWorker(username, password);
    if (!success) { setLoginError('Përdoruesi ose fjalëkalimi i gabuar'); return false; }
    // Workers default to inventory, owners to dashboard
    const defaultScreen = role === 'worker' ? 'inventory' : 'dashboard';
    setCurrentScreen(defaultScreen as ScreenType);
    sessionStorage.setItem('doka_screen', defaultScreen);
    return true;
  }, [store]);

  const handleLogout = useCallback(() => {
    store.logout(); setCurrentScreen('dashboard'); sessionStorage.removeItem('doka_screen'); showToast('Ju dolët nga sistemi');
  }, [store, showToast]);

  const [inventoryFilter, setInventoryFilter] = useState<string | null>(null);

  const handleNavigate = useCallback((screen: string) => {
    if (screen === 'inventory:lowstock') {
      setCurrentScreen('inventory');
      setInventoryFilter('lowstock');
      sessionStorage.setItem('doka_screen', 'inventory');
    } else {
      if (screen !== 'inventory') setInventoryFilter(null);
      setCurrentScreen(screen as ScreenType);
      sessionStorage.setItem('doka_screen', screen);
    }
  }, []);

  const handleRemoveFromCart = useCallback((index: number) => {
    const item = store.cart[index];
    if (item) store.updateCartQty(index, -item.qty);
  }, [store]);

  const handleCheckout = useCallback(async () => {
    if (store.cart.length === 0) return;
    const items = store.cart.map(c => ({ productId: c.productId, model: c.model, color: c.color, size: c.size, barcode: c.barcode, price: c.price, qty: c.qty }));
    const subtotal = store.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    let discountAmount = 0;
    if (store.discount) discountAmount = store.discount.type === 'percent' ? subtotal * store.discount.value / 100 : store.discount.value;
    const total = Math.max(0, subtotal - discountAmount);
    const sale = await store.createSale(items, subtotal, discountAmount, total);
    setLastSale(sale); setShowReceipt(true); store.clearCart();
    showToast('Shitja u krye me sukses');
  }, [store, showToast]);

  const handleChangePassword = useCallback(() => {
    const newPassword = prompt('Fjalëkalimi i ri (min. 6 karaktere):');
    if (newPassword && newPassword.length >= 6) {
      store.updateOwnerCredentials(store.ownerCredentials.username, newPassword);
      showToast('Fjalëkalimi u ndryshua');
    } else if (newPassword) showToast('Fjalëkalimi duhet të ketë të paktën 6 karaktere');
  }, [store, showToast]);

  const handleSync = useCallback(async () => {
    if (!store.isOnline) { showToast('Jeni offline'); return; }
    await store.syncNow();
    showToast('Të dhënat u sinkronizuan');
  }, [store, showToast]);

  const handleApplyDiscount = useCallback((type: 'percent' | 'fixed', value: number) => store.setDiscount({ type, value }), [store]);
  const handleRemoveDiscount = useCallback(() => store.setDiscount(null), [store]);

  if (store.isLoading) return (
    <div id="root"><div id="app" className="flex items-center justify-center"><div className="spinner" /></div></div>
  );

  if (!store.user) return (
    <div id="root"><div id="app"><Login onLogin={handleLogin} error={loginError} /></div></div>
  );

  return (
    <div id="root">
      <div id="app">
        <Toast message={toast.message} isVisible={toast.visible} onHide={hideToast} />
        {store.syncError && (
          <div className="fixed top-14 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
            <div className="bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto">
              <span>⚠</span> {store.syncError}
              <button onClick={() => store.setSyncError(null)} className="ml-1 opacity-70 hover:opacity-100 font-bold">✕</button>
            </div>
          </div>
        )}


        <div className="flex flex-col h-full">
          <Header
            location={store.location} currency={store.currency}
            userName={store.user.name} userRole={store.user.role === 'owner' ? 'Pronar' : 'Punonjës'}
            isOwner={store.user.role === 'owner'}
            onLocationChange={(loc) => { store.setLocation(loc); }}
            onCurrencyToggle={() => store.setCurrency(store.currency === 'MKD' ? 'EUR' : 'MKD')}
            onSync={handleSync} onLogout={handleLogout}
            onChangePassword={store.user.role === 'owner' ? handleChangePassword : undefined}
            onAddProduct={() => { setCurrentScreen('inventory'); sessionStorage.setItem('doka_screen', 'inventory'); }}
            onRestock={() => { setCurrentScreen('inventory'); sessionStorage.setItem('doka_screen', 'inventory'); }}
            onNavigate={handleNavigate}
            locations={store.locations}
            onAddLocation={store.addLocation}
            onRemoveLocation={store.removeLocation}
            onRenameLocation={store.renameLocation}
          />

          <div className="flex-1 overflow-hidden">
            {currentScreen === 'dashboard' && (
              <Dashboard
                todaySales={store.getTodaySalesTotal()} lowStockCount={store.getLowStockCount()}
                recentSales={store.getTodaySales().slice(-5).reverse()}
                formatBoth={store.formatBoth} isOwner={store.user.role === 'owner'} onNavigate={handleNavigate}
              />
            )}
            {currentScreen === 'inventory' && (
              <Inventory
                products={store.products} categories={store.categories}
                formatCurrency={store.formatCurrency} formatBoth={store.formatBoth}
                onAddProduct={store.addProduct} onUpdateProduct={store.updateProduct}
                onDeleteProduct={store.deleteProduct}
                onAddCategory={store.addCategory} onDeleteCategory={store.deleteCategory}
                onUpdateCategory={store.updateCategory}
                onRestock={store.restockProduct} isOwner={store.user.role === 'owner'}
                location={store.location}
                locations={store.locations}
                initialFilter={inventoryFilter}
                isBarcodeUsed={store.isBarcodeUsed}
                cart={store.cart} onAddToCart={store.addToCart}
                onUpdateQty={store.updateCartQty} onRemoveFromCart={handleRemoveFromCart}
                discount={store.discount} onApplyDiscount={handleApplyDiscount}
                onRemoveDiscount={handleRemoveDiscount} onCheckout={handleCheckout}
              />
            )}
            {currentScreen === 'transfer' && store.user.role === 'owner' && (
              <Transfer products={store.products} onTransfer={store.createTransfer} locationNames={store.locationNames} locations={store.locations} />
            )}
            {currentScreen === 'analytics' && store.user.role === 'owner' && (
              <Analytics sales={store.sales} products={store.products} formatBoth={store.formatBoth} />
            )}
            {currentScreen === 'workers' && store.user.role === 'owner' && (
              <Workers
                workers={store.workers} onAddWorker={store.addWorker}
                onToggleWorker={store.toggleWorker} onDeleteWorker={store.deleteWorker}
                onStartShift={store.startShift} onPauseShift={store.pauseShift}
                onResumeShift={store.resumeShift} onEndShift={store.endShift}
                formatTime={store.formatTime}
                admins={store.admins} onAddAdmin={store.addAdmin}
                onDeleteAdmin={store.deleteAdmin} onUpdateAdmin={store.updateAdmin}
              />
            )}
            {currentScreen === 'history' && (
              <History sales={store.sales} formatBoth={store.formatBoth} locationNames={store.locationNames} />
            )}
          </div>

          <Navigation currentScreen={currentScreen} isOwner={store.user.role === 'owner'} onNavigate={handleNavigate} />
        </div>

        {showReceipt && lastSale && (
          <ReceiptModal sale={lastSale} onClose={() => setShowReceipt(false)} formatBoth={store.formatBoth} />
        )}
      </div>
    </div>
  );
}

export default App;
