import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { eventBus } from '../core/events';

interface UIState {
    isSidebarOpen: boolean;
    isProfileDrawerOpen: boolean;
}

interface UIActions {
    setSidebarOpen: (open: boolean) => void;
    setProfileDrawerOpen: (open: boolean) => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    openProfileDrawer: () => void;
    closeProfileDrawer: () => void;
    toggleSidebar: () => void;
}

const UIStateContext = createContext<UIState | undefined>(undefined);
const UIActionsContext = createContext<UIActions | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
    const openProfileDrawer = useCallback(() => setIsProfileDrawerOpen(true), []);
    const closeProfileDrawer = useCallback(() => setIsProfileDrawerOpen(false), []);
    const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

    // Subscribe to ui.closeAllDrawers event (e.g., from notification tap)
    useEffect(() => {
        const unsubscribe = eventBus.on('ui.closeAllDrawers', () => {
            setIsSidebarOpen(false);
            setIsProfileDrawerOpen(false);
        });
        return unsubscribe;
    }, []);

    const state = useMemo(() => ({
        isSidebarOpen,
        isProfileDrawerOpen,
    }), [isSidebarOpen, isProfileDrawerOpen]);

    const actions = useMemo(() => ({
        setSidebarOpen: setIsSidebarOpen,
        setProfileDrawerOpen: setIsProfileDrawerOpen,
        openSidebar,
        closeSidebar,
        openProfileDrawer,
        closeProfileDrawer,
        toggleSidebar,
    }), [openSidebar, closeSidebar, openProfileDrawer, closeProfileDrawer, toggleSidebar]);

    return (
        <UIStateContext.Provider value={state}>
            <UIActionsContext.Provider value={actions}>
                {children}
            </UIActionsContext.Provider>
        </UIStateContext.Provider>
    );
}

export function useUIState() {
    const context = useContext(UIStateContext);
    if (context === undefined) {
        throw new Error('useUIState must be used within a UIProvider');
    }
    return context;
}

export function useUIActions() {
    const context = useContext(UIActionsContext);
    if (context === undefined) {
        throw new Error('useUIActions must be used within a UIProvider');
    }
    return context;
}

// Keep useUI for backward compatibility if needed, but it will cause re-renders
export function useUI() {
    return { ...useUIState(), ...useUIActions() };
}
