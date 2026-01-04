/**
 * useDiscoveryFilters Hook
 *
 * Manages filter state for Discovery (category, search, sort).
 * Extracted to enable standalone testing and consistent filter behavior
 * across Map and List views.
 *
 * Responsibilities:
 * - Category filter selection
 * - Search query state
 * - Sort option selection
 * - Category label to ID conversion for API
 *
 * Design:
 * - Does NOT modify any existing code
 * - Wraps existing RoomStore selectedCategory state
 * - All existing functionality preserved
 */

import { useState, useCallback, useMemo } from 'react';
import { CATEGORIES } from '../../../../constants';
// Import directly from RoomStore to avoid require cycle with rooms/index.ts
import { useRoomStore, selectSelectedCategory } from '../../../rooms/store/RoomStore';
import { RoomCategory } from '../../../../types';
import type {
    DiscoveryFilters,
    DiscoverySortOption,
    DEFAULT_DISCOVERY_FILTERS,
} from '../../types/discovery.contracts';

// =============================================================================
// Types
// =============================================================================

export interface UseDiscoveryFiltersOptions {
    /** Initial sort option (default: 'distance') */
    initialSortBy?: DiscoverySortOption;
}

export interface UseDiscoveryFiltersReturn extends DiscoveryFilters {
    /** Currently selected category label (e.g., 'Food & Dining') or 'All' */
    categoryLabel: string;
    /** Category ID for API (e.g., 'FOOD') or undefined for 'All' */
    categoryId: RoomCategory | undefined;
    /** Set category by label */
    setCategory: (label: string) => void;
    /** Search query string */
    searchQuery: string;
    /** Set search query */
    setSearchQuery: (query: string) => void;
    /** Current sort option */
    sortBy: DiscoverySortOption;
    /** Set sort option */
    setSortBy: (sort: DiscoverySortOption) => void;
    /** Reset all filters to defaults */
    resetFilters: () => void;
    /** Available category options (labels) */
    categoryOptions: string[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDiscoveryFilters(
    options: UseDiscoveryFiltersOptions = {}
): UseDiscoveryFiltersReturn {
    const { initialSortBy = 'distance' } = options;

    // Use global category state from RoomStore
    const selectedCategory = useRoomStore(selectSelectedCategory);
    const setSelectedCategory = useRoomStore((s) => s.setSelectedCategory);

    // Local state for search and sort (not persisted globally)
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<DiscoverySortOption>(initialSortBy);

    // Convert category label to API-compatible ID
    const categoryId = useMemo((): RoomCategory | undefined => {
        if (selectedCategory === 'All') return undefined;
        const categoryConfig = CATEGORIES.find(c => c.label === selectedCategory);
        return (categoryConfig?.id || selectedCategory) as RoomCategory | undefined;
    }, [selectedCategory]);

    // Get available category options
    const categoryOptions = useMemo(() => {
        return ['All', ...CATEGORIES.map(c => c.label)];
    }, []);

    // Set category (delegates to store)
    const setCategory = useCallback((label: string) => {
        setSelectedCategory(label);
    }, [setSelectedCategory]);

    // Reset all filters
    const resetFilters = useCallback(() => {
        setSelectedCategory('All');
        setSearchQuery('');
        setSortBy('distance');
    }, [setSelectedCategory]);

    return {
        // Category
        category: categoryId,
        categoryLabel: selectedCategory,
        categoryId,
        setCategory,
        categoryOptions,

        // Search
        searchQuery,
        setSearchQuery,

        // Sort
        sortBy,
        setSortBy,

        // Actions
        resetFilters,
    };
}

export default useDiscoveryFilters;
