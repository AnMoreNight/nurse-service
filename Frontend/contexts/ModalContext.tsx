"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertModal } from '@/components/AlertModal';

type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface ModalState {
    isOpen: boolean;
    type: AlertType;
    title?: string;
    message: string;
    onResolve?: (value: boolean) => void;
}

interface ModalContextType {
    showAlert: (message: string, type?: 'info' | 'success' | 'warning' | 'error', title?: string) => Promise<void>;
    showConfirm: (message: string, title?: string) => Promise<boolean>;
}

// Extend window interface for global access
declare global {
    interface Window {
        showModalAlert?: (message: string, type?: 'info' | 'success' | 'warning' | 'error', title?: string) => Promise<void>;
        showModalConfirm?: (message: string, title?: string) => Promise<boolean>;
    }
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [modalState, setModalState] = useState<ModalState>({
        isOpen: false,
        type: 'info',
        message: '',
    });

    const showAlert = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string): Promise<void> => {
        return new Promise((resolve) => {
            setModalState({
                isOpen: true,
                type,
                title,
                message,
                onResolve: () => resolve(),
            });
        });
    }, []);

    const showConfirm = useCallback((message: string, title?: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setModalState({
                isOpen: true,
                type: 'confirm',
                title,
                message,
                onResolve: resolve,
            });
        });
    }, []);

    // Expose functions globally for use outside React context
    React.useEffect(() => {
        window.showModalAlert = showAlert;
        window.showModalConfirm = showConfirm;

        return () => {
            delete window.showModalAlert;
            delete window.showModalConfirm;
        };
    }, [showAlert, showConfirm]);

    const handleConfirm = () => {
        if (modalState.onResolve) {
            modalState.onResolve(true);
        }
        setModalState({ ...modalState, isOpen: false });
    };

    const handleCancel = () => {
        if (modalState.onResolve) {
            modalState.onResolve(false);
        }
        setModalState({ ...modalState, isOpen: false });
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <AlertModal
                isOpen={modalState.isOpen}
                type={modalState.type}
                title={modalState.title}
                message={modalState.message}
                onConfirm={handleConfirm}
                onCancel={modalState.type === 'confirm' ? handleCancel : undefined}
            />
        </ModalContext.Provider>
    );
};
