/**
 * ChatHeader Component
 *
 * Self-contained header component for the chat room screen.
 * Handles room title, participant count, navigation, and menu access.
 *
 * Design Decision:
 * - Extracted from ChatRoomScreen to reduce component complexity
 * - Props-based interface for clear data flow and testability
 * - Includes ConnectionBanner for network status
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import { theme } from '../../../core/theme';
import { ConnectionBanner } from '../../../components/chat';
import { Room } from '../../../types';

// =============================================================================
// Types
// =============================================================================

interface ChatHeaderProps {
    /** Room data to display */
    room: Room;

    /** Navigate back */
    onBack: () => void;

    /** Open room info */
    onRoomInfo: () => void;

    /** Open menu */
    onMenuOpen: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatHeader renders the top bar of the chat room with:
 * - Safe area inset
 * - Connection status banner
 * - Back button
 * - Room title and participant count
 * - Menu button
 */
export const ChatHeader = React.memo(function ChatHeader({
    room,
    onBack,
    onRoomInfo,
    onMenuOpen,
}: ChatHeaderProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.headerContainer}>
            {/* Safe area spacer */}
            <View style={{ height: insets.top }} />

            {/* Network connection status */}
            <ConnectionBanner />

            {/* Header content */}
            <View style={styles.header}>
                {/* Back button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <ArrowLeft size={24} color={theme.tokens.text.primary} />
                </TouchableOpacity>

                {/* Room title - tappable to view room info */}
                <TouchableOpacity
                    style={styles.headerContent}
                    onPress={onRoomInfo}
                    accessibilityLabel={`View ${room.title} room info`}
                    accessibilityRole="button"
                >
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {room.title}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {room.participantCount} people • {room.distanceDisplay || 'Nearby'}
                    </Text>
                </TouchableOpacity>

                {/* Menu button */}
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={onMenuOpen}
                    accessibilityLabel="Open chat menu"
                    accessibilityRole="button"
                >
                    <MoreVertical size={22} color={theme.tokens.text.tertiary} />
                </TouchableOpacity>
            </View>
        </View>
    );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    headerContainer: {
        backgroundColor: theme.tokens.bg.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
        marginTop: 1,
    },
    menuButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ChatHeader;
