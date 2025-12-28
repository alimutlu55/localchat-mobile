/**
 * Upgrade Benefits Modal Component
 *
 * Shows benefits of upgrading from anonymous to full account.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  X,
  Sparkles,
  Shield,
  Bell,
  Users,
  ChevronRight,
} from 'lucide-react-native';
import { theme } from '../../core/theme';

interface UpgradeBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const BENEFITS = [
  {
    icon: Shield,
    iconColor: theme.palette.emerald[500],
    iconBg: theme.palette.emerald[50],
    title: 'Persistent Identity',
    description: 'Keep your profile and history across devices',
  },
  {
    icon: Bell,
    iconColor: theme.palette.blue[500],
    iconBg: theme.palette.blue[50],
    title: 'Saved Preferences',
    description: 'Your settings sync automatically',
  },
  {
    icon: Users,
    iconColor: theme.palette.rose[500],
    iconBg: theme.palette.rose[50],
    title: 'Friend Connections',
    description: 'Connect with others and build relationships',
  },
  {
    icon: Sparkles,
    iconColor: theme.tokens.brand.primary,
    iconBg: theme.tokens.action.secondary.default,
    title: 'Verification Badge',
    description: 'Show others you\'re a verified member',
  },
];

export function UpgradeBenefitsModal({
  isOpen,
  onClose,
  onUpgrade,
}: UpgradeBenefitsModalProps) {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color={theme.tokens.text.tertiary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Sparkles size={28} color={theme.tokens.brand.primary} />
            </View>
            <Text style={styles.title}>Upgrade Your Account</Text>
            <Text style={styles.subtitle}>
              Get more features by creating a full account
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsList}>
            {BENEFITS.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: benefit.iconBg }]}>
                  <benefit.icon size={20} color={benefit.iconColor} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>{benefit.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
              <ChevronRight size={20} color={theme.tokens.text.onPrimary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.laterButton} onPress={onClose}>
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.tokens.action.secondary.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  benefitsList: {
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  actions: {
    gap: 12,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.tokens.brand.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.tokens.text.onPrimary,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  laterButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default UpgradeBenefitsModal;

