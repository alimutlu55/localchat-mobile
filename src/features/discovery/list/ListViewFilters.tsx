/**
 * ListViewFilters Component
 *
 * Category chips and sort options for the room list view.
 * Styles match the original RoomListView.tsx exactly.
 */

import React, { memo, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { theme } from '../../../core/theme';
import { CategoryFilter } from '../components/CategoryFilter';

// =============================================================================
// Constants
// =============================================================================

// Sort options
const SORT_OPTIONS = ['nearest', 'most-active', 'expiring-soon', 'newest'] as const;
export type ListViewSortOption = typeof SORT_OPTIONS[number];

// =============================================================================
// Types
// =============================================================================

export interface ListViewFiltersProps {
    selectedCategory: string;
    onCategorySelect: (category: string) => void;
    sortBy: ListViewSortOption;
    onSortSelect: (sort: ListViewSortOption) => void;
    showFilters?: boolean;
    onToggleFilters?: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ListViewFilters - Category and sort options
 *
 * Includes:
 * - Horizontal scrolling category chips
 * - Expandable sort options panel
 */
export const ListViewFilters = memo(function ListViewFilters({
    selectedCategory,
    onCategorySelect,
    sortBy,
    onSortSelect,
    showFilters = false,
    onToggleFilters,
}: ListViewFiltersProps) {




    const handleSortPress = useCallback(
        (sort: ListViewSortOption) => {
            onSortSelect(sort);
        },
        [onSortSelect]
    );

    return (
        <>
            {/* Sort Options (when filter visible) */}
            {showFilters && (
                <View style={styles.filterPanel}>
                    <View style={styles.filterRow}>
                        <Text style={styles.filterLabel}>Sort by:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {SORT_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.sortChip, sortBy === option && styles.sortChipSelected]}
                                    onPress={() => handleSortPress(option)}
                                >
                                    <Text
                                        style={[
                                            styles.sortChipText,
                                            sortBy === option && styles.sortChipTextSelected,
                                        ]}
                                    >
                                        {option.replace('-', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Category Chips - Using shared component for single source of truth */}
            <CategoryFilter
                style={styles.categoriesContainer}
                value={selectedCategory}
                onValueChange={onCategorySelect}
            />
        </>
    );
});

// =============================================================================
// Styles - MATCHES ORIGINAL RoomListView.tsx EXACTLY
// =============================================================================

const styles = StyleSheet.create({
    filterPanel: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginRight: 12,
    },
    sortChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: theme.tokens.bg.subtle,
        marginRight: 8,
    },
    sortChipSelected: {
        backgroundColor: '#fff7ed',
    },
    sortChipText: {
        fontSize: 13,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    sortChipTextSelected: {
        fontWeight: '500',
    },
    categoriesContainer: {
        backgroundColor: 'transparent',
    },
});

export default ListViewFilters;
