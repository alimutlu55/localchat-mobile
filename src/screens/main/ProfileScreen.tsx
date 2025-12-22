/**
 * Profile Screen (Tab)
 *
 * User profile and settings access.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  User,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  Crown,
  MessageCircle,
} from 'lucide-react-native';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showBadge?: boolean;
  danger?: boolean;
}

function MenuItem({ icon, label, onPress, showBadge, danger }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        {icon}
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
        {label}
      </Text>
      {showBadge && <View style={styles.badge} />}
      <ChevronRight size={20} color="#9ca3af" />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade Account',
      'Create a full account to sync across devices and access more features.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Upgrade', onPress: () => navigation.navigate('EditProfile') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Card */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <View style={styles.avatar}>
            {user?.profilePhotoUrl ? (
              <View style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            )}
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
            <View style={styles.userMeta}>
              {user?.isAnonymous ? (
                <View style={styles.anonymousBadge}>
                  <Text style={styles.anonymousText}>Anonymous</Text>
                </View>
              ) : (
                <Text style={styles.userEmail}>{user?.email}</Text>
              )}
            </View>
          </View>

          <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Upgrade Banner (for anonymous users) */}
        {user?.isAnonymous && (
          <TouchableOpacity
            style={styles.upgradeBanner}
            onPress={handleUpgrade}
            activeOpacity={0.8}
          >
            <Crown size={24} color="#f97316" />
            <View style={styles.upgradeContent}>
              <Text style={styles.upgradeTitle}>Upgrade Your Account</Text>
              <Text style={styles.upgradeText}>
                Sync across devices and never lose your chats
              </Text>
            </View>
            <ChevronRight size={20} color="#f97316" />
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <MessageCircle size={20} color="#f97316" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Rooms Joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Crown size={20} color="#f97316" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Rooms Created</Text>
          </View>
        </View>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<User size={20} color="#6b7280" />}
              label="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <MenuItem
              icon={<Settings size={20} color="#6b7280" />}
              label="Settings"
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<HelpCircle size={20} color="#6b7280" />}
              label="Help & FAQ"
              onPress={() => Alert.alert('Help', 'Help center coming soon!')}
            />
            <MenuItem
              icon={<Shield size={20} color="#6b7280" />}
              label="Privacy Policy"
              onPress={() => Alert.alert('Privacy', 'Privacy policy coming soon!')}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<LogOut size={20} color="#ef4444" />}
              label="Sign Out"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>

        {/* Version */}
        <Text style={styles.version}>LocalChat v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#f97316',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  anonymousBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  anonymousText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  upgradeContent: {
    flex: 1,
    marginLeft: 12,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  upgradeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  menuSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIconDanger: {
    backgroundColor: '#fef2f2',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
  },
  menuLabelDanger: {
    color: '#ef4444',
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
    marginRight: 8,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 32,
    marginBottom: 24,
  },
});

