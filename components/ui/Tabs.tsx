import React, { createContext, useContext } from 'react';

const TabsContext = createContext<{ value: string; onValueChange: (value: string) => void } | undefined>(undefined);

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, className = '', children }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ className = '', children }) => {
  return (
    <div className={`flex overflow-x-auto ${className}`}>
      {children}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, className = '', children }) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger debe usarse dentro de un componente Tabs');
  }

  const { value: activeValue, onValueChange } = context;
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      className={`${className} ${isActive ? 'data-[state=active]' : ''}`}
      onClick={() => onValueChange(value)}
      data-state={isActive ? 'active' : 'inactive'}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, className = '', children }) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent debe usarse dentro de un componente Tabs');
  }

  const { value: activeValue } = context;
  
  if (activeValue !== value) {
    return null;
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
};
