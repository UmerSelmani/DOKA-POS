// Doka POS - Type Definitions

export interface SizeOption {
  label: string;
  available: boolean;
}

export interface Category {
  id: number;
  name: string;
  sizeOptions: string[];
  createdAt: string;
}

export interface ProductSize {
  size: string;
  barcode: string;
  quantity: number;             // total across all locations (kept for compat)
  locationQty?: Record<string, number>; // qty per location id
  alertQty?: number;            // low stock alert threshold
}

export interface Product {
  id: number;
  model: string;
  color: string;
  type: string;
  categoryId?: number;
  code: string;
  price: number;
  cost: number;
  sizes: ProductSize[];
  stock: Record<string, number>; // dynamic locations
  photo: string | null;
  createdAt: string;
}

export interface WorkerShift {
  id: number;
  workerId: number;
  startTime: string;
  endTime?: string;
  pauses: { start: string; end?: string }[];
  totalWorkTime: number;
}

export interface Worker {
  id: number;
  name: string;
  username: string;
  password: string;
  active: boolean;
  currentShift?: WorkerShift;
  shifts: WorkerShift[];
}

export interface CartItem {
  productId: number;
  model: string;
  color: string;
  size: string;
  barcode: string;
  price: number;
  qty: number;
}

export interface SaleItem {
  productId: number;
  model: string;
  color: string;
  size: string;
  barcode: string;
  price: number;
  qty: number;
}

export interface Sale {
  id: number;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  location: string;
  user: string;
}

export interface Transfer {
  id: number;
  from: string;
  to: string;
  items: { productId: number; size: string; qty: number }[];
  date: string;
}

export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

export type UserRole = 'owner' | 'worker';

export interface UserData {
  name: string;
  id?: number;
  role: UserRole;
}

// Dynamic locations - no longer a fixed union
export type LocationType = string;

export type CurrencyType = 'MKD' | 'EUR';

export interface Location {
  id: string;     // e.g. 'main', 'shop1', uuid for new ones
  name: string;   // display name
  type: 'warehouse' | 'shop';
  order: number;
}
