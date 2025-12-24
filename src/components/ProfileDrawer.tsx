/**
 * ProfileDrawer Component
 *
 * Bottom sheet drawer for user profile and settings.
 * Optimized with @gorhom/bottom-sheet for 60fps performance.
 * PARITY UPDATE: Added Stats Row and Active Rooms list.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    Alert,
    ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import {
    User,
    LogOut,
    ChevronRight,
    Bell,
    Lock,
    UserX,
    MapPin,
    Languages,
    HelpCircle,
    Scale,
    Eye,
    Globe,
    Trash2,
    Volume2,
    MessageSquare,
    Sparkles,
    ArrowLeft,
    X,
    Calendar,
    Hash,
} from 'lucide-react-native';
import { useAuth, useRooms } from '../context';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Room } from '../types';
import { AvatarDisplay } from './profile';

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
}

type SubPage = 'main' | 'privacy' | 'notifications' | 'language' | 'help';

/**
 * Stat Item Component
 */
function StatItem({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
    return (
        <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
                <Icon size={16} color="#f97316" />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

/**
 * Active Room Item Component
 */
function ActiveRoomItem({ room, onPress }: { room: Room; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.activeRoomItem} onPress={onPress}>
            <View style={styles.activeRoomEmoji}>
                <Text style={{ fontSize: 20 }}>{room.emoji}</Text>
            </View>
            <View style={styles.activeRoomInfo}>
                <Text style={styles.activeRoomTitle} numberOfLines={1}>{room.title}</Text>
                <Text style={styles.activeRoomMeta}>
                    {room.participantCount} members • {room.isCreator ? 'Host' : 'Member'}
                </Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
        </TouchableOpacity>
    );
}

/**
 * Setting Row Component
 */
function SettingRow({
    icon: Icon,
    label,
    value,
    onPress,
    isToggle,
    isEnabled,
    onToggle,
    danger,
}: {
    icon: React.ComponentType<{ size: number; color: string }>;
    label: string;
    value?: string;
    onPress?: () => void;
    isToggle?: boolean;
    isEnabled?: boolean;
    onToggle?: (value: boolean) => void;
    danger?: boolean;
}) {
    const iconColor = danger ? '#ef4444' : '#6b7280';
    const textColor = danger ? '#ef4444' : '#1f2937';

    if (isToggle) {
        return (
            <View style={styles.settingRow}>
                <Icon size={20} color={iconColor} />
                <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
                <Switch
                    value={isEnabled}
                    onValueChange={onToggle}
                    trackColor={{ false: '#e5e7eb', true: '#fdba74' }}
                    thumbColor={isEnabled ? '#f97316' : '#f4f4f5'}
                />
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={styles.settingRow}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Icon size={20} color={iconColor} />
            <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
            {value && <Text style={styles.settingValue}>{value}</Text>}
            <ChevronRight size={16} color="#9ca3af" />
        </TouchableOpacity>
    );
}

/**
 * Section Component
 */
function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionContent}>{children}</View>
        </View>
    );
}

/**
 * Main ProfileDrawer Component
 */
export function ProfileDrawer({ isOpen, onClose, onSignOut }: ProfileDrawerProps) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user } = useAuth();
    const { myRooms } = useRooms();
    const [currentPage, setCurrentPage] = useState<SubPage>('main');

    // BottomSheet refs and config
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['90%'], []); // Increased height for more content

    // Settings state
    const [pushNotifications, setPushNotifications] = useState(true);
    const [messageNotifications, setMessageNotifications] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Control sheet index based on isOpen prop
    useEffect(() => {
        if (isOpen) {
            bottomSheetRef.current?.expand();
            // Reset page when opening
            setCurrentPage('main');
        } else {
            bottomSheetRef.current?.close();
        }
    }, [isOpen]);

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

    const handleRoomPress = useCallback((room: Room) => {
        onClose();
        navigation.navigate('ChatRoom', { room });
    }, [onClose, navigation]);

    // Format createdAt date
    const memberSince = useMemo(() => {
        if (!user?.createdAt) return 'Recently';
        return new Date(user.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric'
        });
    }, [user?.createdAt]);

    // Derived stats
    const stats = {
        roomsJoined: myRooms.length,
        messagesSent: user?.isAnonymous ? 12 : 148, // Mocked for now as we don't have this in User model yet
        memberSince
    };

    const renderMainPage = () => (
        <View>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                    <AvatarDisplay
                        avatarUrl={user?.profilePhotoUrl}
                        displayName={user?.displayName || 'User'}
                        size="lg"
                    />
                </View>
                <Text style={styles.profileName}>{user?.displayName || 'Guest'}</Text>
                <Text style={styles.profileEmail}>
                    {user?.email || 'Anonymous User'}
                </Text>
                <TouchableOpacity
                    style={styles.editProfileButton}
                    onPress={() => {
                        onClose();
                        navigation.navigate('EditProfile');
                    }}
                >
                    <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>

                {/* Stats Row - NEW */}
                <View style={styles.statsRow}>
                    <StatItem label="Rooms" value={stats.roomsJoined} icon={Hash} />
                    <View style={styles.statDivider} />
                    <StatItem label="Messages" value={stats.messagesSent} icon={MessageSquare} />
                    <View style={styles.statDivider} />
                    <StatItem label="Joined" value={stats.memberSince} icon={Calendar} />
                </View>

                {/* Bio - NEW if available */}
                {user?.bio && (
                    <Text style={styles.bioText} numberOfLines={2}>
                        {user.bio}
                    </Text>
                )}
            </View>

            {/* Upgrade Banner (for anonymous users) */}
            {user?.isAnonymous && (
                <View style={styles.upgradeBanner}>
                    <View style={styles.upgradeIcon}>
                        <Sparkles size={20} color="#f97316" />
                    </View>
                    <View style={styles.upgradeInfo}>
                        <Text style={styles.upgradeTitle}>Upgrade to Account</Text>
                        <Text style={styles.upgradeSubtitle}>
                            Save your preferences and history
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.upgradeButton}>
                        <Text style={styles.upgradeButtonText}>Upgrade</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Active Rooms Section - NEW */}
            {myRooms.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>YOUR ACTIVE ROOMS</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.activeRoomsScroll}
                        contentContainerStyle={styles.activeRoomsContent}
                    >
                        {myRooms.map(room => (
                            <ActiveRoomItem
                                key={room.id}
                                room={room}
                                onPress={() => handleRoomPress(room)}
                            />
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Account Section */}
            <Section title="ACCOUNT">
                <SettingRow
                    icon={Lock}
                    label="Privacy"
                    onPress={() => setCurrentPage('privacy')}
                />
                <SettingRow
                    icon={UserX}
                    label="Blocked Users"
                    onPress={() => console.log('Blocked users')}
                />
            </Section>

            {/* Notifications Section */}
            <Section title="NOTIFICATIONS">
                <SettingRow
                    icon={Bell}
                    label="Push Notifications"
                    isToggle
                    isEnabled={pushNotifications}
                    onToggle={setPushNotifications}
                />
                <SettingRow
                    icon={MessageSquare}
                    label="Message Notifications"
                    isToggle
                    isEnabled={messageNotifications}
                    onToggle={setMessageNotifications}
                />
                <SettingRow
                    icon={Volume2}
                    label="Sounds"
                    isToggle
                    isEnabled={soundEnabled}
                    onToggle={setSoundEnabled}
                />
            </Section>

            {/* Privacy & Safety */}
            <Section title="PRIVACY & SAFETY">
                <SettingRow
                    icon={MapPin}
                    label="Location Mode"
                    value="Precise"
                    onPress={() => console.log('Location mode')}
                />
            </Section>

            {/* Preferences */}
            <Section title="PREFERENCES">
                <SettingRow
                    icon={Languages}
                    label="Language"
                    value="English"
                    onPress={() => setCurrentPage('language')}
                />
            </Section>

            {/* About */}
            <Section title="ABOUT">
                <SettingRow
                    icon={HelpCircle}
                    label="Help Center"
                    onPress={() => setCurrentPage('help')}
                />
                <SettingRow
                    icon={Scale}
                    label="Terms of Service"
                    onPress={() => console.log('Terms')}
                />
                <SettingRow
                    icon={Eye}
                    label="Privacy Policy"
                    onPress={() => console.log('Privacy policy')}
                />
                <View style={styles.settingRow}>
                    <Globe size={20} color="#6b7280" />
                    <Text style={styles.settingLabel}>Version</Text>
                    <Text style={styles.settingValue}>1.0.0</Text>
                </View>
            </Section>

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
            {/* Custom Header for Subpages inside ScrollView */}
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

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1} // Start closed
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
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginBottom: 16,
    },
    profileAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f97316',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileAvatarText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#ffffff',
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 8,
    },
    bioText: {
        fontSize: 13,
        color: '#4b5563',
        textAlign: 'center',
        marginHorizontal: 32,
        marginBottom: 16,
        lineHeight: 18,
    },
    editProfileButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 20,
    },
    editProfileText: {
        fontSize: 14,
        color: '#f97316',
        fontWeight: '500',
    },
    // Stats styles
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1f2937',
    },
    statLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#e5e7eb',
    },
    // Active Rooms styles
    activeRoomsScroll: {
        marginBottom: 8,
    },
    activeRoomsContent: {
        paddingRight: 16,
    },
    activeRoomItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 10,
        marginRight: 12,
        width: 200,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    activeRoomEmoji: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    activeRoomInfo: {
        flex: 1,
    },
    activeRoomTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    activeRoomMeta: {
        fontSize: 11,
        color: '#9ca3af',
    },
    upgradeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff7ed',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    upgradeIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    upgradeInfo: {
        flex: 1,
    },
    upgradeTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
    },
    upgradeSubtitle: {
        fontSize: 12,
        color: '#9ca3af',
    },
    upgradeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    upgradeButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1f2937',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9ca3af',
        letterSpacing: 0.5,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionContent: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    settingLabel: {
        flex: 1,
        fontSize: 14,
        color: '#1f2937',
        marginLeft: 12,
    },
    settingValue: {
        fontSize: 14,
        color: '#9ca3af',
        marginRight: 8,
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
