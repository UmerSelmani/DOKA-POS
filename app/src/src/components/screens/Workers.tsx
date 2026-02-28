import { useState } from 'react';
import { UserPlus, User, Lock, Eye, EyeOff, Play, Pause, Square, Trash2, X, Clock, Calendar, Shield, Edit2, Check } from 'lucide-react';
import type { Worker } from '@/types';
import type { AdminAccount } from '@/hooks/useStore';

interface WorkersProps {
  workers: Worker[];
  onAddWorker: (worker: Omit<Worker, 'id' | 'shifts' | 'currentShift'>) => Promise<{ worker: unknown; error?: string }> | { worker: unknown; error?: string };
  onToggleWorker: (id: number) => void;
  onDeleteWorker: (id: number) => void;
  onStartShift: (workerId: number) => void;
  onPauseShift: (workerId: number) => void;
  onResumeShift: (workerId: number) => void;
  onEndShift: (workerId: number) => void;
  formatTime: (minutes: number) => string;
  admins: AdminAccount[];
  onAddAdmin: (name: string, username: string, password: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onDeleteAdmin: (id: number) => void | Promise<void>;
  onUpdateAdmin: (id: number, name: string, username: string, password: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
}

type TabType = 'workers' | 'admins';

function UserForm({ onSubmit, onClose, title, submitLabel }: {
  onSubmit: (name: string, username: string, password: string) => boolean | Promise<boolean>;
  onClose: () => void;
  title: string;
  submitLabel: string;
}) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Fjalëkalimet nuk përputhen'); return; }
    if (password.length < 4) { setError('Fjalëkalimi duhet të ketë të paktën 4 karaktere'); return; }
    const ok = await onSubmit(name.trim(), username.trim(), password);
    if (!ok) setError('Ky emër përdoruesi ekziston tashmë');
  };

  return (
    <div className="modal">
      <div className="modal-backdrop" onPointerDown={onClose} />
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input value={name} onChange={e => setName(e.target.value)} type="text" className="input pl-12" placeholder="Emri i Plotë *" required />
          </div>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input value={username} onChange={e => setUsername(e.target.value)} type="text" className="input pl-12" placeholder="Përdoruesi *" required />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} className="input pl-12 pr-12" placeholder="Fjalëkalimi *" required minLength={4} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input value={confirm} onChange={e => setConfirm(e.target.value)} type={showPw ? 'text' : 'password'} className="input pl-12" placeholder="Konfirmo Fjalëkalimin *" required minLength={4} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
          <button type="submit" className="btn btn-primary">{submitLabel}</button>
        </form>
      </div>
    </div>
  );
}

export function Workers({
  workers, onAddWorker, onToggleWorker, onDeleteWorker,
  onStartShift, onPauseShift, onResumeShift, onEndShift, formatTime,
  admins, onAddAdmin, onDeleteAdmin, onUpdateAdmin,
}: WorkersProps) {
  const [tab, setTab] = useState<TabType>('workers');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminAccount | null>(null);
  const [authModal, setAuthModal] = useState<{ workerId: number; action: 'pause' | 'end' } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuthAction = () => {
    if (!authModal) return;
    const worker = workers.find(w => w.id === authModal.workerId);
    if (!worker) return;
    if (authPassword !== worker.password) { setAuthError('Fjalëkalimi i gabuar'); return; }
    if (authModal.action === 'pause') {
      const isPaused = worker.currentShift?.pauses.some(p => !p.end);
      if (isPaused) onResumeShift(worker.id); else onPauseShift(worker.id);
    } else onEndShift(worker.id);
    setAuthModal(null); setAuthPassword(''); setAuthError('');
  };

  const getShiftStatus = (w: Worker) => {
    if (!w.currentShift) return 'not-started';
    return w.currentShift.pauses.some(p => !p.end) ? 'paused' : 'active';
  };

  const calcWorkTime = (w: Worker) => {
    if (!w.currentShift) return 0;
    const now = new Date();
    let mins = Math.floor((now.getTime() - new Date(w.currentShift.startTime).getTime()) / 60000);
    for (const p of w.currentShift.pauses) {
      if (p.end) mins -= Math.floor((new Date(p.end).getTime() - new Date(p.start).getTime()) / 60000);
      else mins -= Math.floor((now.getTime() - new Date(p.start).getTime()) / 60000);
    }
    return Math.max(0, mins);
  };

  return (
    <div className="screen bg-slate-50 pb-20">
      {/* Tabs */}
      <div className="flex bg-white border-b border-slate-100 sticky top-0 z-10">
        <button onClick={() => setTab('workers')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'workers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
          Punonjësit ({workers.length})
        </button>
        <button onClick={() => setTab('admins')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'admins' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
          Administratorët ({admins.length + 1})
        </button>
      </div>

      <div className="p-4">
        {/* ===== WORKERS TAB ===== */}
        {tab === 'workers' && (
          <>
            <div className="card mb-4">
              <button onClick={() => setShowAddWorker(true)} className="btn btn-primary flex items-center justify-center gap-2">
                <UserPlus className="w-5 h-5" /> Shto Punonjës
              </button>
            </div>
            <div className="space-y-3 pb-24">
              {workers.length > 0 ? workers.map(worker => {
                const status = getShiftStatus(worker);
                const workTime = calcWorkTime(worker);
                return (
                  <div key={worker.id} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><User className="w-6 h-6" /></div>
                        <div>
                          <p className="font-bold">{worker.name}</p>
                          <p className="text-xs text-indigo-600">@{worker.username}</p>
                          {!worker.active && <span className="text-xs text-red-500">(Joaktiv)</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => onToggleWorker(worker.id)} className={`p-2 rounded-lg ${worker.active !== false ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                          {worker.active !== false ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                        <button onClick={() => { if (confirm('Fshi punonjësin?')) onDeleteWorker(worker.id); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    {worker.active !== false && (
                      <div className="border-t border-slate-100 pt-3">
                        {status === 'not-started' ? (
                          <button onClick={() => onStartShift(worker.id)} className="w-full py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium flex items-center justify-center gap-2">
                            <Play className="w-4 h-4" /> Fillo Ndërrimin
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-slate-600"><Clock className="w-4 h-4" /><span>Koha: {formatTime(workTime)}</span></div>
                              <div className="flex items-center gap-2 text-slate-500"><Calendar className="w-4 h-4" /><span>Filloi: {new Date(worker.currentShift!.startTime).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}</span></div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setAuthModal({ workerId: worker.id, action: 'pause' })} className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                                {status === 'paused' ? <><Play className="w-4 h-4" /> Vazhdo</> : <><Pause className="w-4 h-4" /> Pushim</>}
                              </button>
                              <button onClick={() => setAuthModal({ workerId: worker.id, action: 'end' })} className="flex-1 py-2 bg-red-100 text-red-700 rounded-lg font-medium flex items-center justify-center gap-2">
                                <Square className="w-4 h-4" /> Mbaro
                              </button>
                            </div>
                          </div>
                        )}
                        {worker.shifts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-500 mb-2">Ndërrimet e fundit:</p>
                            <div className="space-y-1">
                              {worker.shifts.slice(-3).reverse().map((shift, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-slate-600">
                                  <span>{new Date(shift.startTime).toLocaleDateString('sq-AL')}</span>
                                  <span>{formatTime(shift.totalWorkTime)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : <p className="text-center text-slate-400 py-8">Nuk ka punonjës</p>}
            </div>
          </>
        )}

        {/* ===== ADMINS TAB ===== */}
        {tab === 'admins' && (
          <>
            <div className="card mb-4">
              <p className="text-xs text-slate-500 mb-3">Administratorët kanë qasje të plotë si pronari.</p>
              <button onClick={() => setShowAddAdmin(true)} className="btn btn-primary flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" /> Shto Administrator
              </button>
            </div>

            {/* Primary owner (read-only) */}
            <div className="card mb-3 border-2 border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white"><Shield className="w-6 h-6" /></div>
                <div className="flex-1">
                  <p className="font-bold">Pronar Kryesor</p>
                  <p className="text-xs text-indigo-600">Llogaria kryesore e sistemit</p>
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-semibold">Kryesor</span>
              </div>
            </div>

            {/* Additional admins */}
            <div className="space-y-3 pb-24">
              {admins.length > 0 ? admins.map(admin => (
                <div key={admin.id} className="card">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600"><Shield className="w-6 h-6" /></div>
                    <div className="flex-1">
                      <p className="font-bold">{admin.name}</p>
                      <p className="text-xs text-purple-600">@{admin.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditAdmin(admin)} className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm(`Fshi administratorin "${admin.name}"?`)) onDeleteAdmin(admin.id); }} className="p-2 bg-red-100 rounded-lg text-red-500 hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              )) : <p className="text-center text-slate-400 py-4 text-sm">Nuk ka administratorë shtesë</p>}
            </div>
          </>
        )}
      </div>

      {/* Add Worker Modal */}
      {showAddWorker && (
        <UserForm
          title="Punonjës i Ri" submitLabel="Shto Punonjësin"
          onClose={() => setShowAddWorker(false)}
          onSubmit={async (name, username, password) => {
            const r = await onAddWorker({ name, username, password, active: true });
            if (r.error) return false;
            setShowAddWorker(false);
            return true;
          }}
        />
      )}

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <UserForm
          title="Administrator i Ri" submitLabel="Shto Administratorin"
          onClose={() => setShowAddAdmin(false)}
          onSubmit={async (name, username, password) => {
            const r = await onAddAdmin(name, username, password);
            if (r.success) setShowAddAdmin(false);
            return r.success;
          }}
        />
      )}

      {/* Edit Admin Modal */}
      {editAdmin && (
        <div className="modal">
          <div className="modal-backdrop" onPointerDown={() => setEditAdmin(null)} />
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Ndrysho Administratorin</h3>
              <button onClick={() => setEditAdmin(null)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            <EditAdminForm admin={editAdmin} onSubmit={async (name, username, password) => {
              const r = await onUpdateAdmin(editAdmin.id, name, username, password);
              if (r.success) setEditAdmin(null);
              return r.success;
            }} />
          </div>
        </div>
      )}

      {/* Auth Modal for Pause/End */}
      {authModal && (
        <div className="modal">
          <div className="modal-backdrop" onPointerDown={() => setAuthModal(null)} />
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">{authModal.action === 'pause' ? 'Konfirmo Pushimin' : 'Konfirmo Mbarimin'}</h3>
              <button onClick={() => { setAuthModal(null); setAuthPassword(''); setAuthError(''); }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">Vendosni fjalëkalimin e punonjësit:</p>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="input pl-12" placeholder="Fjalëkalimi" autoFocus onKeyDown={e => e.key === 'Enter' && handleAuthAction()} />
              </div>
              {authError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{authError}</div>}
              <button onClick={handleAuthAction} className="btn btn-primary">Konfirmo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditAdminForm({ admin, onSubmit }: { admin: AdminAccount; onSubmit: (name: string, username: string, password: string) => boolean | Promise<boolean> }) {
  const [name, setName] = useState(admin.name);
  const [username, setUsername] = useState(admin.username);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password && password !== confirm) { setError('Fjalëkalimet nuk përputhen'); return; }
    if (password && password.length < 4) { setError('Fjalëkalimi duhet të ketë të paktën 4 karaktere'); return; }
    const ok = await onSubmit(name.trim(), username.trim(), password || admin.password);
    if (!ok) setError('Ky emër përdoruesi ekziston tashmë');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input value={name} onChange={e => setName(e.target.value)} type="text" className="input pl-12" placeholder="Emri i Plotë *" required />
      </div>
      <div className="relative">
        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input value={username} onChange={e => setUsername(e.target.value)} type="text" className="input pl-12" placeholder="Përdoruesi *" required />
      </div>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} className="input pl-12 pr-12" placeholder="Fjalëkalimi i ri (lërë bosh = pa ndryshim)" />
        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
          {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {password && (
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input value={confirm} onChange={e => setConfirm(e.target.value)} type={showPw ? 'text' : 'password'} className="input pl-12" placeholder="Konfirmo fjalëkalimin" />
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      <button type="submit" className="btn btn-primary flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Ruaj Ndryshimet</button>
    </form>
  );
}
