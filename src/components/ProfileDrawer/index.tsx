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

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    LogOut,
    LogIn,
    X,
} from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useProfileDrawer } from '../../features/user';

// Sub-components
import { ProfileHeader } from './ProfileHeader';
import { ActiveRoomsList } from './ActiveRoomsList';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { AboutSection } from './AboutSection';

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
        updateNotificationSettings,
        appVersion,
        language,
        locationMode,
        handleEditProfile,
        handleRoomPress,
        handleUpgrade,
        handleSignOut,
        openTermsOfService,
        openPrivacyPolicy,
        handleConsentPreferences,
        // Profile drawer sub-screen navigation
        handleBlockedUsers,
        handleDataControls,
        handleLocationSettings,
        handleLanguageSettings,
        handleReportProblem,
    } = useProfileDrawer();
    const insets = useSafeAreaInsets();

    // BottomSheet refs and config
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['92%'], []);

    // =========================================================================
    // Effects
    // =========================================================================

    // Control sheet based on isOpen prop
    useEffect(() => {
        let isMounted = true;

        if (isOpen) {
            // Use requestAnimationFrame with snapToIndex(0) for precise height control
            // Adding a small check to ensure bottomSheetRef.current is available
            const rafId = requestAnimationFrame(() => {
                if (isMounted && bottomSheetRef.current) {
                    try {
                        bottomSheetRef.current.snapToIndex(0);
                    } catch (err) {
                        console.warn('[ProfileDrawer] Failed to snap:', err);
                    }
                }
            });
            // Refresh blocked users when drawer opens
            blockedUsers.refresh();
            return () => {
                isMounted = false;
                cancelAnimationFrame(rafId);
            };
        } else {
            if (bottomSheetRef.current) {
                try {
                    bottomSheetRef.current.close();
                } catch (err) {
                    console.warn('[ProfileDrawer] Failed to close:', err);
                }
            }
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
        () => null,
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
                onEditProfile={handleEditProfile}
            />



            <ActiveRoomsList
                rooms={myRooms}
                onRoomPress={(room) => handleRoomPress(room, onClose)}
            />

            <AccountSettings
                blockedUsersCount={blockedUsers.count}
                onBlockedUsersPress={handleBlockedUsers}
                onDataControlsPress={handleDataControls}
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
                onLanguagePress={handleLanguageSettings}
                onLocationPress={handleLocationSettings}
                onTermsPress={openTermsOfService}
                onPrivacyPolicyPress={openPrivacyPolicy}
                onReportProblemPress={handleReportProblem}
                onConsentPreferencesPress={handleConsentPreferences}
            />

            {isAnonymous ? (
                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={() => handleUpgrade(onClose)}
                >
                    <LogIn size={20} color="#6b7280" />
                    <Text style={styles.signOutText}>Sign In / Sign Up</Text>
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
                enableOverDrag={false}
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
                    {renderMainPage()}
                </BottomSheetScrollView>
            </BottomSheet>
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
