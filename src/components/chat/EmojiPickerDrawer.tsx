import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { theme } from '../../core/theme';
import { EMOJI_CATEGORIES } from '../../constants/emojis';
import { ChatMessage } from '../../types';

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  onReact: (messageId: string, emoji: string) => void;
}

export function EmojiPickerDrawer({
  isOpen,
  onClose,
  message,
  onReact,
}: EmojiPickerDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState(0);

  if (!isOpen || !message) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.drawerOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.drawerContent}>
          <View style={styles.drawerHandle} />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {EMOJI_CATEGORIES[selectedCategory].name}
            </Text>
          </View>
          <FlatList
            data={EMOJI_CATEGORIES[selectedCategory].emojis}
            renderItem={({ item: emoji }) => (
              <TouchableOpacity
                style={styles.gridEmojiButton}
                onPress={() => {
                  onReact(message.id, emoji);
                  onClose();
                }}
              >
                <Text style={styles.gridEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item, index) => `${selectedCategory}-${index}`}
            numColumns={8}
            contentContainerStyle={styles.flatListContent}
            removeClippedSubviews={true}
            initialNumToRender={24}
            maxToRenderPerBatch={16}
            windowSize={5}
            getItemLayout={(data, index) => ({
              length: 40,
              offset: 40 * Math.floor(index / 8),
              index,
            })}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.drawerFooter}>
            {EMOJI_CATEGORIES.map((category, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.footerIcon}
                onPress={() => setSelectedCategory(idx)}
              >
                <Text style={[
                  styles.footerIconText,
                  selectedCategory === idx && styles.footerIconActive
                ]}>
                  {category.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  drawerContent: {
    backgroundColor: theme.tokens.bg.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '50%',
    paddingBottom: 60,
    paddingHorizontal: 16,
  },
  drawerHandle: {
    width: 40,
    height: 5,
    backgroundColor: theme.tokens.border.strong,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeader: {
    backgroundColor: theme.tokens.bg.surface,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: theme.tokens.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  flatListContent: {
    paddingBottom: 20,
  },
  gridEmojiButton: {
    width: Dimensions.get('window').width / 8 - 4,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridEmojiText: {
    fontSize: 28,
  },
  drawerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: theme.tokens.border.subtle,
    backgroundColor: theme.tokens.bg.surface,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
  },
  footerIcon: {
    padding: 10,
  },
  footerIconText: {
    fontSize: 20,
    opacity: 0.6,
  },
  footerIconActive: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
  },
});
