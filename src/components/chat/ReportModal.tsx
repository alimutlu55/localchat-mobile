import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, AlertTriangle, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../core/theme';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'dangerous'
  | 'off_topic'
  | 'other';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    reason: ReportReason;
    details: string;
    blockUser: boolean;
  }) => Promise<void>;
  targetType: 'message' | 'room' | 'user';
  targetName?: string;
  isUserAlreadyBlocked?: boolean;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'dangerous', label: 'Dangerous or Threatening' },
  { value: 'off_topic', label: 'Off Topic' },
  { value: 'other', label: 'Other' },
];

function RadioOption({ label, isSelected, onSelect }: { label: string; isSelected: boolean; onSelect: () => void }) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[styles.radioItem, isSelected && styles.radioItemSelected]}
      activeOpacity={0.7}
    >
      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
        {isSelected && <View style={styles.radioInner} />}
      </View>
      <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CheckboxOption({ label, isChecked, onToggle, disabled = false }: { label: string; isChecked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onToggle}
      style={[styles.checkboxItem, disabled && styles.checkboxItemDisabled]}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.checkboxOuter, isChecked && styles.checkboxOuterSelected, disabled && styles.checkboxOuterDisabled]}>
        {isChecked && <Check size={14} color={disabled ? theme.tokens.text.tertiary : theme.tokens.text.onPrimary} />}
      </View>
      <Text style={[styles.checkboxLabel, disabled && styles.checkboxLabelDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  targetType,
  targetName,
  isUserAlreadyBlocked = false,
}: ReportModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [blockUser, setBlockUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        reason: selectedReason,
        details: details.trim(),
        blockUser,
      });
      setSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedReason(null);
    setDetails('');
    setBlockUser(false);
    setSubmitted(false);
  };

  const handleClose = () => {
    onClose();
    setTimeout(resetForm, 300);
  };

  const getTitle = () => {
    switch (targetType) {
      case 'message':
        return 'Report Message';
      case 'room':
        return 'Report Room';
      case 'user':
        return `Report ${targetName || 'User'}`;
      default:
        return 'Report';
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={handleClose}
        />
        <View style={[styles.modal, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{getTitle()}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.tokens.text.tertiary} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Check size={32} color={theme.tokens.text.success} />
              </View>
              <Text style={styles.successTitle}>Thank You</Text>
              <Text style={styles.successText}>
                Your report is anonymous and helps keep our community safe. We'll review it shortly.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Reason Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What are you reporting?</Text>
                <View style={styles.card}>
                  {REPORT_REASONS.map((reason, index) => (
                    <React.Fragment key={reason.value}>
                      <RadioOption
                        label={reason.label}
                        isSelected={selectedReason === reason.value}
                        onSelect={() => setSelectedReason(reason.value)}
                      />
                      {index < REPORT_REASONS.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>

              {/* Additional Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional details (optional)</Text>
                <View style={styles.card}>
                  <TextInput
                    style={styles.detailsInput}
                    placeholder="Provide more context about the issue..."
                    placeholderTextColor={theme.tokens.text.tertiary}
                    multiline
                    numberOfLines={4}
                    value={details}
                    onChangeText={setDetails}
                    maxLength={500}
                  />
                  <Text style={styles.charCount}>{details.length}/500</Text>
                </View>
              </View>

              {/* Additional Actions - Only show for user reports */}
              {targetType === 'user' && (
                <View style={styles.section}>
                  <View style={styles.card}>
                    <CheckboxOption
                      label={isUserAlreadyBlocked ? "User already blocked" : "Block this user"}
                      isChecked={isUserAlreadyBlocked || blockUser}
                      onToggle={() => !isUserAlreadyBlocked && setBlockUser(!blockUser)}
                      disabled={isUserAlreadyBlocked}
                    />
                  </View>
                </View>
              )}

              {/* Info message for room reports */}
              {targetType === 'room' && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    You'll be removed from this room after reporting. You can rejoin anytime.
                  </Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!selectedReason || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={theme.tokens.text.onPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.footerNote}>
                Your report is anonymous and helps keep our community safe.
              </Text>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modal: {
    backgroundColor: theme.tokens.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.tokens.border.subtle,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.tokens.border.subtle,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.tokens.text.primary,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.tokens.text.tertiary,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: theme.tokens.bg.subtle,
    marginHorizontal: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radioItemSelected: {
    backgroundColor: theme.tokens.bg.subtle,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.tokens.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: theme.tokens.brand.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.tokens.brand.primary,
  },
  radioLabel: {
    fontSize: 15,
    color: theme.tokens.text.secondary,
  },
  radioLabelSelected: {
    color: theme.tokens.text.primary,
    fontWeight: '500',
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.tokens.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxOuterSelected: {
    borderColor: theme.tokens.brand.primary,
    backgroundColor: theme.tokens.brand.primary,
  },
  checkboxLabel: {
    fontSize: 15,
    color: theme.tokens.text.secondary,
  },
  checkboxItemDisabled: {
    opacity: 0.6,
  },
  checkboxOuterDisabled: {
    borderColor: theme.tokens.text.tertiary,
    backgroundColor: theme.tokens.bg.subtle,
  },
  checkboxLabelDisabled: {
    color: theme.tokens.text.tertiary,
  },
  detailsInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.tokens.text.primary,
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  submitButton: {
    backgroundColor: theme.tokens.brand.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.tokens.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: theme.tokens.bg.subtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.tokens.text.onPrimary,
  },
  footerNote: {
    fontSize: 13,
    color: theme.tokens.text.tertiary,
    textAlign: 'center',
    marginBottom: 20,
  },
  successContainer: {
    padding: 40,
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.tokens.status.success.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.tokens.text.primary,
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: theme.tokens.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    backgroundColor: theme.tokens.status.info.bg,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.tokens.status.info.main,
  },
  infoText: {
    fontSize: 14,
    color: theme.tokens.status.info.main,
    lineHeight: 20,
  },
});

export default ReportModal;

