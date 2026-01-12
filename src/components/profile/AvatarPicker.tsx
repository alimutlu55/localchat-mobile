/**
 * Avatar Picker Component - Improved for All iPhone Sizes
 *
 * DiceBear avatar picker with:
 * - Multiple avatar styles
 * - Shuffle functionality
 * - Preview
 * - SVG Support via react-native-svg
 * - Responsive design for all iPhone sizes (SE to Pro Max)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { X, Shuffle, Check } from 'lucide-react-native';
import { SvgUri } from 'react-native-svg';
import { theme } from '../../core/theme';

// DiceBear avatar styles
const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'adventurer-neutral', name: 'Neutral' },
  { id: 'fun-emoji', name: 'Emoji' },
  { id: 'bottts', name: 'Robots' },
  { id: 'avataaars', name: 'Avataaars' },
  { id: 'pixel-art', name: 'Pixel' },
  { id: 'lorelei', name: 'Lorelei' },
  { id: 'notionists', name: 'Notionists' },
] as const;

type AvatarStyle = (typeof AVATAR_STYLES)[number]['id'];

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  onSelect: (avatarUrl: string) => void;
}

/**
 * Generate a DiceBear avatar URL
 */
export function generateAvatarUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Generate a random seed for avatar generation
 */
function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Calculate responsive dimensions based on screen size
 */
function useResponsiveDimensions() {
  const { width, height } = useWindowDimensions();

  // Screen size categories
  const isSmallDevice = width < 375; // iPhone SE, 12/13 mini
  const isMediumDevice = width >= 375 && width < 414; // iPhone 12/13/14 Pro
  const isLargeDevice = width >= 414; // iPhone 14 Plus, Pro Max

  return {
    width,
    height,
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    // Preview size
    previewSize: isSmallDevice ? 100 : isMediumDevice ? 120 : 140,
    // Grid columns
    gridColumns: isSmallDevice ? 3 : 4,
    // Modal max height
    modalMaxHeight: height * 0.9,
    // Bottom padding for safe area
    bottomPadding: Platform.OS === 'ios' ? 34 : 20,
  };
}

export function AvatarPicker({
  isOpen,
  onClose,
  currentAvatarUrl,
  onSelect,
}: AvatarPickerProps) {
  const dimensions = useResponsiveDimensions();
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>('adventurer');
  const [seeds, setSeeds] = useState<Record<string, string>>(() => {
    const initialSeeds: Record<string, string> = {};
    AVATAR_STYLES.forEach((style) => {
      initialSeeds[style.id] = generateRandomSeed();
    });
    return initialSeeds;
  });
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);

  // Generate avatar options for selected style - responsive count
  const avatarOptions = useMemo(() => {
    const options: { seed: string; url: string }[] = [];
    // Show 6 options on small devices, 8 on larger
    const optionCount = dimensions.isSmallDevice ? 6 : 8;
    for (let i = 0; i < optionCount; i++) {
      const seed = `${seeds[selectedStyle]}-${i}`;
      options.push({
        seed,
        url: generateAvatarUrl(selectedStyle, seed),
      });
    }
    return options;
  }, [selectedStyle, seeds, dimensions.isSmallDevice]);

  const handleStyleChange = (styleId: AvatarStyle) => {
    setSelectedStyle(styleId);
    setSelectedAvatarUrl(null);
  };

  const handleShuffle = () => {
    setSeeds((prev) => ({
      ...prev,
      [selectedStyle]: generateRandomSeed(),
    }));
    setSelectedAvatarUrl(null);
  };

  const handleSelectAvatar = (url: string) => {
    setSelectedAvatarUrl(url);
  };

  const handleConfirm = () => {
    if (selectedAvatarUrl) {
      onSelect(selectedAvatarUrl);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedAvatarUrl(null);
    onClose();
  };

  const previewUrl = selectedAvatarUrl || avatarOptions[0]?.url;
  const hasChanges = selectedAvatarUrl !== null && selectedAvatarUrl !== currentAvatarUrl;

  // Calculate grid item width based on columns and gaps
  const gridGap = dimensions.isSmallDevice ? 8 : 12;
  const gridPadding = dimensions.isSmallDevice ? 16 : 20;
  const gridItemWidth = (dimensions.width - (gridPadding * 2) - (gridGap * (dimensions.gridColumns - 1))) / dimensions.gridColumns;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { maxHeight: dimensions.modalMaxHeight }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[
              styles.title,
              dimensions.isSmallDevice && styles.titleSmall
            ]}>
              Choose Avatar
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={dimensions.isSmallDevice ? 18 : 20} color={theme.tokens.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Preview */}
            <View style={[
              styles.previewContainer,
              dimensions.isSmallDevice && styles.previewContainerSmall
            ]}>
              <View style={[
                styles.previewWrapper,
                {
                  width: dimensions.previewSize,
                  height: dimensions.previewSize,
                  borderRadius: dimensions.previewSize / 2,
                }
              ]}>
                <SvgUri
                  uri={previewUrl}
                  width="100%"
                  height="100%"
                />
              </View>
            </View>

            {/* Style Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.styleTabs}
              contentContainerStyle={[
                styles.styleTabsContent,
                dimensions.isSmallDevice && styles.styleTabsContentSmall
              ]}
            >
              {AVATAR_STYLES.map((style) => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.styleTab,
                    dimensions.isSmallDevice && styles.styleTabSmall,
                    selectedStyle === style.id && styles.styleTabActive,
                  ]}
                  onPress={() => handleStyleChange(style.id)}
                >
                  <Text
                    style={[
                      styles.styleTabText,
                      dimensions.isSmallDevice && styles.styleTabTextSmall,
                      selectedStyle === style.id && styles.styleTabTextActive,
                    ]}
                  >
                    {style.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Avatar Grid */}
            <View style={[
              styles.gridContainer,
              { padding: gridPadding }
            ]}>
              <View style={styles.gridHeader}>
                <Text style={[
                  styles.gridTitle,
                  dimensions.isSmallDevice && styles.gridTitleSmall
                ]}>
                  Select an avatar
                </Text>
                <TouchableOpacity
                  style={[
                    styles.shuffleButton,
                    dimensions.isSmallDevice && styles.shuffleButtonSmall
                  ]}
                  onPress={handleShuffle}
                >
                  <Shuffle size={dimensions.isSmallDevice ? 14 : 16} color={theme.tokens.brand.primary} />
                  <Text style={[
                    styles.shuffleText,
                    dimensions.isSmallDevice && styles.shuffleTextSmall
                  ]}>
                    Shuffle
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.grid, { gap: gridGap }]}>
                {avatarOptions.map((option) => (
                  <TouchableOpacity
                    key={option.seed}
                    style={[
                      styles.avatarOption,
                      {
                        width: gridItemWidth,
                        height: gridItemWidth,
                      },
                      selectedAvatarUrl === option.url && styles.avatarOptionSelected,
                    ]}
                    onPress={() => handleSelectAvatar(option.url)}
                  >
                    <View style={styles.avatarImageContainer}>
                      <SvgUri
                        uri={option.url}
                        width="100%"
                        height="100%"
                      />
                    </View>
                    {selectedAvatarUrl === option.url && (
                      <View style={styles.selectedCheck}>
                        <Check size={10} color={theme.tokens.text.onPrimary} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Confirm Button - Fixed at bottom */}
          <View style={[
            styles.footer,
            { paddingBottom: dimensions.bottomPadding }
          ]}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                dimensions.isSmallDevice && styles.confirmButtonSmall,
                !hasChanges && styles.confirmButtonDisabled
              ]}
              onPress={handleConfirm}
              disabled={!hasChanges}
            >
              <Text style={[
                styles.confirmButtonText,
                dimensions.isSmallDevice && styles.confirmButtonTextSmall
              ]}>
                Save Avatar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Avatar Display Component
 *
 * Reusable avatar display with fallback to initials.
 * Supports SVG URLs via SvgUri with proper loading states.
 * Uses UserStore for avatar caching to prevent empty flashes.
 */
interface AvatarDisplayProps {
  avatarUrl?: string;
  displayName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: any;
}

const SIZE_STYLES = {
  sm: { container: 32, text: 14 },
  md: { container: 44, text: 18 },
  lg: { container: 64, text: 24 },
  xl: { container: 96, text: 36 },
};

/**
 * Fallback component showing initials
 */
function AvatarFallback({
  displayName,
  dimensions,
  style,
  isPlaceholder = false,
}: {
  displayName: string;
  dimensions: { container: number; text: number };
  style?: any;
  isPlaceholder?: boolean;
}) {
  return (
    <View
      style={[{
        width: dimensions.container,
        height: dimensions.container,
        borderRadius: dimensions.container / 2,
        backgroundColor: isPlaceholder ? theme.tokens.bg.subtle : theme.tokens.brand.primary,
        justifyContent: 'center',
        alignItems: 'center',
      }, style]}
    >
      <Text style={{
        fontSize: dimensions.text,
        fontWeight: '600',
        color: isPlaceholder ? theme.tokens.text.tertiary : theme.tokens.text.onPrimary
      }}>
        {displayName?.charAt(0).toUpperCase() || 'U'}
      </Text>
    </View>
  );
}

export function AvatarDisplay({ avatarUrl, displayName, size = 'md', style }: AvatarDisplayProps) {
  const dimensions = SIZE_STYLES[size];
  const [hasError, setHasError] = React.useState(false);

  // Normalize empty strings and various "null/undefined" string variants to undefined
  const validAvatarUrl = useMemo(() => {
    if (!avatarUrl) return undefined;
    const trimmed = avatarUrl.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'nan') return undefined;
    return avatarUrl;
  }, [avatarUrl]);

  // Reset error state when URL changes
  React.useEffect(() => {
    if (validAvatarUrl) {
      setHasError(false);
    }
  }, [validAvatarUrl]);

  const handleError = React.useCallback(() => {
    setHasError(true);
  }, []);

  // No URL or error - show fallback with initials
  if (!validAvatarUrl || hasError) {
    return (
      <AvatarFallback
        displayName={displayName}
        dimensions={dimensions}
        style={style}
        isPlaceholder={false}
      />
    );
  }

  const isSvg = validAvatarUrl.toLowerCase().endsWith('.svg') || validAvatarUrl.includes('dicebear');

  // Avatar is preloaded on login via Image.prefetch() in UserStore
  // Just render the image - RN's native cache handles the rest
  return (
    <View
      style={[{
        width: dimensions.container,
        height: dimensions.container,
        borderRadius: dimensions.container / 2,
        backgroundColor: theme.tokens.bg.subtle,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }, style]}
    >
      {isSvg ? (
        <SvgUri
          uri={validAvatarUrl}
          width="100%"
          height="100%"
          onError={handleError}
        />
      ) : (
        <Image
          source={{ uri: validAvatarUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.tokens.border.strong,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.tokens.border.subtle,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  titleSmall: {
    fontSize: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  previewContainerSmall: {
    paddingVertical: 16,
  },
  previewWrapper: {
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.tokens.border.focus,
  },
  styleTabs: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    maxHeight: 50,
  },
  styleTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  styleTabsContentSmall: {
    paddingHorizontal: 12,
    gap: 6,
  },
  styleTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.tokens.bg.subtle,
  },
  styleTabSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  styleTabActive: {
    backgroundColor: theme.tokens.action.secondary.default,
  },
  styleTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.tokens.text.secondary,
  },
  styleTabTextSmall: {
    fontSize: 12,
  },
  styleTabTextActive: {
    color: theme.tokens.brand.primary,
  },
  gridContainer: {
    paddingBottom: 16,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.tokens.text.secondary,
  },
  gridTitleSmall: {
    fontSize: 13,
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.tokens.action.secondary.default,
    borderRadius: 16,
  },
  shuffleButtonSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  shuffleText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.tokens.brand.primary,
  },
  shuffleTextSmall: {
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  avatarOption: {
    borderRadius: 12,
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarOptionSelected: {
    borderColor: theme.tokens.border.focus,
    backgroundColor: theme.tokens.action.secondary.default,
  },
  avatarImageContainer: {
    width: '80%',
    height: '80%',
  },
  selectedCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.tokens.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.tokens.border.subtle,
    backgroundColor: '#ffffff',
  },
  confirmButton: {
    backgroundColor: theme.tokens.action.primary.default,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonSmall: {
    padding: 14,
  },
  confirmButtonDisabled: {
    backgroundColor: theme.tokens.action.disabled.bg,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.tokens.action.primary.contrast,
  },
  confirmButtonTextSmall: {
    fontSize: 15,
  },
});

export default AvatarPicker;