import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Product, Worker, WorkerShift, Sale, Transfer,
  UserData, UserRole, LocationType, CurrencyType, Discount, Category, Location,
} from '@/types';

const RATE = 61;

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'main', name: 'Magazina', type: 'warehouse', order: 0 },
  { id: 'shop1', name: 'Dyqani 1', type: 'shop', order: 1 },
  { id: 'shop2', name: 'Dyqani 2', type: 'shop', order: 2 },
];
const DEFAULT_OWNER = { username: 'admin', password: 'admin123' };

export interface AdminAccount {
  id: number; name: string; username: string; password: string;
}

// DB row converters
function fromDbProduct(r: Record<string, unknown>): Product {
  return {
    id: r.id as number, model: r.model as string, color: r.color as string,
    type: r.type as string, categoryId: r.category_id as number | undefined,
    code: r.code as string, price: r.price as number, cost: r.cost as number,
    sizes: (r.sizes as Product['sizes']) ?? [],
    stock: (r.stock as Product['stock']) ?? { main: 0, shop1: 0, shop2: 0 },
    photo: (r.photo as string | null) ?? null, createdAt: r.created_at as string,
  };
}
function fromDbWorker(r: Record<string, unknown>): Worker {
  return {
    id: r.id as number, name: r.name as string, username: r.username as string,
    password: r.password as string, active: r.active as boolean,
    currentShift: (r.current_shift as WorkerShift | undefined) ?? undefined,
    shifts: (r.shifts as WorkerShift[]) ?? [],
  };
}
function fromDbCategory(r: Record<string, unknown>): Category {
  return {
    id: r.id as number, name: r.name as string,
    sizeOptions: (r.size_options as string[]) ?? [],
    createdAt: r.created_at as string,
  };
}
function fromDbSale(r: Record<string, unknown>): Sale {
  return {
    id: r.id as number, date: r.date as string,
    items: (r.items as Sale['items']) ?? [],
    subtotal: r.subtotal as number, discount: r.discount as number,
    total: r.total as number, location: r.location as string,
    user: r.username as string,
  };
}
function fromDbTransfer(r: Record<string, unknown>): Transfer {
  return {
    id: r.id as number, from: r.from_location as string, to: r.to_location as string,
    items: (r.items as Transfer['items']) ?? [], date: r.date as string,
  };
}

export function useStore() {
  const [user, setUser] = useState<UserData | null>(() => {
    try { return JSON.parse(localStorage.getItem('doka_user') ?? 'null'); } catch { return null; }
  });
  const [location, setLocation] = useState<LocationType>(() => {
    return localStorage.getItem('doka_location') || 'main';
  });
  const [currency, setCurrency] = useState<CurrencyType>('MKD');
  const [cart, setCart] = useState<{ productId: number; model: string; color: string; size: string; barcode: string; price: number; qty: number; }[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [ownerCredentials, setOwnerCredentials] = useState(DEFAULT_OWNER);
  const [categories, setCategories] = useState<Category[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [locationNames, setLocationNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('doka_locs') || 'null') || { main: 'Magazina', shop1: 'Dyqani 1', shop2: 'Dyqani 2' }; }
    catch { return { main: 'Magazina', shop1: 'Dyqani 1', shop2: 'Dyqani 2' }; }
  });
  const [locations, setLocations] = useState<Location[]>(() => {
    try { return JSON.parse(localStorage.getItem('doka_locations') || 'null') || DEFAULT_LOCATIONS; }
    catch { return DEFAULT_LOCATIONS; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);


  // persist session
  useEffect(() => {
    if (user) localStorage.setItem('doka_user', JSON.stringify(user));
    else localStorage.removeItem('doka_user');
  }, [user]);

  // online/offline
  useEffect(() => {
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  // initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [
          { data: prods, error: e1 }, { data: cats, error: e2 }, { data: wkrs, error: e3 },
          { data: sls, error: e4 }, { data: trs, error: e5 }, { data: adms, error: e6 }, { data: stg, error: e7 },
        ] = await Promise.all([
          supabase.from('products').select('*').order('created_at'),
          supabase.from('categories').select('*').order('created_at'),
          supabase.from('workers').select('*').order('created_at'),
          supabase.from('sales').select('*').order('date', { ascending: false }),
          supabase.from('transfers').select('*').order('date', { ascending: false }),
          supabase.from('admins').select('*').order('created_at'),
          supabase.from('settings').select('*'),
        ]);

        // Log any errors for debugging
        const loadErrors = [e1,e2,e3,e4,e5,e6,e7].filter(Boolean);
        if (loadErrors.length > 0) {
          console.error('Supabase load errors:', loadErrors);
          setSyncError('Problem me Supabase: ' + loadErrors[0]!.message);
        }

        if (prods) { setProducts(prods.map(r => fromDbProduct(r as Record<string, unknown>))); localStorage.setItem('doka_prod', JSON.stringify(prods)); }
        if (cats) { setCategories(cats.map(r => fromDbCategory(r as Record<string, unknown>))); localStorage.setItem('doka_cats', JSON.stringify(cats.map(r => fromDbCategory(r as Record<string, unknown>)))); }
        if (wkrs) { const mapped = wkrs.map(r => fromDbWorker(r as Record<string, unknown>)); setWorkers(mapped); localStorage.setItem('doka_work', JSON.stringify(mapped)); }
        if (sls) { const mapped = sls.map(r => fromDbSale(r as Record<string, unknown>)); setSales(mapped); localStorage.setItem('doka_sales', JSON.stringify(mapped)); }
        if (trs) { const mapped = trs.map(r => fromDbTransfer(r as Record<string, unknown>)); setTransfers(mapped); localStorage.setItem('doka_transfers', JSON.stringify(mapped)); }
        if (adms) { setAdmins(adms.map(r => ({ id: r.id as number, name: r.name as string, username: r.username as string, password: r.password as string }))); localStorage.setItem('doka_admins', JSON.stringify(adms)); }
        if (stg) {
          const rows = stg as Record<string, unknown>[];
          const os = rows.find(s => s.key === 'owner_credentials');
          if (os) { setOwnerCredentials(os.value as typeof DEFAULT_OWNER); localStorage.setItem('doka_owner_creds', JSON.stringify(os.value)); }
          const ls = rows.find(s => s.key === 'location_names');
          if (ls) { const lnames = ls.value as Record<string, string>; setLocationNames(lnames); localStorage.setItem('doka_locs', JSON.stringify(lnames)); }
          const locsRow = rows.find(s => s.key === 'locations');
          if (locsRow) { const locs = locsRow.value as Location[]; setLocations(locs); localStorage.setItem('doka_locations', JSON.stringify(locs)); }
        }
        if (loadErrors.length === 0) setSyncError(null);
      } catch (err) {
        console.error('Supabase load failed, offline fallback:', err);
        setSyncError('Offline - duke përdorur të dhënat lokale');
        try {
          const p = localStorage.getItem('doka_prod'); if (p) setProducts(JSON.parse(p));
          const c = localStorage.getItem('doka_cats'); if (c) setCategories(JSON.parse(c));
          const w = localStorage.getItem('doka_work'); if (w) setWorkers(JSON.parse(w));
          const s = localStorage.getItem('doka_sales'); if (s) setSales(JSON.parse(s));
          const tr = localStorage.getItem('doka_transfers'); if (tr) setTransfers(JSON.parse(tr));
          const o = localStorage.getItem('doka_owner_creds'); if (o) setOwnerCredentials(JSON.parse(o));
          const a = localStorage.getItem('doka_admins'); if (a) setAdmins(JSON.parse(a));
          const lc = localStorage.getItem('doka_locs'); if (lc) setLocationNames(JSON.parse(lc));
          const lo = localStorage.getItem('doka_locations'); if (lo) setLocations(JSON.parse(lo));
        } catch { /* ignore */ }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // realtime subscriptions
  useEffect(() => {
    if (isLoading) return;
    const refetch = (table: string, setter: (data: unknown[]) => void, mapper: (r: Record<string, unknown>) => unknown, order = 'created_at') => {
      supabase.from(table).select('*').order(order, order === 'date' ? { ascending: false } : undefined).then(({ data }) => {
        if (data) setter(data.map(r => mapper(r as Record<string, unknown>)) as unknown[]);
      });
    };
    const channel = supabase.channel('doka-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () =>
        refetch('products', d => setProducts(d as Product[]), fromDbProduct))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () =>
        refetch('categories', d => setCategories(d as Category[]), fromDbCategory))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () =>
        refetch('sales', d => setSales(d as Sale[]), fromDbSale, 'date'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, () =>
        refetch('workers', d => setWorkers(d as Worker[]), fromDbWorker))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admins' }, () =>
        supabase.from('admins').select('*').then(({ data }) => {
          if (data) setAdmins(data.map(r => ({ id: r.id as number, name: r.name as string, username: r.username as string, password: r.password as string })));
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () =>
        supabase.from('settings').select('*').then(({ data }) => {
          if (data) {
            const rows = data as Record<string, unknown>[];
            const os = rows.find((s: Record<string, unknown>) => s.key === 'owner_credentials');
            if (os) setOwnerCredentials(os.value as typeof DEFAULT_OWNER);
            const ls = rows.find((s: Record<string, unknown>) => s.key === 'location_names');
            if (ls) { const lnames = ls.value as Record<string, string>; setLocationNames(lnames); localStorage.setItem('doka_locs', JSON.stringify(lnames)); }
            const locsRow = rows.find((s: Record<string, unknown>) => s.key === 'locations');
            if (locsRow) { const locs = locsRow.value as import('@/types').Location[]; setLocations(locs); localStorage.setItem('doka_locations', JSON.stringify(locs)); }
          }
        }))
      .subscribe();
    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [isLoading]);

  // auth
  const login = useCallback((role: UserRole, data: UserData) => setUser({ ...data, role }), []);
  const logout = useCallback(() => { setUser(null); setCart([]); setDiscount(null); localStorage.removeItem('doka_user'); }, []);

  const authenticateOwner = useCallback((username: string, password: string): boolean => {
    if (username === ownerCredentials.username && password === ownerCredentials.password) { login('owner', { name: 'Pronar', role: 'owner' }); return true; }
    const admin = admins.find(a => a.username === username && a.password === password);
    if (admin) { login('owner', { name: admin.name, role: 'owner' }); return true; }
    return false;
  }, [ownerCredentials, admins, login]);

  const authenticateWorker = useCallback((username: string, password: string): boolean => {
    const worker = workers.find(w => w.active !== false && w.username === username && w.password === password);
    if (worker) { login('worker', { name: worker.name, id: worker.id, role: 'worker' }); return true; }
    return false;
  }, [workers, login]);

  const updateOwnerCredentials = useCallback(async (username: string, password: string) => {
    const creds = { username, password };
    setOwnerCredentials(creds);
    await supabase.from('settings').upsert({ key: 'owner_credentials', value: creds });
    localStorage.setItem('doka_owner_creds', JSON.stringify(creds));
  }, []);

  const addLocation = useCallback(async (name: string, type: 'warehouse' | 'shop') => {
    const id = 'loc_' + Date.now();
    const newLoc: Location = { id, name, type, order: locations.length };
    const updated = [...locations, newLoc];
    setLocations(updated);
    localStorage.setItem('doka_locations', JSON.stringify(updated));
    await supabase.from('settings').upsert({ key: 'locations', value: updated });
    return newLoc;
  }, [locations]);

  const removeLocation = useCallback(async (id: string) => {
    // Don't allow removing if only 1 location left
    if (locations.length <= 1) return false;
    const updated = locations.filter(l => l.id !== id).map((l, i) => ({ ...l, order: i }));
    setLocations(updated);
    localStorage.setItem('doka_locations', JSON.stringify(updated));
    await supabase.from('settings').upsert({ key: 'locations', value: updated });
    return true;
  }, [locations]);

  const renameLocation = useCallback(async (id: string, name: string, type: 'warehouse' | 'shop') => {
    const updated = locations.map(l => l.id === id ? { ...l, name, type } : l);
    setLocations(updated);
    localStorage.setItem('doka_locations', JSON.stringify(updated));
    // Also sync locationNames for backward compat
    const names = Object.fromEntries(updated.map(l => [l.id, l.name]));
    setLocationNames(names);
    localStorage.setItem('doka_locs', JSON.stringify(names));
    await Promise.all([
      supabase.from('settings').upsert({ key: 'locations', value: updated }),
      supabase.from('settings').upsert({ key: 'location_names', value: names }),
    ]);
  }, [locations]);

  const updateLocationNames = useCallback(async (names: Record<string, string>) => {
    setLocationNames(names);
    localStorage.setItem('doka_locs', JSON.stringify(names));
    await supabase.from('settings').upsert({ key: 'location_names', value: names });
  }, []);

  // admins
  const addAdmin = useCallback(async (name: string, username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (admins.find(a => a.username === username) || username === ownerCredentials.username)
      return { success: false, error: 'Ky emër përdoruesi ekziston tashmë' };
    const id = Date.now();
    const { error } = await supabase.from('admins').insert({ id, name, username, password });
    if (error) return { success: false, error: error.message };
    setAdmins(prev => [...prev, { id, name, username, password }]);
    return { success: true };
  }, [admins, ownerCredentials]);

  const deleteAdmin = useCallback(async (id: number) => {
    setAdmins(prev => prev.filter(a => a.id !== id));
    await supabase.from('admins').delete().eq('id', id);
  }, []);

  const updateAdmin = useCallback(async (id: number, name: string, username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (admins.find(a => a.username === username && a.id !== id) || username === ownerCredentials.username)
      return { success: false, error: 'Ky emër përdoruesi ekziston tashmë' };
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, name, username, password } : a));
    await supabase.from('admins').update({ name, username, password }).eq('id', id);
    return { success: true };
  }, [admins, ownerCredentials]);

  // categories
  const addCategory = useCallback(async (name: string, sizeOptions: string[]): Promise<Category> => {
    const id = Date.now();
    const cat: Category = { id, name, sizeOptions, createdAt: new Date().toISOString() };
    setCategories(prev => [...prev, cat]);
    const { error } = await supabase.from('categories').insert({ id, name, size_options: sizeOptions });
    if (error) { console.error('❌ addCategory failed:', error); setSyncError('Gabim ruajtje kategorie: ' + error.message); }
    else { console.log('✅ addCategory saved to Supabase:', { id, name }); setSyncError(null); setCategories(prev => { localStorage.setItem('doka_cats', JSON.stringify(prev)); return prev; }); }
    return cat;
  }, []);

  const deleteCategory = useCallback(async (id: number) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { console.error('deleteCategory failed:', error); setSyncError('Gabim fshirje kategorie: ' + error.message); }
    else { setSyncError(null); setCategories(prev => { localStorage.setItem('doka_cats', JSON.stringify(prev)); return prev; }); }
  }, []);

  const updateCategory = useCallback(async (id: number, name: string, sizeOptions: string[]) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name, sizeOptions } : c));
    const { error } = await supabase.from('categories').update({ name, size_options: sizeOptions }).eq('id', id);
    if (error) { console.error('updateCategory failed:', error); setSyncError('Gabim përditësimi kategorie: ' + error.message); }
    else { setSyncError(null); setCategories(prev => { localStorage.setItem('doka_cats', JSON.stringify(prev)); return prev; }); }
  }, []);

  // barcodes
  const getAllBarcodes = useCallback((excludeProductId?: number): string[] =>
    products.filter(p => p.id !== excludeProductId).flatMap(p => p.sizes.map(s => s.barcode)).filter(Boolean)
  , [products]);

  const isBarcodeUsed = useCallback((barcode: string, excludeProductId?: number): boolean =>
    getAllBarcodes(excludeProductId).includes(barcode.trim())
  , [getAllBarcodes]);

  // products
  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'createdAt'>): Promise<{ product: Product; isDuplicate: boolean }> => {
    const existing = products.find(p =>
      p.code.toLowerCase() === product.code.toLowerCase() &&
      p.color.toLowerCase() === (product.color || '-').toLowerCase()
    );
    if (existing) return { product: existing, isDuplicate: true };
    const id = Date.now();
    const newProduct: Product = { ...product, id, createdAt: new Date().toISOString() };
    setProducts(prev => [...prev, newProduct]);
    const { error: prodErr } = await supabase.from('products').insert({
      id, model: product.model, color: product.color, type: product.type,
      category_id: product.categoryId ?? null, code: product.code,
      price: product.price, cost: product.cost, sizes: product.sizes,
      stock: product.stock, photo: product.photo,
    });
    if (prodErr) { console.error('addProduct failed:', prodErr); setSyncError('Gabim ruajtje produkti: ' + prodErr.message); }
    else { setSyncError(null); setProducts(prev => { localStorage.setItem('doka_prod', JSON.stringify(prev)); return prev; }); }
    return { product: newProduct, isDuplicate: false };
  }, [products]);

  const updateProduct = useCallback(async (id: number, updates: Partial<Omit<Product, 'id' | 'createdAt'>>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    // Only send defined fields to avoid overwriting with undefined/null
    const patch: Record<string, unknown> = {};
    if (updates.model !== undefined) patch.model = updates.model;
    if (updates.color !== undefined) patch.color = updates.color;
    if (updates.type !== undefined) patch.type = updates.type;
    if (updates.categoryId !== undefined) patch.category_id = updates.categoryId ?? null;
    if (updates.code !== undefined) patch.code = updates.code;
    if (updates.price !== undefined) patch.price = updates.price;
    if (updates.cost !== undefined) patch.cost = updates.cost;
    if (updates.sizes !== undefined) patch.sizes = updates.sizes;
    if (updates.stock !== undefined) patch.stock = updates.stock;
    if (updates.photo !== undefined) patch.photo = updates.photo;
    const { error: updErr } = await supabase.from('products').update(patch).eq('id', id);
    if (updErr) { console.error('updateProduct failed:', updErr); setSyncError('Gabim përditësimi: ' + updErr.message); }
    else { setSyncError(null); setProducts(prev => { localStorage.setItem('doka_prod', JSON.stringify(prev)); return prev; }); }
  }, []);

  const deleteProduct = useCallback(async (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { console.error('deleteProduct failed:', error); setSyncError('Gabim fshirje produkti: ' + error.message); }
    else { setSyncError(null); setProducts(prev => { localStorage.setItem('doka_prod', JSON.stringify(prev)); return prev; }); }
  }, []);

  const restockProduct = useCallback(async (productId: number, size: string, quantity: number) => {
    let newSizes: import('@/types').ProductSize[] = [];
    let newStock: Record<string, number> = {};
    setProducts(prev => {
      const product = prev.find(p => p.id === productId);
      if (!product) return prev;
      newSizes = product.sizes.map(s => {
        if (s.size !== size) return s;
        const locQty = { ...(s.locationQty || {}), [location]: (s.locationQty?.[location] || 0) + quantity };
        const total = Object.values(locQty).reduce((a, b) => a + b, 0);
        return { ...s, quantity: total, locationQty: locQty };
      });
      newStock = { ...product.stock, [location]: (product.stock[location] || 0) + quantity };
      return prev.map(p => p.id === productId ? { ...p, sizes: newSizes, stock: newStock } : p);
    });
    await new Promise(r => setTimeout(r, 10));
    if (newSizes.length === 0) return;
    const { error } = await supabase.from('products').update({ sizes: newSizes, stock: newStock }).eq('id', productId);
    if (error) { console.error('restockProduct failed:', error); setSyncError('Gabim furnizimi: ' + error.message); }
    else { setSyncError(null); setProducts(prev => { localStorage.setItem('doka_prod', JSON.stringify(prev)); return prev; }); }
  }, [location]);

  const updateProductStock = useCallback(async (productId: number, size: string, delta: number) => {
    // Use functional update to always read fresh state (avoids stale closure in loops)
    let updatedSizes: import('@/types').ProductSize[] = [];
    setProducts(prev => {
      const product = prev.find(p => p.id === productId);
      if (!product) return prev;
      const newSizes = product.sizes.map(s => {
        if (s.size !== size) return s;
        const locQty = { ...(s.locationQty || {}) };
        locQty[location] = Math.max(0, (locQty[location] || 0) + delta);
        const total = Object.values(locQty).reduce((a, b) => a + b, 0);
        return { ...s, quantity: total, locationQty: locQty };
      });
      updatedSizes = newSizes;
      return prev.map(p => p.id === productId ? { ...p, sizes: newSizes } : p);
    });
    // Small delay to ensure state is set before Supabase write
    await new Promise(r => setTimeout(r, 10));
    if (updatedSizes.length > 0) {
      await supabase.from('products').update({ sizes: updatedSizes }).eq('id', productId);
    }
  }, [location]);

  // workers
  const addWorker = useCallback(async (worker: Omit<Worker, 'id' | 'shifts' | 'currentShift'>): Promise<{ worker: Worker | null; error?: string }> => {
    const duplicate = workers.find(w => w.username === worker.username);
    if (duplicate) return { worker: null, error: 'Ky emër përdoruesi ekziston tashmë' };
    const id = Date.now();
    const w: Worker = { ...worker, id, shifts: [], active: true };
    setWorkers(prev => [...prev, w]);
    const { error } = await supabase.from('workers').insert({ id, name: worker.name, username: worker.username, password: worker.password, active: true, shifts: [], current_shift: null });
    if (error) return { worker: null, error: error.message };
    setWorkers(prev => { localStorage.setItem('doka_work', JSON.stringify(prev)); return prev; });
    return { worker: w };
  }, [workers]);

  const toggleWorker = useCallback(async (id: number) => {
    let newActive = false;
    setWorkers(prev => {
      const worker = prev.find(w => w.id === id);
      if (!worker) return prev;
      newActive = !worker.active;
      return prev.map(w => w.id === id ? { ...w, active: newActive } : w);
    });
    await new Promise(r => setTimeout(r, 10));
    await supabase.from('workers').update({ active: newActive }).eq('id', id);
  }, []);

  const deleteWorker = useCallback(async (id: number) => {
    setWorkers(prev => prev.filter(w => w.id !== id));
    await supabase.from('workers').delete().eq('id', id);
  }, []);

  const _syncWorker = useCallback(async (w: Worker) => {
    await supabase.from('workers').update({ current_shift: w.currentShift ?? null, shifts: w.shifts }).eq('id', w.id);
  }, []);

  const startShift = useCallback(async (workerId: number) => {
    const shift: WorkerShift = { id: Date.now(), workerId, startTime: new Date().toISOString(), pauses: [], totalWorkTime: 0 };
    setWorkers(prev => prev.map(w => { if (w.id !== workerId) return w; const u = { ...w, currentShift: shift }; _syncWorker(u); return u; }));
  }, [_syncWorker]);

  const pauseShift = useCallback(async (workerId: number) => {
    setWorkers(prev => prev.map(w => {
      if (w.id !== workerId || !w.currentShift) return w;
      const u = { ...w, currentShift: { ...w.currentShift, pauses: [...w.currentShift.pauses, { start: new Date().toISOString() }] } };
      _syncWorker(u); return u;
    }));
  }, [_syncWorker]);

  const resumeShift = useCallback(async (workerId: number) => {
    setWorkers(prev => prev.map(w => {
      if (w.id !== workerId || !w.currentShift) return w;
      const pauses = [...w.currentShift.pauses];
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: new Date().toISOString() };
      const u = { ...w, currentShift: { ...w.currentShift, pauses } };
      _syncWorker(u); return u;
    }));
  }, [_syncWorker]);

  const endShift = useCallback(async (workerId: number) => {
    const now = new Date();
    setWorkers(prev => prev.map(w => {
      if (w.id !== workerId || !w.currentShift) return w;
      let pauses = w.currentShift.pauses;
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses = [...pauses.slice(0, -1), { ...last, end: now.toISOString() }];
      const total = Math.floor((now.getTime() - new Date(w.currentShift.startTime).getTime()) / 60000);
      const paused = pauses.reduce((s, p) => p.end ? s + Math.floor((new Date(p.end).getTime() - new Date(p.start).getTime()) / 60000) : s, 0);
      const completed: WorkerShift = { ...w.currentShift, pauses, endTime: now.toISOString(), totalWorkTime: Math.max(0, total - paused) };
      const u = { ...w, currentShift: undefined, shifts: [...w.shifts, completed] };
      _syncWorker(u); return u;
    }));
  }, [_syncWorker]);

  // cart
  const addToCart = useCallback((product: Product, size: { size: string; barcode: string; quantity: number; locationQty?: Record<string, number> }) => {
    const locQty = size.locationQty ? (size.locationQty[location] ?? 0) : size.quantity;
    if (locQty < 1) return false;
    setCart(prev => {
      const ex = prev.find(c => c.productId === product.id && c.size === size.size);
      if (ex) { if (ex.qty >= locQty) return prev; return prev.map(c => c.productId === product.id && c.size === size.size ? { ...c, qty: c.qty + 1 } : c); }
      return [...prev, { productId: product.id, model: product.model, color: product.color, size: size.size, barcode: size.barcode, price: product.price, qty: 1 }];
    });
    return true;
  }, [location]);

  const updateCartQty = useCallback((index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index]; if (!item) return prev;
      const product = products.find(p => p.id === item.productId);
      const s = product?.sizes.find(s => s.size === item.size);
      const stock = s ? (s.locationQty ? (s.locationQty[location] ?? 0) : s.quantity) : 0;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== index);
      if (delta > 0 && item.qty >= stock) return prev;
      return prev.map((c, i) => i === index ? { ...c, qty: newQty } : c);
    });
  }, [products, location]);

  const clearCart = useCallback(() => { setCart([]); setDiscount(null); }, []);

  // sales
  const createSale = useCallback(async (items: Sale['items'], subtotal: number, discountAmount: number, total: number) => {
    const id = Date.now();
    const sale: Sale = { id, date: new Date().toISOString(), items, subtotal, discount: discountAmount, total, location, user: user?.name || 'Unknown' };
    setSales(prev => [sale, ...prev]);
    await supabase.from('sales').insert({ id, date: sale.date, items, subtotal, discount: discountAmount, total, location, username: sale.user });

    // Batch all deductions per product to avoid race conditions
    // Group items by productId
    const byProduct = new Map<number, { size: string; qty: number }[]>();
    for (const item of items) {
      const arr = byProduct.get(item.productId) || [];
      arr.push({ size: item.size, qty: item.qty });
      byProduct.set(item.productId, arr);
    }

    // Apply all deductions for each product atomically
    const productUpdates: { id: number; sizes: import('@/types').ProductSize[] }[] = [];
    setProducts(prev => {
      const updated = prev.map(p => {
        const deductions = byProduct.get(p.id);
        if (!deductions) return p;
        const newSizes = p.sizes.map(s => {
          const d = deductions.find(x => x.size === s.size);
          if (!d) return s;
          const locQty = { ...(s.locationQty || {}) };
          locQty[location] = Math.max(0, (locQty[location] || 0) - d.qty);
          const sizeTotal = Object.values(locQty).reduce((a, b) => a + b, 0);
          return { ...s, quantity: sizeTotal, locationQty: locQty };
        });
        productUpdates.push({ id: p.id, sizes: newSizes });
        return { ...p, sizes: newSizes };
      });
      return updated;
    });

    // Persist to Supabase
    await new Promise(r => setTimeout(r, 20));
    await Promise.all(productUpdates.map(u =>
      supabase.from('products').update({ sizes: u.sizes }).eq('id', u.id)
    ));
    return sale;
  }, [location, user]);

  // transfers
  const createTransfer = useCallback(async (fromLoc: LocationType, toLoc: LocationType, items: { productId: number; size: string; qty: number }[]) => {
    // Deduct from 'fromLoc' and add to 'toLoc' — don't use store.location
    const byProduct = new Map<number, { size: string; fromQty: number; toQty: number }[]>();
    for (const item of items) {
      const arr = byProduct.get(item.productId) || [];
      arr.push({ size: item.size, fromQty: -item.qty, toQty: item.qty });
      byProduct.set(item.productId, arr);
    }
    const productUpdates: { id: number; sizes: import('@/types').ProductSize[] }[] = [];
    setProducts(prev => {
      const updated = prev.map(p => {
        const changes = byProduct.get(p.id);
        if (!changes) return p;
        const newSizes = p.sizes.map(s => {
          const c = changes.find(x => x.size === s.size);
          if (!c) return s;
          const locQty = { ...(s.locationQty || {}) };
          locQty[fromLoc] = Math.max(0, (locQty[fromLoc] || 0) + c.fromQty);
          locQty[toLoc] = (locQty[toLoc] || 0) + c.toQty;
          const sizeTotal = Object.values(locQty).reduce((a, b) => a + b, 0);
          return { ...s, quantity: sizeTotal, locationQty: locQty };
        });
        productUpdates.push({ id: p.id, sizes: newSizes });
        return { ...p, sizes: newSizes };
      });
      return updated;
    });
    await new Promise(r => setTimeout(r, 20));
    await Promise.all(productUpdates.map(u =>
      supabase.from('products').update({ sizes: u.sizes }).eq('id', u.id)
    ));
    const id = Date.now();
    const transfer: Transfer = { id, from: fromLoc, to: toLoc, items, date: new Date().toISOString() };
    setTransfers(prev => [transfer, ...prev]);
    await supabase.from('transfers').insert({ id, from_location: fromLoc, to_location: toLoc, items, date: transfer.date });
    return transfer;
  }, []);

  // formatting
  const formatCurrency = useCallback((amount: number, curr?: CurrencyType) => {
    const c = curr || currency;
    return c === 'MKD' ? Math.round(amount).toLocaleString() + ' ден' : '€' + (amount / RATE).toFixed(2);
  }, [currency]);

  const formatBoth = useCallback((amount: number) => ({
    mkd: formatCurrency(amount, 'MKD'), eur: formatCurrency(amount, 'EUR'),
  }), [formatCurrency]);

  const formatTime = useCallback((minutes: number) => {
    const h = Math.floor(minutes / 60), m = minutes % 60; return `${h}h ${m}m`;
  }, []);

  // stats
  const getTodaySales = useCallback(() => {
    const today = new Date().toDateString();
    return sales.filter(s => new Date(s.date).toDateString() === today);
  }, [sales]);
  const getTodaySalesTotal = useCallback(() => getTodaySales().reduce((a, b) => a + b.total, 0), [getTodaySales]);
  const getLowStockCount = useCallback(() => products.filter(p => p.sizes.some(s => { const qty = s.locationQty ? (s.locationQty[location] ?? 0) : s.quantity; return qty <= (s.alertQty ?? 3); })).length, [products, location]);

  const syncNow = useCallback(async () => {
    setPendingSync(true);
    try {
      const [
        { data: prods, error: e1 },
        { data: cats, error: e2 },
        { data: sls, error: e3 },
        { data: wkrs, error: e4 },
        { data: trs, error: e5 },
        { data: adms, error: e6 },
        { data: stg, error: e7 },
      ] = await Promise.all([
        supabase.from('products').select('*').order('created_at'),
        supabase.from('categories').select('*').order('created_at'),
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('workers').select('*').order('created_at'),
        supabase.from('transfers').select('*').order('date', { ascending: false }),
        supabase.from('admins').select('*').order('created_at'),
        supabase.from('settings').select('*'),
      ]);
      const errors = [e1,e2,e3,e4,e5,e6,e7].filter(Boolean);
      if (errors.length > 0) { setSyncError('Sinkronizimi dështoi: ' + errors[0]!.message); return; }
      if (prods) { setProducts(prods.map(r => fromDbProduct(r as Record<string, unknown>))); localStorage.setItem('doka_prod', JSON.stringify(prods)); }
      if (cats) { setCategories(cats.map(r => fromDbCategory(r as Record<string, unknown>))); localStorage.setItem('doka_cats', JSON.stringify(cats.map(r => fromDbCategory(r as Record<string, unknown>)))); }
      if (sls) { const mapped = sls.map(r => fromDbSale(r as Record<string, unknown>)); setSales(mapped); localStorage.setItem('doka_sales', JSON.stringify(mapped)); }
      if (wkrs) { const mapped = wkrs.map(r => fromDbWorker(r as Record<string, unknown>)); setWorkers(mapped); localStorage.setItem('doka_work', JSON.stringify(mapped)); }
      if (trs) setTransfers(trs.map(r => fromDbTransfer(r as Record<string, unknown>)));
      if (adms) setAdmins(adms.map(r => ({ id: r.id as number, name: r.name as string, username: r.username as string, password: r.password as string })));
      if (stg) {
        const rows = stg as Record<string, unknown>[];
        const os = rows.find(s => s.key === 'owner_credentials');
        if (os) setOwnerCredentials(os.value as typeof DEFAULT_OWNER);
        const locsRow = rows.find(s => s.key === 'locations');
        if (locsRow) { const locs = locsRow.value as Location[]; setLocations(locs); localStorage.setItem('doka_locations', JSON.stringify(locs)); }
      }
      setSyncError(null);
    } catch (err) { setSyncError('Sinkronizimi dështoi: ' + String(err)); }
    finally { setPendingSync(false); }
  }, []);

  return {
    user, location, currency, cart, discount, products, workers, sales, transfers,
    categories, admins, pendingSync, isLoading, isOnline, ownerCredentials, syncError,
    setLocation: (loc: LocationType) => { setLocation(loc); localStorage.setItem('doka_location', loc); },
    setCurrency, setDiscount, setPendingSync,
    login, logout, authenticateOwner, authenticateWorker, updateOwnerCredentials,
    addAdmin, deleteAdmin, updateAdmin,
    addCategory, deleteCategory, updateCategory,
    getAllBarcodes, isBarcodeUsed,
    addProduct, updateProduct, deleteProduct, restockProduct, updateProductStock,
    addWorker, toggleWorker, deleteWorker,
    startShift, pauseShift, resumeShift, endShift,
    addToCart, updateCartQty, clearCart,
    createSale, createTransfer,
    formatCurrency, formatBoth, formatTime,
    getTodaySales, getTodaySalesTotal, getLowStockCount,
    syncNow, RATE, locationNames, updateLocationNames, locations, addLocation, removeLocation, renameLocation, setSyncError,
  };
}
