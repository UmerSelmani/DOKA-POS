import { Home, Package, History, BarChart3 } from 'lucide-react';

interface NavigationProps {
  currentScreen: string;
  isOwner: boolean;
  onNavigate: (screen: string) => void;
}

export function Navigation({ currentScreen, isOwner, onNavigate }: NavigationProps) {
  const navItems = [
    { id: 'dashboard', label: 'Kryesorja', icon: Home },
    { id: 'inventory', label: 'Stoku', icon: Package },
    { id: 'history', label: 'Historia', icon: History },
    ...(isOwner ? [{ id: 'analytics', label: 'Analitika', icon: BarChart3 }] : []),
  ];

  return (
    <div className="nav">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`nav-btn ${currentScreen === item.id ? 'active' : ''}`}
        >
          <item.icon className="w-6 h-6" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
