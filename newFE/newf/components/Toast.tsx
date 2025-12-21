"use client";

import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-none">
      <div className="bg-slate-800/90 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-xl flex items-center gap-3 border border-slate-700 pointer-events-auto">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <span className="font-bold text-sm tracking-wide">{message}</span>
        <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
