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
import { CATEGORIES } from '../../../constants';
import { theme } from '../../../core/theme';

// =============================================================================
// Constants
// =============================================================================

// Build category filter options: ['All', 'Food & Dining', 'Events', ...]
const CATEGORY_FILTERS = ['All', ...CATEGORIES.map(cat => cat.label)];

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
// Subcomponents
// =============================================================================

/**
 * CategoryChip - Individual category filter chip
 * Memoized to prevent unnecessary re-renders
 */
const CategoryChip = memo(function CategoryChip({
    label,
    isSelected,
    onPress,
}: {
    label: string;
    isSelected: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text
                style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
});

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
    const handleCategoryPress = useCallback(
        (category: string) => {
            onCategorySelect(category);
        },
        [onCategorySelect]
    );

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

            {/* Category Chips */}
            <View style={styles.categoriesContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesContent}
                >
                    {CATEGORY_FILTERS.map((category) => (
                        <CategoryChip
                            key={category}
                            label={category}
                            isSelected={selectedCategory === category}
                            onPress={() => handleCategoryPress(category)}
                        />
                    ))}
                </ScrollView>
            </View>
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
        color: '#FF6410',
        fontWeight: '500',
    },
    categoriesContainer: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingVertical: 12,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        marginRight: 8,
    },
    categoryChipSelected: {
        backgroundColor: '#FF6410',
    },
    categoryChipText: {
        fontSize: 14,
        color: '#6b7280',
    },
    categoryChipTextSelected: {
        color: '#ffffff',
        fontWeight: '500',
    },
});

export default ListViewFilters;
