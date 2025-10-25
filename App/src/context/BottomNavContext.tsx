import React, { createContext, useContext, useState, ReactNode } from 'react';

type ActiveTab = 'home' | 'menu' | 'cart';

interface BottomNavContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const BottomNavContext = createContext<BottomNavContextType | undefined>(undefined);

interface BottomNavProviderProps {
  children: ReactNode;
}

export function BottomNavProvider({ children }: BottomNavProviderProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  return (
    <BottomNavContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNav() {
  const context = useContext(BottomNavContext);
  if (context === undefined) {
    throw new Error('useBottomNav must be used within a BottomNavProvider');
  }
  return context;
}