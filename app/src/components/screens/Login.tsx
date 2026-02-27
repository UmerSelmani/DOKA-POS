import { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (role: 'owner' | 'worker', username: string, password: string) => boolean;
  error?: string;
}

export function Login({ onLogin, error }: LoginProps) {
  const [activeTab, setActiveTab] = useState<'owner' | 'worker'>('worker');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (!username.trim() || !password.trim()) {
      setLocalError('Ju lutem plotësoni të gjitha fushat');
      return;
    }
    
    const success = onLogin(activeTab, username.trim(), password);
    if (!success) {
      setLocalError('Përdoruesi ose fjalëkalimi i gabuar');
    }
  };

  return (
    <div className="screen gradient-bg flex flex-col justify-center items-center p-6 min-h-full">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-3xl overflow-hidden mb-4 mx-auto shadow-2xl">
          <img src="/doka-logo.png" alt="Doka" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
        </div>
        <h1 className="text-5xl font-bold text-white mb-2">DOKA POS</h1>
        <p className="text-white/80 text-sm">Sistemi i Menaxhimit të Inventarit</p>
      </div>

      {/* Login Form */}
      <div className="w-full max-w-sm">
        {/* Tabs */}
        <div className="flex bg-white/10 rounded-2xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('worker')}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'worker'
                ? 'bg-white text-indigo-600'
                : 'text-white/80 hover:text-white'
            }`}
          >
            Punonjës
          </button>
          <button
            onClick={() => setActiveTab('owner')}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'owner'
                ? 'bg-white text-indigo-600'
                : 'text-white/80 hover:text-white'
            }`}
          >
            Pronar
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Përdoruesi"
              className="input pl-12 pr-4 bg-white text-slate-800 placeholder:text-slate-400"
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Fjalëkalimi"
              className="input pl-12 pr-12 bg-white text-slate-800 placeholder:text-slate-400"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {(localError || error) && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center">
              <p className="text-white text-sm font-medium">{localError || error}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary py-4 text-lg">
            Hyr
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-white/60 text-xs">
            {activeTab === 'owner' 
              ? 'Hyni me kredencialet tuaja të pronarit' 
              : 'Kontaktoni pronarin për kredenciale'}
          </p>
        </div>
      </div>
    </div>
  );
}
