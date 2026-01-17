import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Clock,
  Users,
  Check,
  Globe,
  Locate,
  ChevronDown,
  ChevronUp,
  MapPin,
  Lock,
} from 'lucide-react-native';

import { RootStackParamList, MainFlowStackParamList } from '../../../navigation/types';
import { roomService } from '../../../services';
import { serializeRoom } from '../../../types';
import { CATEGORIES } from '../../../constants';
import { useMyRooms } from '../hooks';
import { useRoomQuota } from '../hooks/useRoomQuota';
import { useMembership } from '../../user/hooks/useMembership';
import { PrivacyLocationSelector } from '../components/PrivacyLocationSelector';
import { ROOM_CONFIG } from '../../../constants';


type NavigationProp = NativeStackNavigationProp<MainFlowStackParamList, 'CreateRoom'>;
type CreateRoomRouteProp = RouteProp<MainFlowStackParamList, 'CreateRoom'>;

const { width } = Dimensions.get('window');

/**
 * Category option data (matching backend RoomCategory enum)
 */
// CATEGORY_OPTIONS removed in favor of centralized CATEGORIES from constants

/**
 * Duration option data (standard)
 */
const STANDARD_DURATION_OPTIONS: Array<{ label: string; value: number; id: '1h' | '3h' | '6h' }> = [
  { label: '1h', value: 1, id: '1h' },
  { label: '3h', value: 3, id: '3h' },
  { label: '6h', value: 6, id: '6h' },
];

const PRO_DURATION_OPTIONS: Array<{ label: string; value: number; id: '1h' | '3h' | '6h' | '24h' | '3d' | '7d' }> = [
  ...STANDARD_DURATION_OPTIONS,
  { label: '1d', value: 24, id: '24h' },
  { label: '3d', value: 72, id: '3d' },
  { label: '7d', value: 168, id: '7d' },
];

/**
 * Allowed radius values in meters (matching backend database constraint: 0-100000)
 */
const ALLOWED_RADII_METERS = [1000, 5000, 10000, 50000, 100000];

/**
 * Radius options for UI display (converting meters to km)
 */
const RADIUS_OPTIONS = ALLOWED_RADII_METERS.map(meters => ({
  value: meters,
  label: meters >= 1000
    ? `${meters / 1000}km`
    : `${meters}m`
}));

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;

export default function CreateRoomScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreateRoomRouteProp>();
  const insets = useSafeAreaInsets();
  const initialLocation = route.params?.initialLocation;

  // Use hooks instead of context
  const { addRoom: addCreatedRoom } = useMyRooms();
  // const addJoinedRoom = useRoomStore((s) => s.addJoinedRoom); // Unused directly
  // const setRoom = useRoomStore((s) => s.setRoom); // Unused directly

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [durationValue, setDurationValue] = useState(3);
  const [visibilityType, setVisibilityType] = useState<'global' | 'nearby'>('global');
  const [radiusMeters, setRadiusMeters] = useState(1000); // Default to 1km
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { quota, refreshQuota, isLimitReached } = useRoomQuota();
  const { isPro, hasEntitlement } = useMembership();

  const DURATION_OPTIONS = PRO_DURATION_OPTIONS; // Show all options to everyone to encourage Pro upgrade

  // Mode is handled internally by PrivacyLocationSelector, we just need the coord and a flag if we want
  const [locationMode, setLocationMode] = useState<'gps' | 'custom' | null>(null);

  /**
   * Calculate expiration time
   */
  const expirationTime = useMemo(() => {
    const now = new Date();
    const expiry = new Date(now.getTime() + durationValue * 60 * 60 * 1000);

    // Check if it's tomorrow or later
    const isToday = expiry.toDateString() === now.toDateString();

    if (isToday) {
      return `today at ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      // Show date and time for multi-day rooms
      const dateStr = expiry.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const timeStr = expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} at ${timeStr}`;
    }
  }, [durationValue]);

  /**
   * Handle room creation
   */
  const handleCreate = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert('Title Required', 'Please enter a room title.');
      return;
    }

    // Validate minimum title length (matches backend validation)
    if (trimmedTitle.length < 3) {
      Alert.alert('Title Too Short', 'Room title must be at least 3 characters.');
      return;
    }

    if (!categoryLabel) {
      Alert.alert('Category Required', 'Please select a category.');
      return;
    }

    if (!location) {
      Alert.alert('Location Required', 'Could not determine your location.');
      return;
    }

    setIsLoading(true);

    try {
      const selectedCategory = CATEGORIES.find(c => c.label === categoryLabel);
      const categoryId = selectedCategory?.id || 'FOOD_DINING';
      const durationId = DURATION_OPTIONS.find(d => d.value === durationValue)?.id || '3h';

      const room = await roomService.createRoom({
        title: title.trim(),
        description: description.trim() || undefined,
        category: categoryId,
        duration: durationId as any,
        maxParticipants,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: visibilityType === 'global' ? 0 : radiusMeters,
      });

      // Ensure isCreator is set to true since we just created this room
      const roomWithCreatorFlag = {
        ...room,
        isCreator: true,
        hasJoined: true,
      };

      // Add room to context so it receives WebSocket updates
      // Room added to context before navigation

      // Refresh quota after creation to get latest used count and reset time
      refreshQuota();

      // Show success and navigate
      addCreatedRoom(roomWithCreatorFlag);

      // Enter the chat while replacing the creation screen so 'back' goes to Discovery
      navigation.replace('ChatRoom', { roomId: roomWithCreatorFlag.id, initialRoom: serializeRoom(roomWithCreatorFlag) });
    } catch (error) {
      console.error('Failed to create room:', error);

      // Extract user-friendly error message from API response
      let errorMessage = 'Failed to create room. Please try again.';
      if (error instanceof Error) {
        // ApiError has a message property with the specific validation error
        // e.g., "Title must be 3-60 characters"
        errorMessage = error.message || errorMessage;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <X size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Room</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Room Title */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Room Title <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Coffee Meetup"
                placeholderTextColor="#94a3b8"
                value={title}
                onChangeText={setTitle}
                maxLength={MAX_TITLE_LENGTH}
                autoCapitalize="none"
              />
              <Text style={styles.charLimit}>
                {title.length}/{MAX_TITLE_LENGTH}
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Description <Text style={styles.optionalText}>(Optional)</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="What's this room about?"
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                maxLength={MAX_DESCRIPTION_LENGTH}
                multiline
                numberOfLines={3}
              />
              <Text style={[styles.charLimit, { bottom: 12 }]}>
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </Text>
            </View>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Category <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View style={styles.categoryScrollContainer}>
              <ScrollView
                style={styles.categoryScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setCategoryLabel(cat.label)}
                      activeOpacity={0.7}
                    >
                      {categoryLabel === cat.label ? (
                        <LinearGradient
                          colors={['#FF6410', '#f43f5e']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.categoryChip}
                        >
                          <Text style={[styles.categoryText, { color: '#fff' }]}>
                            {cat.emoji} {cat.label}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.categoryChip, styles.categoryChipInactive]}>
                          <Text style={styles.categoryText}>
                            {cat.emoji} {cat.label}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Room Location Selector */}
          <View style={styles.section}>
            <PrivacyLocationSelector
              onLocationChange={(loc, mode) => {
                setLocation(loc);
                setLocationMode(mode);
              }}
            />
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((dur) => {
                const isExtended = dur.value > 6;
                const isLocked = isExtended && !isPro;

                return (
                  <TouchableOpacity
                    key={dur.id}
                    style={styles.durationButton}
                    onPress={() => {
                      if (isLocked) {
                        navigation.navigate('CustomPaywall' as never);
                      } else {
                        setDurationValue(dur.value);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {durationValue === dur.value && !isLocked ? (
                      <LinearGradient
                        colors={['#FF6410', '#FF8C42']}
                        style={styles.durationGradient}
                      >
                        <Text style={styles.durationTextActive}>{dur.label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.durationInactive, isLocked && styles.durationLocked]}>
                        <Text style={[styles.durationText, isLocked && styles.durationTextLocked]}>
                          {dur.label}
                        </Text>
                        {isLocked && <Lock size={10} color="#94a3b8" style={styles.lockIcon} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.expiryRow}>
              <Clock size={14} color="#94a3b8" />
              <Text style={styles.expiryText}>Expires at {expirationTime}</Text>
            </View>
          </View>

          {/* Visibility Range */}
          <View style={styles.section}>
            <Text style={styles.label}>Visibility Range</Text>
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[
                  styles.visibilityCard,
                  visibilityType === 'global' && styles.visibilityCardActive,
                ]}
                onPress={() => setVisibilityType('global')}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.visibilityIconBox,
                  visibilityType === 'global' && styles.visibilityIconBoxActive
                ]}>
                  <Globe size={18} color={visibilityType === 'global' ? '#fff' : '#94a3b8'} />
                </View>
                <View style={styles.visibilityContent}>
                  <Text style={[
                    styles.visibilityTitle,
                    visibilityType === 'global' && styles.visibilityTitleActive
                  ]}>Global</Text>
                  <Text style={styles.visibilityDesc}>Open to everyone worldwide</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityCard,
                  visibilityType === 'nearby' && styles.visibilityCardActive,
                ]}
                onPress={() => setVisibilityType('nearby')}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.visibilityIconBox,
                  visibilityType === 'nearby' && styles.visibilityIconBoxActive
                ]}>
                  <Locate size={18} color={visibilityType === 'nearby' ? '#fff' : '#94a3b8'} />
                </View>
                <View style={styles.visibilityContent}>
                  <Text style={[
                    styles.visibilityTitle,
                    visibilityType === 'nearby' && styles.visibilityTitleActive
                  ]}>NearBy</Text>
                  <Text style={styles.visibilityDesc}>Only people within distance</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Radius Picker (Predefined Values) */}
            {visibilityType === 'nearby' && (
              <View style={styles.radiusContainer}>
                <View style={styles.radiusHeader}>
                  <View style={styles.radiusLabelRow}>
                    <MapPin size={16} color="#FF6410" />
                    <Text style={styles.radiusLabel}>Visibility Range</Text>
                  </View>
                </View>

                <View style={styles.radiusGrid}>
                  {RADIUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.radiusOption,
                        radiusMeters === option.value && styles.radiusOptionActive,
                      ]}
                      onPress={() => setRadiusMeters(option.value)}
                      activeOpacity={0.7}
                    >
                      {radiusMeters === option.value && (
                        <View style={styles.radiusCheckmark}>
                          <Check size={12} color="#fff" />
                        </View>
                      )}
                      <Text style={[
                        styles.radiusOptionText,
                        radiusMeters === option.value && styles.radiusOptionTextActive,
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.radiusHint}>
                  Users must be within this range to see and join your room
                </Text>
              </View>
            )}
          </View>

          {/* Advanced Options */}
          <View style={styles.advancedSection}>
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
              activeOpacity={0.6}
            >
              <Text style={styles.advancedToggleText}>Advanced Options</Text>
              {showAdvanced ? (
                <ChevronUp size={18} color="#64748b" />
              ) : (
                <ChevronDown size={18} color="#64748b" />
              )}
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedContent}>
                <View style={styles.advancedRow}>
                  <Users size={16} color="#64748b" />
                  <Text style={styles.advancedLabel}>Max Participants</Text>
                  <Text style={styles.advancedValue}>{maxParticipants}</Text>
                </View>
                <View style={styles.participantOptions}>
                  {(hasEntitlement('UNLIMITED_PARTICIPANTS') ? [50, 100, 500, 1000, 5000, 9999] : [50, 100, 200, 500]).map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.participantChip,
                        maxParticipants === val && styles.participantChipActive
                      ]}
                      onPress={() => setMaxParticipants(val)}
                    >
                      <Text style={[
                        styles.participantChipText,
                        maxParticipants === val && styles.participantChipTextActive
                      ]}>{val === 9999 ? '999+' : val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer - Fixed at bottom safe area */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isLoading || !title.trim() || !categoryLabel || isLimitReached || !location || !locationMode}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FF6410', '#ff4d4d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.createRoomButton,
              (isLoading || !title.trim() || !categoryLabel || isLimitReached || !location || !locationMode) && { opacity: 0.5 }
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createRoomButtonText}>
                {isLimitReached ? "Daily Limit Reached" : "Create Room"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.dailyLimitText, isLimitReached && styles.limitReachedText]}>
          Daily limit: {quota?.used ?? 0}/{hasEntitlement('INCREASED_QUOTA') ? ROOM_CONFIG.PRO_LIMITS.DAILY_ROOMS : (quota?.limit ?? 3)} rooms
        </Text>
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  cancelButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  optionalText: {
    fontWeight: '400',
    color: '#94a3b8',
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingBottom: 30,
  },
  charLimit: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    fontSize: 12,
    color: '#94a3b8',
  },
  categoryScrollContainer: {
    maxHeight: 145, // Limits to ~3 lines of chips
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  categoryScrollView: {
    flexGrow: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4, // Minor padding for scroll breathing room
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipInactive: {
    backgroundColor: '#f1f5f9',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationButton: {
    width: (width - 40 - 20) / 3, // Subtracting 40 for horizontal padding and 20 for gaps
  },
  durationGradient: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationInactive: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  durationTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  durationLocked: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  durationTextLocked: {
    color: '#94a3b8',
  },
  lockIcon: {
    marginTop: 1,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  expiryText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  visibilityCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  visibilityCardActive: {
    borderColor: '#FF6410',
    backgroundColor: '#fff7ed',
  },
  visibilityIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  visibilityIconBoxActive: {
    backgroundColor: '#FF6410',
  },
  visibilityContent: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  visibilityTitleActive: {
    color: '#FF6410',
  },
  visibilityDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  radiusContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  radiusHeader: {
    marginBottom: 12,
  },
  radiusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  radiusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  radiusOption: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minWidth: '30%',
    alignItems: 'center',
  },
  radiusOptionActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#FF6410',
  },
  radiusCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6410',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  radiusOptionTextActive: {
    color: '#FF6410',
  },
  radiusHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  advancedSection: {
    marginTop: 8,
    marginBottom: 32,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
  },
  advancedContent: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  advancedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  advancedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  participantOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  participantChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  participantChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#FF6410',
  },
  participantChipText: {
    fontSize: 13,
    color: '#64748b',
  },
  participantChipTextActive: {
    color: '#FF6410',
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  createRoomButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6410',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createRoomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dailyLimitText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
  },
  limitReachedText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  // Location mode preview styles
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    gap: 8,
  },
  locationPreviewText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
  },
  locationChangeLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6410',
  },
});
