"use client";

import React, { useState } from 'react';
import { RecurrenceScope } from '@/lib/types';

interface RecurrenceScopeModalProps {
  mode: 'update' | 'delete';
  onSelect: (scope: RecurrenceScope) => void;
  onClose: () => void;
}

export const RecurrenceScopeModal: React.FC<RecurrenceScopeModalProps> = ({ mode, onSelect, onClose }) => {
  const [scope, setScope] = useState<RecurrenceScope>('this');

  const title = mode === 'delete' ? '定期的な予定の削除' : '定期的な予定の変更';
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-sm animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-center">
        <div className="p-6 pb-2">
          <h3 className="text-xl font-normal text-gray-800 mb-6">{title}</h3>
          
          <div className="space-y-4">
             <label className="flex items-start gap-3 cursor-pointer group">
                 <div className="pt-1">
                    <input 
                        type="radio" 
                        name="scope" 
                        checked={scope === 'this'} 
                        onChange={() => setScope('this')}
                        className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                 </div>
                 <div>
                     <span className="block text-gray-800 text-base group-hover:text-blue-800">この予定</span>
                 </div>
             </label>

             <label className="flex items-start gap-3 cursor-pointer group">
                 <div className="pt-1">
                    <input 
                        type="radio" 
                        name="scope" 
                        checked={scope === 'following'} 
                        onChange={() => setScope('following')}
                        className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                 </div>
                 <div>
                     <span className="block text-gray-800 text-base group-hover:text-blue-800">これ以降のすべての予定</span>
                 </div>
             </label>
          </div>
        </div>

        <div className="p-6 flex justify-end gap-3 mt-4 pb-safe">
            <button 
                onClick={onClose} 
                className="px-4 py-2 text-blue-600 font-bold hover:bg-blue-50 rounded-lg transition-colors"
            >
                キャンセル
            </button>
            <button 
                onClick={() => onSelect(scope)} 
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition-colors shadow-sm"
            >
                OK
            </button>
        </div>
      </div>
    </div>
  );
};
