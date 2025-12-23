/**
 * ProfileDrawer Component
 *
 * Bottom sheet drawer for user profile and settings.
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Animated,
    Dimensions,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    Info,
    Sparkles,
    ArrowLeft,
    X,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.85;

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
}

type SubPage = 'main' | 'privacy' | 'notifications' | 'language' | 'help';

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
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [currentPage, setCurrentPage] = useState<SubPage>('main');
    const translateY = React.useRef(new Animated.Value(DRAWER_HEIGHT)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;

    // Settings state
    const [pushNotifications, setPushNotifications] = useState(true);
    const [messageNotifications, setMessageNotifications] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Animate open/close
    React.useEffect(() => {
        if (isOpen) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    damping: 25,
                    stiffness: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: DRAWER_HEIGHT,
                    damping: 25,
                    stiffness: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
            // Reset to main page when closing
            setTimeout(() => setCurrentPage('main'), 200);
        }
    }, [isOpen]);

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

    if (!isOpen) return null;

    const renderMainPage = () => (
        <>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                    {user?.profilePhotoUrl ? (
                        <Text style={styles.profileAvatarText}>
                            {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                    ) : (
                        <User size={32} color="#ffffff" />
                    )}
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
        </>
    );

    const renderSubPage = (title: string, content: React.ReactNode) => (
        <>
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
        </>
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
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Backdrop */}
            <Animated.View
                style={[styles.backdrop, { opacity: backdropOpacity }]}
                pointerEvents={isOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    activeOpacity={1}
                />
            </Animated.View>

            {/* Drawer */}
            <Animated.View
                style={[
                    styles.drawer,
                    {
                        height: DRAWER_HEIGHT,
                        paddingBottom: insets.bottom,
                        transform: [{ translateY }],
                    },
                ]}
            >
                {/* Handle */}
                <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <X size={20} color="#6b7280" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {renderContent()}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    drawer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 20,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: '#e5e7eb',
        borderRadius: 2,
    },
    closeButton: {
        position: 'absolute',
        top: 8,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
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
        marginBottom: 12,
    },
    editProfileButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    editProfileText: {
        fontSize: 14,
        color: '#f97316',
        fontWeight: '500',
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

export default ProfileDrawer;
