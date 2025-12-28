"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, UserAccount, Company, Staff, Visit, ShiftAssignment } from '@/lib/types';
import { MOCK_COMPANIES, MOCK_STAFF, MOCK_VISITS, MOCK_SHIFTS, MOCK_DB_USERS } from '@/lib/constants';

interface AppContextType {
  currentUser: AuthUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  dbUsers: UserAccount[];
  setDbUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  masterCompanies: Company[];
  setMasterCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  masterStaff: Staff[];
  setMasterStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
  masterVisits: Visit[];
  setMasterVisits: React.Dispatch<React.SetStateAction<Visit[]>>;
  masterShifts: ShiftAssignment[];
  setMasterShifts: React.Dispatch<React.SetStateAction<ShiftAssignment[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [dbUsers, setDbUsers] = useState<UserAccount[]>(MOCK_DB_USERS);
  const [masterCompanies, setMasterCompanies] = useState<Company[]>(MOCK_COMPANIES);
  const [masterStaff, setMasterStaff] = useState<Staff[]>(MOCK_STAFF);
  const [masterVisits, setMasterVisits] = useState<Visit[]>(MOCK_VISITS);
  const [masterShifts, setMasterShifts] = useState<ShiftAssignment[]>(MOCK_SHIFTS);

  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      document.cookie = `currentUser=${JSON.stringify(currentUser)}; path=/`;
    } else {
      localStorage.removeItem('currentUser');
      document.cookie = 'currentUser=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }, [currentUser]);

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      dbUsers,
      setDbUsers,
      masterCompanies,
      setMasterCompanies,
      masterStaff,
      setMasterStaff,
      masterVisits,
      setMasterVisits,
      masterShifts,
      setMasterShifts,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
