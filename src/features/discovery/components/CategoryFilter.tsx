/**
 * CategoryFilter Component
 *
 * Horizontal scrolling category chip filter for room discovery.
 * Extracted from RoomListView for reusability.
 *
 * Features:
 * - Memoized chips to prevent re-renders
 * - Supports "All" + category list
 * - Uses global RoomStore for state
 */

import React, { memo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { theme } from '../../../core/theme';
import { CATEGORIES } from '../../../constants';
import { useRoomStore, selectSelectedCategory } from '../../rooms';

// =============================================================================
// Types
// =============================================================================

export interface CategoryFilterProps {
    /** Custom style for the container */
    style?: object;
    /** External controlled value (optional, uses store by default) */
    value?: string;
    /** External change handler (optional, uses store by default) */
    onValueChange?: (category: string) => void;
}

// Build filter options
const CATEGORY_FILTERS = [
    { label: 'All', emoji: '' },
    ...CATEGORIES.map(cat => ({ label: cat.label, emoji: cat.emoji }))
];

// =============================================================================
// CategoryChip
// =============================================================================

interface CategoryChipProps {
    label: string;
    emoji?: string;
    isSelected: boolean;
    onPress: () => void;
}

const CategoryChip = memo(function CategoryChip({
    label,
    emoji,
    isSelected,
    onPress,
}: CategoryChipProps) {
    return (
        <TouchableOpacity
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {emoji && `${emoji} `}{label}
            </Text>
        </TouchableOpacity>
    );
});

// =============================================================================
// CategoryFilter
// =============================================================================

export function CategoryFilter({
    style,
    value,
    onValueChange,
}: CategoryFilterProps) {
    // Use store state if not controlled
    const storeValue = useRoomStore(selectSelectedCategory);
    const setStoreValue = useRoomStore((state) => state.setSelectedCategory);

    const selectedCategory = value ?? storeValue;
    const handleChange = useCallback((category: string) => {
        if (onValueChange) {
            onValueChange(category);
        } else {
            setStoreValue(category);
        }
    }, [onValueChange, setStoreValue]);

    return (
        <View style={[styles.container, style]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {CATEGORY_FILTERS.map((cat) => (
                    <CategoryChip
                        key={cat.label}
                        label={cat.label}
                        emoji={cat.emoji}
                        isSelected={selectedCategory === cat.label}
                        onPress={() => handleChange(cat.label)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
        backgroundColor: theme.tokens.bg.surface,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.tokens.bg.subtle,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
    },
    chipSelected: {
        backgroundColor: theme.tokens.brand.primary,
        borderColor: theme.tokens.brand.primary,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.tokens.text.secondary,
    },
    chipTextSelected: {
        color: theme.tokens.text.onPrimary,
        fontWeight: '600',
    },
});

export default CategoryFilter;
