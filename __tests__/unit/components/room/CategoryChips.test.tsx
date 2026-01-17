/**
 * CategoryChips Component Tests
 *
 * Tests the category filter chips component.
 * Validates:
 * - Rendering all categories
 * - Selection state
 * - "All" option visibility
 * - Callback behavior
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategoryChips } from '../../../../src/components/room/CategoryChips';

// Mock constants
jest.mock('../../../../src/constants', () => ({
  CATEGORIES: [
    { id: 'social', emoji: '👋' },
    { id: 'gaming', emoji: '🎮' },
    { id: 'sports', emoji: '⚽' },
    { id: 'music', emoji: '🎵' },
  ],
}));

// Mock theme
jest.mock('../../../../src/core/theme', () => ({
  theme: {
    tokens: {
      bg: { surface: '#FFF' },
      border: { subtle: '#E5E5E5' },
      action: { secondary: { default: '#F0F0F0' } },
      brand: { primary: '#007AFF' },
      text: { secondary: '#666' },
    },
  },
}));

describe('CategoryChips', () => {
  const defaultProps = {
    selectedCategory: null,
    onSelectCategory: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // Render Tests
  // ===========================================================================

  describe('Rendering', () => {
    it('renders all category chips', () => {
      const { getByText } = render(<CategoryChips {...defaultProps} />);

      expect(getByText('social')).toBeTruthy();
      expect(getByText('gaming')).toBeTruthy();
      expect(getByText('sports')).toBeTruthy();
      expect(getByText('music')).toBeTruthy();
    });

    it('renders "All" option by default', () => {
      const { getByText } = render(<CategoryChips {...defaultProps} />);

      expect(getByText('All')).toBeTruthy();
    });

    it('hides "All" option when showAllOption is false', () => {
      const { queryByText } = render(
        <CategoryChips {...defaultProps} showAllOption={false} />
      );

      expect(queryByText('All')).toBeNull();
    });

    it('renders category emojis', () => {
      const { getByText } = render(<CategoryChips {...defaultProps} />);

      expect(getByText('👋')).toBeTruthy();
      expect(getByText('🎮')).toBeTruthy();
      expect(getByText('⚽')).toBeTruthy();
      expect(getByText('🎵')).toBeTruthy();
    });

    it('renders global emoji for "All" option', () => {
      const { getByText } = render(<CategoryChips {...defaultProps} />);

      expect(getByText('👥')).toBeTruthy();
    });
  });

  // ===========================================================================
  // Selection Tests
  // ===========================================================================

  describe('Selection', () => {
    it('calls onSelectCategory when category is pressed', () => {
      const onSelectCategory = jest.fn();
      const { getByText } = render(
        <CategoryChips {...defaultProps} onSelectCategory={onSelectCategory} />
      );

      fireEvent.press(getByText('social'));

      expect(onSelectCategory).toHaveBeenCalledWith('social');
    });

    it('calls onSelectCategory with null when "All" is pressed', () => {
      const onSelectCategory = jest.fn();
      const { getByText } = render(
        <CategoryChips
          {...defaultProps}
          selectedCategory="social"
          onSelectCategory={onSelectCategory}
        />
      );

      fireEvent.press(getByText('All'));

      expect(onSelectCategory).toHaveBeenCalledWith(null);
    });

    it('allows selecting different categories', () => {
      const onSelectCategory = jest.fn();
      const { getByText } = render(
        <CategoryChips {...defaultProps} onSelectCategory={onSelectCategory} />
      );

      fireEvent.press(getByText('gaming'));
      expect(onSelectCategory).toHaveBeenCalledWith('gaming');

      fireEvent.press(getByText('sports'));
      expect(onSelectCategory).toHaveBeenCalledWith('sports');

      fireEvent.press(getByText('music'));
      expect(onSelectCategory).toHaveBeenCalledWith('music');
    });
  });

  // ===========================================================================
  // Visual State Tests
  // ===========================================================================

  describe('Visual State', () => {
    it('renders without errors when no category selected', () => {
      const { getByText } = render(
        <CategoryChips {...defaultProps} selectedCategory={null} />
      );

      expect(getByText('All')).toBeTruthy();
    });

    it('renders without errors when category selected', () => {
      const { getByText } = render(
        <CategoryChips {...defaultProps} selectedCategory="social" />
      );

      expect(getByText('social')).toBeTruthy();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('handles unknown selected category gracefully', () => {
      const { getByText } = render(
        <CategoryChips {...defaultProps} selectedCategory="unknown" />
      );

      // Should still render all chips without crash
      expect(getByText('All')).toBeTruthy();
      expect(getByText('social')).toBeTruthy();
    });

    it('handles rapid selection changes', () => {
      const onSelectCategory = jest.fn();
      const { getByText, rerender } = render(
        <CategoryChips
          {...defaultProps}
          selectedCategory={null}
          onSelectCategory={onSelectCategory}
        />
      );

      fireEvent.press(getByText('social'));
      rerender(
        <CategoryChips
          {...defaultProps}
          selectedCategory="social"
          onSelectCategory={onSelectCategory}
        />
      );

      fireEvent.press(getByText('gaming'));
      rerender(
        <CategoryChips
          {...defaultProps}
          selectedCategory="gaming"
          onSelectCategory={onSelectCategory}
        />
      );

      fireEvent.press(getByText('All'));

      expect(onSelectCategory).toHaveBeenCalledTimes(3);
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================

  describe('Accessibility', () => {
    it('all chips are pressable', () => {
      const onSelectCategory = jest.fn();
      const { getByText } = render(
        <CategoryChips {...defaultProps} onSelectCategory={onSelectCategory} />
      );

      // All chips should be pressable
      fireEvent.press(getByText('All'));
      fireEvent.press(getByText('social'));
      fireEvent.press(getByText('gaming'));
      fireEvent.press(getByText('sports'));
      fireEvent.press(getByText('music'));

      expect(onSelectCategory).toHaveBeenCalledTimes(5);
    });
  });
});
