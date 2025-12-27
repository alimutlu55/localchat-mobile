/**
 * ProfileDrawer Component - Main Container
 *
 * Bottom sheet drawer for user profile and settings.
 * Refactored into smaller, focused components for better maintainability.
 * 
 * Architecture:
 * - This file handles: orchestration, state management, navigation
 * - Sub-components handle: specific UI sections
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import {
    LogOut,
    ChevronRight,
    Trash2,
    X,
    Eye,
    Globe,
    ArrowLeft,
} from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useCurrentUser } from '../../features/user/store';
import { useMyRooms } from '../../features/rooms/hooks';
import { blockService } from '../../services';

// Sub-components
import { ProfileHeader } from './ProfileHeader';
import { UpgradeBanner } from './UpgradeBanner';
import { ActiveRoomsList } from './ActiveRoomsList';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { AboutSection } from './AboutSection';
import { BlockedUsersPage } from './BlockedUsersPage';
import { Section, SettingRow } from './shared';
import { SubPage, BlockedUser } from './shared/types';
import { Room } from '../../types';

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
}

/**
 * Main ProfileDrawer Component
 */
export function ProfileDrawer({ isOpen, onClose, onSignOut }: ProfileDrawerProps) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const user = useCurrentUser();
    const { rooms: myRooms } = useMyRooms();

    // =========================================================================
    // State
    // =========================================================================
    const [currentPage, setCurrentPage] = useState<SubPage>('main');

    // Settings state
    const [pushNotifications, setPushNotifications] = useState(true);
    const [messageNotifications, setMessageNotifications] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Blocked users state
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    // BottomSheet refs and config
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['90%'], []);

    // =========================================================================
    // Effects
    // =========================================================================

    const loadBlockedUsers = useCallback(async () => {
        setIsLoadingBlocked(true);
        try {
            const users = await blockService.getBlockedUsers();
            setBlockedUsers(users);
        } catch (error) {
            console.error('Failed to load blocked users:', error);
        } finally {
            setIsLoadingBlocked(false);
        }
    }, []);

    // Control sheet based on isOpen prop
    useEffect(() => {
        if (isOpen) {
            bottomSheetRef.current?.expand();
            setCurrentPage('main');
            loadBlockedUsers();
        } else {
            bottomSheetRef.current?.close();
        }
    }, [isOpen, loadBlockedUsers]);

    // =========================================================================
    // Handlers
    // =========================================================================

    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1) {
            onClose();
        }
    }, [onClose]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    const handleEditProfile = useCallback(() => {
        onClose();
        navigation.navigate('EditProfile');
    }, [onClose, navigation]);

    const handleUpgrade = useCallback(() => {
        console.log('Upgrade account');
        // TODO: Navigate to upgrade screen
    }, []);

    const handleRoomPress = useCallback((room: Room) => {
        onClose();
        navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: room });
    }, [onClose, navigation]);

    const handleSignOut = useCallback(() => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: () => {
                        onSignOut();
                        onClose();
                    },
                },
            ]
        );
    }, [onSignOut, onClose]);

    const handleDeleteAccount = useCallback(() => {
        Alert.alert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implement account deletion
                        console.log('Delete account');
                    },
                },
            ]
        );
    }, []);

    const handleUnblock = useCallback((blockedUser: BlockedUser) => {
        Alert.alert(
            'Unblock User',
            `Are you sure you want to unblock ${blockedUser.displayName || 'this user'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    onPress: async () => {
                        setUnblockingId(blockedUser.blockedId);
                        try {
                            await blockService.unblockUser(blockedUser.blockedId);
                            setBlockedUsers(prev => prev.filter(u => u.blockedId !== blockedUser.blockedId));
                        } catch (error) {
                            Alert.alert('Error', 'Failed to unblock user');
                        } finally {
                            setUnblockingId(null);
                        }
                    },
                },
            ]
        );
    }, []);

    // =========================================================================
    // Derived Data
    // =========================================================================

    const memberSince = useMemo(() => {
        if (!user?.createdAt) return 'Recently';
        return new Date(user.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric'
        });
    }, [user?.createdAt]);

    const stats = useMemo(() => ({
        roomsJoined: myRooms.length,
        messagesSent: user?.isAnonymous ? 12 : 148, // Mocked for now
        memberSince
    }), [myRooms.length, user?.isAnonymous, memberSince]);

    // =========================================================================
    // Render Functions
    // =========================================================================

    const renderMainPage = () => (
        <View>
            <ProfileHeader
                user={user}
                stats={stats}
                onEditProfile={handleEditProfile}
            />

            <UpgradeBanner
                isAnonymous={user?.isAnonymous || false}
                onUpgrade={handleUpgrade}
            />

            <ActiveRoomsList
                rooms={myRooms}
                onRoomPress={handleRoomPress}
            />

            <AccountSettings
                blockedUsersCount={blockedUsers.length}
                onPrivacyPress={() => setCurrentPage('privacy')}
                onBlockedUsersPress={() => setCurrentPage('blocked')}
            />

            <NotificationSettings
                pushNotifications={pushNotifications}
                messageNotifications={messageNotifications}
                soundEnabled={soundEnabled}
                onPushToggle={setPushNotifications}
                onMessageToggle={setMessageNotifications}
                onSoundToggle={setSoundEnabled}
            />

            <AboutSection
                onHelpPress={() => setCurrentPage('help')}
                onLanguagePress={() => setCurrentPage('language')}
                onLocationPress={() => console.log('Location mode')}
            />

            {/* Danger Zone */}
            <View style={styles.dangerSection}>
                <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={handleDeleteAccount}
                >
                    <Trash2 size={20} color="#ef4444" />
                    <Text style={styles.dangerButtonText}>Delete Account</Text>
                    <ChevronRight size={16} color="#fca5a5" />
                </TouchableOpacity>
            </View>

            {/* Sign Out */}
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={20} color="#6b7280" />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSubPage = (title: string, content: React.ReactNode) => (
        <View>
            {/* Header for other subpages */}
            <View style={styles.subPageHeader}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setCurrentPage('main')}
                >
                    <ArrowLeft size={20} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.subPageTitle}>{title}</Text>
            </View>
            {content}
        </View>
    );

    const renderContent = () => {
        switch (currentPage) {
            case 'privacy':
                return renderSubPage(
                    'Privacy',
                    <View style={styles.subPageContent}>
                        <Section title="VISIBILITY">
                            <SettingRow
                                icon={Eye}
                                label="Show Online Status"
                                isToggle
                                isEnabled={true}
                                onToggle={() => { }}
                            />
                            <SettingRow
                                icon={Globe}
                                label="Show Last Seen"
                                isToggle
                                isEnabled={true}
                                onToggle={() => { }}
                            />
                        </Section>
                    </View>
                );
            case 'language':
                return renderSubPage(
                    'Language',
                    <View style={styles.subPageContent}>
                        <Text style={styles.infoText}>
                            Language settings coming soon...
                        </Text>
                    </View>
                );
            case 'blocked':
                return (
                    <BlockedUsersPage
                        blockedUsers={blockedUsers}
                        isLoading={isLoadingBlocked}
                        unblockingId={unblockingId}
                        onUnblock={handleUnblock}
                        onBack={() => setCurrentPage('main')}
                    />
                );
            case 'help':
                return renderSubPage(
                    'Help Center',
                    <View style={styles.subPageContent}>
                        <Text style={styles.infoText}>
                            Need help? Contact us at support@localchat.app
                        </Text>
                    </View>
                );
            default:
                return renderMainPage();
        }
    };

    // =========================================================================
    // Main Render
    // =========================================================================

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
            onChange={handleSheetChanges}
            backgroundStyle={styles.drawerBackground}
            handleIndicatorStyle={styles.handleIndicator}
        >
            <View style={styles.headerContainer}>
                <TouchableOpacity style={styles.headerCloseButton} onPress={onClose}>
                    <X size={20} color="#6b7280" />
                </TouchableOpacity>
            </View>
            <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
                {renderContent()}
            </BottomSheetScrollView>
        </BottomSheet>
    );
}

// ============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    drawerBackground: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    handleIndicator: {
        backgroundColor: '#e5e7eb',
        width: 36,
        height: 4,
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        padding: 12,
    },
    headerCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 8,
    },
    dangerSection: {
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    dangerButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#ef4444',
        marginLeft: 12,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 16,
        paddingVertical: 14,
        marginBottom: 20,
    },
    signOutText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
        marginLeft: 8,
    },
    subPageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    subPageTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    subPageContent: {
        flex: 1,
    },
    infoText: {
        fontSize: 14,
        color: '#6b7280',
        padding: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
    },
});

export default React.memo(ProfileDrawer);
