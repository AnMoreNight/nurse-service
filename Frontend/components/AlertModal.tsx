"use client";

import React from 'react';
import { AlertCircle, Info, CheckCircle, HelpCircle, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface AlertModalProps {
    isOpen: boolean;
    type: AlertType;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    type,
    title,
    message,
    confirmText = 'OK',
    cancelText = 'キャンセル',
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-12 h-12 text-green-500" />;
            case 'error':
            case 'warning':
                return <AlertCircle className="w-12 h-12 text-red-500" />;
            case 'confirm':
                return <HelpCircle className="w-12 h-12 text-blue-500" />;
            case 'info':
            default:
                return <Info className="w-12 h-12 text-blue-500" />;
        }
    };

    const getDefaultTitle = () => {
        switch (type) {
            case 'success':
                return '成功';
            case 'error':
                return 'エラー';
            case 'warning':
                return '警告';
            case 'confirm':
                return '確認';
            case 'info':
            default:
                return '通知';
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (type === 'confirm' && onCancel) {
                onCancel();
            } else {
                onConfirm();
            }
        }
    };

    return (
        <div
            className="fixed inset-0 bg-white/30 z-[100] flex justify-center items-center p-0 md:p-4 backdrop-blur-md animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md animate-in zoom-in-95 duration-200 flex flex-col justify-center md:justify-start">
                <div className="p-8 flex flex-col items-center text-center">
                    <div className="mb-4">
                        {getIcon()}
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mb-3">
                        {title || getDefaultTitle()}
                    </h3>

                    <p className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
                        {message}
                    </p>
                </div>

                <div className="p-6 flex justify-center gap-3 pb-safe">
                    {type === 'confirm' && onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-6 py-2.5 text-blue-600 font-bold hover:bg-blue-50 rounded-lg transition-colors min-w-[100px]"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`px-6 py-2.5 font-bold rounded-full transition-colors shadow-sm min-w-[100px] ${type === 'error' || type === 'warning'
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
