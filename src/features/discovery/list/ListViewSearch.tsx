/**
 * ListViewSearch Component
 *
 * Search input for the room list view with clear button and loading indicator.
 * Styles match the original RoomListView.tsx exactly.
 */

import React, { memo, useRef } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Pressable,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { theme } from '../../../core/theme';

// =============================================================================
// Types
// =============================================================================

export interface ListViewSearchProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    isSearching?: boolean;
    placeholder?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ListViewSearch - Search input component
 *
 * A memoized search input with:
 * - Search icon
 * - Text input
 * - Clear button (when text present)
 * - Loading indicator (when searching)
 */
export const ListViewSearch = memo(function ListViewSearch({
    value,
    onChangeText,
    onClear,
    isSearching = false,
    placeholder = 'Search rooms...',
}: ListViewSearchProps) {
    const inputRef = useRef<TextInput>(null);
    return (
        <Pressable
            style={styles.searchContainer}
            onPress={() => inputRef.current?.focus()}
        >
            <Search size={18} color={theme.tokens.text.tertiary} style={styles.searchIcon} />
            <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor={theme.tokens.text.tertiary}
                value={value}
                onChangeText={onChangeText}
                autoCapitalize="none"
            />
            {value.length > 0 && (
                <TouchableOpacity style={styles.clearButton} onPress={onClear}>
                    <X size={16} color={theme.tokens.text.tertiary} />
                </TouchableOpacity>
            )}
            {isSearching && (
                <ActivityIndicator
                    size="small"
                    color={theme.tokens.brand.primary}
                    style={styles.searchLoadingIndicator}
                />
            )}
        </Pressable>
    );
});

// =============================================================================
// Styles - MATCHES ORIGINAL RoomListView.tsx EXACTLY
// =============================================================================

const styles = StyleSheet.create({
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 15,
        color: '#1f2937',
    },
    clearButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#e5e7eb',
    },
    searchLoadingIndicator: {
        marginLeft: 4,
    },
});

export default ListViewSearch;
