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
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: '#f97316',
  },
});

export default CategoryChips;

