/**
 * Sort Dropdown Component
 *
 * Dropdown for sorting room list.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { theme } from '../../core/theme';

export type SortOption = 'distance' | 'participants' | 'newest' | 'expiring';

interface SortOptionItem {
  value: SortOption;
  label: string;
  description: string;
}

const SORT_OPTIONS: SortOptionItem[] = [
  { value: 'distance', label: 'Distance', description: 'Closest first' },
  { value: 'participants', label: 'Participants', description: 'Most active first' },
  { value: 'newest', label: 'Newest', description: 'Recently created first' },
  { value: 'expiring', label: 'Expiring Soon', description: 'Ending soon first' },
];

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = SORT_OPTIONS.find(opt => opt.value === value);

  const handleSelect = (option: SortOption) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.triggerText}>{selectedOption?.label}</Text>
        <ChevronDown size={16} color={theme.tokens.text.tertiary} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Sort By</Text>

            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.option}
                onPress={() => handleSelect(option.value)}
              >
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionLabel,
                    value === option.value && styles.optionLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                {value === option.value && (
                  <Check size={20} color={theme.tokens.brand.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.tokens.bg.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
    gap: 6,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.tokens.text.primary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdown: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    padding: 8,
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.tokens.text.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.tokens.text.primary,
  },
  optionLabelSelected: {
    color: theme.tokens.brand.primary,
  },
  optionDescription: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
    marginTop: 2,
  },
});

export default SortDropdown;

