import { useState } from 'react';
import { Warehouse, Store, Menu, Settings, RefreshCw, LogOut, Package, Plus, BarChart3, Users, Truck, ChevronDown, Edit2, Check, X, Trash2 } from 'lucide-react';
import type { LocationType, CurrencyType, Location } from '@/types';

interface HeaderProps {
  location: LocationType;
  currency: CurrencyType;
  userName: string;
  userRole: string;
  isOwner: boolean;
  locations: Location[];
  onLocationChange: (loc: LocationType) => void;
  onCurrencyToggle: () => void;
  onSync: () => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onAddProduct?: () => void;
  onRestock?: () => void;
  onNavigate?: (screen: string) => void;
  onAddLocation: (name: string, type: 'warehouse' | 'shop') => void;
  onRemoveLocation: (id: string) => void;
  onRenameLocation: (id: string, name: string, type: 'warehouse' | 'shop') => void;
}

export function Header({
  location, currency, userName, userRole, isOwner, locations,
  onLocationChange, onCurrencyToggle, onSync, onLogout,
  onChangePassword, onAddProduct, onRestock, onNavigate,
  onAddLocation, onRemoveLocation, onRenameLocation,
}: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'warehouse' | 'shop'>('shop');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'warehouse' | 'shop'>('shop');

  const currentLoc = locations.find(l => l.id === location) || locations[0];
  const LocationIcon = currentLoc?.type === 'warehouse' ? Warehouse : Store;

  const startEdit = (loc: Location) => {
    setEditingLoc(loc);
    setEditName(loc.name);
    setEditType(loc.type);
  };

  const saveEdit = () => {
    if (editingLoc && editName.trim()) {
      onRenameLocation(editingLoc.id, editName.trim(), editType);
      setEditingLoc(null);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddLocation(newName.trim(), newType);
    setNewName('');
    setNewType('shop');
  };

  return (
    <div className="header">
      {/* Location dropdown */}
      <div className="relative">
        <button onClick={() => setShowLocationDropdown(!showLocationDropdown)} className="flex items-center gap-2 text-slate-700 hover:opacity-80 transition-colors">
          <LocationIcon className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-sm">{currentLoc?.name || location}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
        {showLocationDropdown && (
          <>
            <div className="fixed inset-0 z-40" onPointerDown={() => setShowLocationDropdown(false)} />
            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 min-w-[180px] z-50">
              {locations.sort((a,b) => a.order - b.order).map(loc => {
                const Icon = loc.type === 'warehouse' ? Warehouse : Store;
                return (
                  <button key={loc.id} onClick={() => { onLocationChange(loc.id); setShowLocationDropdown(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${location === loc.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}>
                    <Icon className="w-4 h-4" /><span className="font-medium text-sm">{loc.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Center */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <h1 className="text-xl font-bold text-indigo-600">DOKA POS</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button onClick={onCurrencyToggle} className="badge badge-blue cursor-pointer hover:bg-blue-100 transition-colors">{currency}</button>
        <button onClick={() => setShowMenu(true)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Burger Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setShowMenu(false)} />
          <div className="menu-panel">
            <div className="px-4 py-3 border-b border-slate-100 mb-2">
              <p className="font-bold text-slate-800">{userName}</p>
              <p className="text-xs text-slate-500">{userRole}</p>
            </div>
            <div className="space-y-1">
              {isOwner && onAddProduct && <button onClick={() => { setShowMenu(false); onAddProduct(); }} className="menu-item"><Plus className="w-4 h-4 text-emerald-500" /><span>Model i Ri</span></button>}
              {isOwner && onRestock && <button onClick={() => { setShowMenu(false); onRestock(); }} className="menu-item"><Package className="w-4 h-4 text-amber-500" /><span>Furnizo Stokun</span></button>}
              {isOwner && onNavigate && <button onClick={() => { setShowMenu(false); onNavigate('analytics'); }} className="menu-item"><BarChart3 className="w-4 h-4 text-purple-500" /><span>Raporte</span></button>}
              {isOwner && onNavigate && <button onClick={() => { setShowMenu(false); onNavigate('workers'); }} className="menu-item"><Users className="w-4 h-4 text-blue-500" /><span>Punonjësit</span></button>}
              {isOwner && onNavigate && <button onClick={() => { setShowMenu(false); onNavigate('transfer'); }} className="menu-item"><Truck className="w-4 h-4 text-indigo-500" /><span>Transfer</span></button>}
              <div className="menu-divider" />
              {isOwner && <button onClick={() => { setShowMenu(false); setShowLocationManager(true); }} className="menu-item"><Edit2 className="w-4 h-4 text-orange-500" /><span>Menaxho Lokacionet</span></button>}
              {isOwner && onChangePassword && <button onClick={() => { setShowMenu(false); onChangePassword(); }} className="menu-item"><Settings className="w-4 h-4 text-slate-400" /><span>Ndrysho Fjalëkalimin</span></button>}
              <button onClick={() => { setShowMenu(false); onSync(); }} className="menu-item"><RefreshCw className="w-4 h-4 text-slate-400" /><span>Sinkronizo</span></button>
              <div className="menu-divider" />
              <button onClick={() => { setShowMenu(false); onLogout(); }} className="menu-item danger"><LogOut className="w-4 h-4" /><span>Dilni</span></button>
            </div>
          </div>
        </>
      )}

      {/* Location Manager Modal */}
      {showLocationManager && (
        <div className="modal" style={{ zIndex: 300 }}>
          <div className="modal-backdrop" onPointerDown={() => { setShowLocationManager(false); setEditingLoc(null); }} />
          <div className="modal-content" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Edit2 className="w-5 h-5 text-orange-500" /> Lokacionet</h3>
              <button onPointerDown={() => { setShowLocationManager(false); setEditingLoc(null); }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><X className="w-5 h-5 text-slate-600" /></button>
            </div>

            {/* Existing locations */}
            <div className="space-y-2 mb-6">
              {locations.sort((a,b) => a.order - b.order).map(loc => {
                const Icon = loc.type === 'warehouse' ? Warehouse : Store;
                return (
                  <div key={loc.id} className="bg-slate-50 rounded-xl p-3">
                    {editingLoc?.id === loc.id ? (
                      <div className="space-y-2">
                        <input value={editName} onChange={e => setEditName(e.target.value)} className="input text-sm" placeholder="Emri" autoFocus />
                        <div className="flex gap-2">
                          <button onClick={() => setEditType('warehouse')} className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-1 ${editType === 'warehouse' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                            <Warehouse className="w-3 h-3" /> Magazinë
                          </button>
                          <button onClick={() => setEditType('shop')} className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-1 ${editType === 'shop' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                            <Store className="w-3 h-3" /> Dyqan
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="btn btn-primary py-2 text-sm flex-1 flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Ruaj</button>
                          <button onClick={() => setEditingLoc(null)} className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold">Anulo</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${loc.type === 'warehouse' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                            <Icon className={`w-4 h-4 ${loc.type === 'warehouse' ? 'text-amber-600' : 'text-blue-600'}`} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-700 text-sm">{loc.name}</p>
                            <p className="text-xs text-slate-400">{loc.type === 'warehouse' ? 'Magazinë' : 'Dyqan'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(loc)} className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"><Edit2 className="w-3 h-3" /></button>
                          {locations.length > 1 && (
                            <button onClick={() => { if (confirm(`Fshi "${loc.name}"?`)) { onRemoveLocation(loc.id); if (location === loc.id) onLocationChange(locations.find(l => l.id !== loc.id)!.id); } }}
                              className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-500"><Trash2 className="w-3 h-3" /></button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add new location */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" /> Shto Lokacion të Ri</p>
              <div className="space-y-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} className="input" placeholder="Emri, p.sh. Dyqani 3, Depo B..." />
                <div className="flex gap-2">
                  <button onClick={() => setNewType('warehouse')} className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-2 ${newType === 'warehouse' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                    <Warehouse className="w-4 h-4" /> Magazinë
                  </button>
                  <button onClick={() => setNewType('shop')} className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-2 ${newType === 'shop' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                    <Store className="w-4 h-4" /> Dyqan
                  </button>
                </div>
                <button onClick={handleAdd} disabled={!newName.trim()} className="btn btn-primary flex items-center justify-center gap-2 disabled:opacity-40">
                  <Plus className="w-4 h-4" /> Shto Lokacionin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
