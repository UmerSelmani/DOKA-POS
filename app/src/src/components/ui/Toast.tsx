import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onHide: () => void;
}

export function Toast({ message, isVisible, onHide }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onHide, 300);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible && !show) return null;

  return (
    <div 
      className={`toast ${show ? 'show' : ''}`}
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: show ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-100px)',
        opacity: show ? 1 : 0,
        transition: 'all 0.3s ease',
        background: '#1e293b',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '50px',
        fontSize: '14px',
        fontWeight: 600,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}
