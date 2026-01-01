/**
 * MessageInput Component
 *
 * Chat message input field with send button.
 * Extracted from ChatRoomScreen for modularity.
 *
 * Features:
 * - Multiline text input
 * - Send button with disabled state
 * - Safe area aware (bottom inset)
 * - Keyboard aware styling
 */

import React, { RefObject } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    TextInput as RNTextInput,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../../core/theme';

// =============================================================================
// Types
// =============================================================================

export interface MessageInputProps {
    /** Reference to the TextInput for focus management */
    inputRef?: RefObject<RNTextInput | null>;
    /** Current input text value */
    value: string;
    /** Called when input text changes */
    onChangeText: (text: string) => void;
    /** Called when send button is pressed */
    onSubmit: () => void;
    /** Whether the send button should be enabled */
    canSend: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Maximum character length */
    maxLength?: number;
}

// =============================================================================
// Component
// =============================================================================

export function MessageInput({
    inputRef,
    value,
    onChangeText,
    onSubmit,
    canSend,
    placeholder = 'Type a message...',
    maxLength = 1000,
}: MessageInputProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.inputWrapper}>
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={theme.tokens.text.tertiary}
                    value={value}
                    onChangeText={onChangeText}
                    multiline
                    maxLength={maxLength}
                    accessibilityLabel="Message input"
                    accessibilityHint="Type your message here"
                />
            </View>
            <TouchableOpacity
                style={styles.sendButton}
                onPress={onSubmit}
                disabled={!canSend}
                accessibilityLabel="Send message"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
            >
                <Send
                    size={22}
                    color={canSend ? theme.tokens.brand.primary : theme.tokens.text.tertiary}
                />
            </TouchableOpacity>
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: theme.tokens.bg.surface,
        borderTopWidth: 1,
        borderTopColor: theme.tokens.border.subtle,
        gap: 12,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
        maxHeight: 120,
        justifyContent: 'center',
    },
    input: {
        fontSize: 15,
        color: theme.tokens.text.primary,
        maxHeight: 100,
        padding: 0,
        margin: 0,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default MessageInput;
