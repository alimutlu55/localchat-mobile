/**
 * ProfileDrawer Component - Main Container
 *
 * Bottom sheet drawer for user profile and settings.
 * Uses useProfileDrawer hook for all data and actions.
 * 
 * Architecture:
 * - useProfileDrawer hook: data fetching, business logic, actions
 * - This file: orchestration, UI rendering, page navigation
 * - Sub-components: specific UI sections (presentational)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
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
import { useProfileDrawer } from '../../features/user';

// Sub-components
import { ProfileHeader } from './ProfileHeader';
import { UpgradeBanner } from './UpgradeBanner';
import { ActiveRoomsList } from './ActiveRoomsList';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { AboutSection } from './AboutSection';
import { BlockedUsersPage } from './BlockedUsersPage';
import { Section, SettingRow } from './shared';
import { SubPage } from './shared/types';

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
}

/**
 * Main ProfileDrawer Component
 */
export function ProfileDrawer({ isOpen, onClose, onSignOut }: ProfileDrawerProps) {
    // =========================================================================
    // Hook - All data and actions from useProfileDrawer
    // =========================================================================
    const {
        user,
        isAnonymous,
        stats,
        myRooms,
        blockedUsers,
        notificationSettings,
        privacySettings,
        updateNotificationSettings,
        updatePrivacySettings,
        appVersion,
        language,
        locationMode,
        handleEditProfile,
        handleRoomPress,
        handleUpgrade,
        handleSignOut,
        handleDeleteAccount,
        openTermsOfService,
        openPrivacyPolicy,
        openHelpCenter,
    } = useProfileDrawer();

    // =========================================================================
    // Local State - UI only
    // =========================================================================
    const [currentPage, setCurrentPage] = useState<SubPage>('main');

    // BottomSheet refs and config
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['90%'], []);

    // =========================================================================
    // Effects
    // =========================================================================

    // Control sheet based on isOpen prop
    useEffect(() => {
        if (isOpen) {
            bottomSheetRef.current?.expand();
            setCurrentPage('main');
            // Refresh blocked users when drawer opens
            blockedUsers.refresh();
        } else {
            bottomSheetRef.current?.close();
        }
    }, [isOpen]);

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

    // =========================================================================
    // Render Functions
    // =========================================================================

    const renderMainPage = () => (
        <View>
            <ProfileHeader
                user={user}
                stats={stats}
                onEditProfile={() => handleEditProfile(onClose)}
            />

            <UpgradeBanner
                isAnonymous={isAnonymous}
                onUpgrade={() => handleUpgrade(onClose)}
            />

            <ActiveRoomsList
                rooms={myRooms}
                onRoomPress={(room) => handleRoomPress(room, onClose)}
            />

            <AccountSettings
                blockedUsersCount={blockedUsers.count}
                onPrivacyPress={() => setCurrentPage('privacy')}
                onBlockedUsersPress={() => setCurrentPage('blocked')}
            />

            <NotificationSettings
                pushNotifications={notificationSettings.pushNotifications}
                messageNotifications={notificationSettings.messageNotifications}
                onPushToggle={(val) => updateNotificationSettings({ pushNotifications: val })}
                onMessageToggle={(val) => updateNotificationSettings({ messageNotifications: val })}
            />

            <AboutSection
                appVersion={appVersion}
                language={language}
                locationMode={locationMode}
                onHelpPress={openHelpCenter}
                onLanguagePress={() => setCurrentPage('language')}
                onLocationPress={() => setCurrentPage('privacy')}
                onTermsPress={openTermsOfService}
                onPrivacyPolicyPress={openPrivacyPolicy}
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

            {/* Log Out */}
            <TouchableOpacity
                style={styles.signOutButton}
                onPress={() => handleSignOut(onClose)}
            >
                <LogOut size={20} color="#6b7280" />
                <Text style={styles.signOutText}>Log Out</Text>
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
                                isEnabled={privacySettings.showOnlineStatus}
                                onToggle={(val) => updatePrivacySettings({ showOnlineStatus: val })}
                            />
                            <SettingRow
                                icon={Globe}
                                label="Show Last Seen"
                                isToggle
                                isEnabled={privacySettings.showLastSeen}
                                onToggle={(val) => updatePrivacySettings({ showLastSeen: val })}
                            />
                        </Section>
                    </View>
                );
            case 'language':
                return renderSubPage(
                    'Language',
                    <View style={styles.subPageContent}>
                        <Text style={styles.infoText}>
                            Language settings coming soon. Currently using: {(language || 'en').toUpperCase()}
                        </Text>
                    </View>
                );
            case 'blocked':
                return (
                    <BlockedUsersPage
                        blockedUsers={blockedUsers.blockedUsers}
                        isLoading={blockedUsers.isLoading}
                        unblockingId={blockedUsers.unblockingId}
                        onUnblock={blockedUsers.unblockUser}
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
    signInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff7ed',
        borderRadius: 16,
        paddingVertical: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    signInText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#f97316',
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
