import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import {
  Copy,
  Flag,
  Ban,
} from 'lucide-react-native';
import { theme } from '../../core/theme';
import { ChatMessage } from '../../types';
import { EMOJIS } from '../../constants/emojis';

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  onReact: (messageId: string, emoji: string) => void;
  onCopy: (content: string) => void;
  onReport: (message: ChatMessage) => void;
  onBlock: (message: ChatMessage) => void;
  onOpenEmojiPicker: (message: ChatMessage) => void;
  isOwn: boolean;
  hasBlocked: boolean;
}

export function MessageContextMenu({
  isOpen,
  onClose,
  message,
  onReact,
  onCopy,
  onReport,
  onBlock,
  onOpenEmojiPicker,
  isOwn,
  hasBlocked,
}: MessageContextMenuProps) {
  if (!message) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <View style={styles.overlayInner}>
          <View style={styles.emojiBar}>
            {EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiButton}
                onPress={() => {
                  onReact(message.id, emoji);
                  onClose();
                }}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.emojiButton}
              onPress={() => {
                onOpenEmojiPicker(message);
              }}
            >
              <View style={styles.plusCircle}>
                <Text style={styles.plusIcon}>+</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.contextMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onCopy(message.content);
                onClose();
              }}
            >
              <Text style={styles.menuItemText}>Copy</Text>
              <Copy size={20} color={theme.tokens.text.primary} />
            </TouchableOpacity>

            {!isOwn && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onReport(message);
                    onClose();
                  }}
                >
                  <Text style={styles.menuItemText}>Report</Text>
                  <Flag size={20} color={theme.tokens.text.primary} />
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={[styles.menuItem, hasBlocked && styles.menuItemDisabled]}
                  onPress={() => {
                    if (!hasBlocked) {
                      onBlock(message);
                      onClose();
                    }
                  }}
                  disabled={hasBlocked}
                >
                  <Text style={[styles.menuItemText, hasBlocked ? styles.menuItemDisabledText : styles.menuItemDanger]}>
                    {hasBlocked ? 'Already Blocked' : 'Block User'}
                  </Text>
                  <Ban size={20} color={hasBlocked ? theme.tokens.text.tertiary : theme.tokens.text.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayInner: {
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
  },
  emojiBar: {
    flexDirection: 'row',
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    shadowColor: theme.tokens.border.strong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emojiButton: {
    paddingHorizontal: 6,
  },
  emojiText: {
    fontSize: 24,
  },
  plusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    color: theme.tokens.text.secondary,
    fontSize: 18,
    fontWeight: '300',
  },
  contextMenu: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
    shadowColor: theme.tokens.border.strong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: theme.tokens.text.primary,
    fontWeight: '400',
  },
  menuItemDisabledText: {
    color: theme.tokens.text.tertiary,
  },
  menuItemDanger: {
    color: theme.tokens.text.error,
  },
  menuDivider: {
    height: 0.5,
    backgroundColor: theme.tokens.border.subtle,
    marginHorizontal: 16,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
});
