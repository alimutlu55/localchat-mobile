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
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    LogOut,
    ChevronRight,
    Trash2,
    X,
    MapPin,
    ArrowLeft,
    UserPlus,
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
import { DataControlsPage } from './DataControlsPage';
import { ReportProblemModal } from './ReportProblemModal';
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
        openTermsOfService,
        openPrivacyPolicy,
        openHelpCenter,
        handleDeleteMyRooms,
        handleHardDeleteAccount,
    } = useProfileDrawer();
    const insets = useSafeAreaInsets();

    // =========================================================================
    // Local State - UI only
    // =========================================================================
    const [currentPage, setCurrentPage] = useState<SubPage>('main');
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);

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
                onBlockedUsersPress={() => setCurrentPage('blocked')}
                onDataControlsPress={() => setCurrentPage('data-controls')}
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
                onHelpPress={() => openHelpCenter(onClose)}
                onLanguagePress={() => setCurrentPage('language')}
                onLocationPress={() => setCurrentPage('location')}
                onTermsPress={() => openTermsOfService(onClose)}
                onPrivacyPolicyPress={() => openPrivacyPolicy(onClose)}
                onReportProblemPress={() => setIsReportModalVisible(true)}
            />

            {/* Log Out / Sign Up */}
            {isAnonymous ? (
                <TouchableOpacity
                    style={styles.signInButton}
                    onPress={() => handleUpgrade(onClose)}
                >
                    <UserPlus size={20} color="#374151" />
                    <Text style={styles.signInText}>Sign Up or Log In</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={() => handleSignOut(onClose)}
                >
                    <LogOut size={20} color="#6b7280" />
                    <Text style={styles.signOutText}>Log Out</Text>
                </TouchableOpacity>
            )}
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
            case 'location':
                return renderSubPage(
                    'Location Mode',
                    <View style={styles.subPageContent}>
                        <Section title="CURRENT SETTING">
                            <SettingRow
                                icon={MapPin}
                                label="Approximate"
                                value="Active"
                                isEnabled={true}
                                onPress={() => { }}
                            />
                        </Section>
                        <Text style={styles.infoText}>
                            We use an approximate location to protect your privacy, which is shared only when you create a room and never reveals your exact position.
                        </Text>
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
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@localchat.app')}>
                            <Text style={styles.infoText}>
                                Need help? Contact us at{' '}
                                <Text style={{ color: '#FF6410', fontWeight: '500' }}>
                                    support@localchat.app
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'data-controls':
                return (
                    <DataControlsPage
                        onBack={() => setCurrentPage('main')}
                        onDeleteRooms={handleDeleteMyRooms}
                        onDeleteAccount={() => handleHardDeleteAccount(onClose)}
                        isAnonymous={isAnonymous}
                        createdRoomsCount={myRooms.filter(r => r.isCreator).length}
                    />
                );
            default:
                return renderMainPage();
        }
    };

    // =========================================================================
    // Main Render
    // =========================================================================

    return (
        <>
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
                    <TouchableOpacity
                        style={styles.headerCloseButton}
                        onPress={onClose}
                        hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
                    >
                        <X size={18} color="#6b7280" />
                    </TouchableOpacity>
                </View>
                <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
                    {renderContent()}
                </BottomSheetScrollView>
            </BottomSheet>

            {/* Report a Problem Modal */}
            <ReportProblemModal
                visible={isReportModalVisible}
                onClose={() => setIsReportModalVisible(false)}
            />
        </>
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
        top: 28, // aligned with avatar top (paddingTop 8 + header paddingVertical 20)
        right: 16,
        zIndex: 10,
    },
    headerCloseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 8,
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
        backgroundColor: '#f3f4f6',
        borderRadius: 16,
        paddingVertical: 14,
        marginBottom: 20,
    },
    signInText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
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
