/**
 * Category Chips Component
 *
 * Horizontal scrollable category filter chips.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { CATEGORIES } from '../../constants';
import { theme } from '../../core/theme';

interface CategoryChipsProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  showAllOption?: boolean;
}

export function CategoryChips({
  selectedCategory,
  onSelectCategory,
  showAllOption = true,
}: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {showAllOption && (
        <TouchableOpacity
          style={[
            styles.chip,
            selectedCategory === null && styles.chipSelected,
          ]}
          onPress={() => onSelectCategory(null)}
        >
          <Text style={styles.chipEmoji}>🌐</Text>
          <Text
            style={[
              styles.chipText,
              selectedCategory === null && styles.chipTextSelected,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      )}

      {CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.chip,
            selectedCategory === category.id && styles.chipSelected,
          ]}
          onPress={() => onSelectCategory(category.id)}
        >
          <Text style={styles.chipEmoji}>{category.emoji}</Text>
          <Text
            style={[
              styles.chipText,
              selectedCategory === category.id && styles.chipTextSelected,
            ]}
          >
            {category.id.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 44,
  },
  content: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.tokens.bg.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: theme.tokens.action.secondary.default,
    borderColor: theme.tokens.brand.primary,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.tokens.text.secondary,
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: theme.tokens.brand.primary,
  },
});

export default CategoryChips;

