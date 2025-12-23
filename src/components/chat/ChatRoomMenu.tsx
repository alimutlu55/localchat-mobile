/**
 * Chat Room Menu Component
 *
 * Dropdown menu from top-right corner with room actions:
 * - Room Info
 * - Mute Notifications
 * - Report Room
 * - Close Room (creator only)
 * - Leave Room
 *
 * Matches web version exactly.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import {
  Info,
  Bell,
  BellOff,
  Flag,
  LogOut,
  XOctagon,
} from 'lucide-react-native';

interface ChatRoomMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomInfo: () => void;
  onLeave: () => void;
  onReport: () => void;
  onMute: () => void;
  isCreator?: boolean;
  onCloseRoom?: () => void;
}

export function ChatRoomMenu({
  isOpen,
  onClose,
  onRoomInfo,
  onLeave,
  onReport,
  onMute,
  isCreator = false,
  onCloseRoom,
}: ChatRoomMenuProps) {
  const [isMuted, setIsMuted] = useState(false);

  const handleMute = () => {
    setIsMuted(!isMuted);
    onMute();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Menu dropdown - positioned at top right */}
        <View style={styles.menuContainer}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
            {/* Room Info */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onRoomInfo();
                onClose();
              }}
            >
              <Info size={20} color="#374151" />
              <Text style={styles.menuItemText}>Room Info</Text>
            </TouchableOpacity>

            {/* Mute Notifications */}
            <TouchableOpacity style={styles.menuItem} onPress={handleMute}>
              {isMuted ? (
                <Bell size={20} color="#374151" />
              ) : (
                <BellOff size={20} color="#374151" />
              )}
              <Text style={styles.menuItemText}>
                {isMuted ? 'Unmute' : 'Mute Notifications'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Report Room */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onReport();
                onClose();
              }}
            >
              <Flag size={20} color="#374151" />
              <Text style={styles.menuItemText}>Report Room</Text>
            </TouchableOpacity>

            {/* Close Room - Creator only */}
            {isCreator && onCloseRoom && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onCloseRoom();
                  onClose();
                }}
              >
                <XOctagon size={20} color="#ef4444" />
                <Text style={[styles.menuItemText, styles.dangerText]}>
                  Close Room
                </Text>
              </TouchableOpacity>
            )}

            {/* Leave Room */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onLeave();
                onClose();
              }}
            >
              <LogOut size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, styles.dangerText]}>
                Leave Room
              </Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    top: 100, // Below the header
    right: 16,
  },
  menu: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 200,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dangerText: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});

export default ChatRoomMenu;

