/**
 * Create Room Screen
 *
 * Form to create a new chat room, matching the web app design.
 */

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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  MapPin,
  Clock,
  Users,
  Check,
  Globe,
  Locate,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { roomService } from '../services';
import { RoomCategory, RoomDuration } from '../types';
import { CATEGORIES } from '../constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateRoom'>;

const { width } = Dimensions.get('window');

/**
 * Category option data (matching backend RoomCategory enum)
 */
const CATEGORY_OPTIONS = [
  { emoji: '🍕', label: 'Food & Dining', id: 'FOOD' as RoomCategory },
  { emoji: '🎉', label: 'Events', id: 'EVENTS' as RoomCategory },
  { emoji: '⚽', label: 'Sports', id: 'SPORTS' as RoomCategory },
  { emoji: '🚗', label: 'Traffic', id: 'TRAFFIC' as RoomCategory },
  { emoji: '🏘️', label: 'Neighborhood', id: 'NEIGHBORHOOD' as RoomCategory },
  { emoji: '🔍', label: 'Lost & Found', id: 'LOST_FOUND' as RoomCategory },
  { emoji: '🚨', label: 'Emergency', id: 'EMERGENCY' as RoomCategory },
  { emoji: '💬', label: 'General', id: 'GENERAL' as RoomCategory },
];

/**
 * Duration option data (matching web)
 */
const DURATION_OPTIONS: Array<{ label: string; value: number; id: '1h' | '3h' | '6h' }> = [
  { label: '1h', value: 1, id: '1h' },
  { label: '3h', value: 3, id: '3h' },
  { label: '6h', value: 6, id: '6h' },
];

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;

export default function CreateRoomScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [durationValue, setDurationValue] = useState(3);
  const [visibilityType, setVisibilityType] = useState<'global' | 'nearby'>('global');
  const [radius, setRadius] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [roomsCreatedToday] = useState(2);

  // For slider stability
  const sliderRef = React.useRef<View>(null);
  const [sliderLayout, setSliderLayout] = useState({ x: 0, width: 0 });

  /**
   * Get current location on mount
   */
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location Required', 'Please enable location to create a room.');
          navigation.goBack();
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (error) {
        console.error('Location error:', error);
        Alert.alert('Error', 'Could not get your location.');
      } finally {
        setIsGettingLocation(false);
      }
    };

    getLocation();
  }, []);

  /**
   * Calculate expiration time
   */
  const expirationTime = useMemo(() => {
    const now = new Date();
    now.setHours(now.getHours() + durationValue);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [durationValue]);

  /**
   * Handle room creation
   */
  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a room title.');
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
      const selectedCategory = CATEGORY_OPTIONS.find(c => c.label === categoryLabel);
      const categoryId = selectedCategory?.id || 'GENERAL';
      const durationId = DURATION_OPTIONS.find(d => d.value === durationValue)?.id || '3h';

      const room = await roomService.createRoom({
        title: title.trim(),
        description: description.trim() || undefined,
        category: categoryId,
        duration: durationId as '1h' | '3h' | '6h' | '24h',
        maxParticipants,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: visibilityType === 'global' ? 0 : radius * 1000,
      });

      // Ensure isCreator is set to true since we just created this room
      const roomWithCreatorFlag = {
        ...room,
        isCreator: true,
        hasJoined: true,
      };

      // Navigate to the new room
      navigation.replace('ChatRoom', { room: roomWithCreatorFlag });
    } catch (error) {
      console.error('Failed to create room:', error);
      Alert.alert('Error', 'Failed to create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Slider touch with pageX for stability
   */
  const handleSliderTouch = (event: any) => {
    const { pageX } = event.nativeEvent;
    // Calculate relative X inside the track
    const relativeX = pageX - sliderLayout.x;
    const percentage = Math.max(0, Math.min(1, relativeX / sliderLayout.width));
    const newValue = Math.round(percentage * 99) + 1;
    setRadius(newValue);
  };

  /**
   * On slider layout change
   */
  const onSliderLayout = () => {
    sliderRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setSliderLayout({ x: pageX, width });
    });
  };

  if (isGettingLocation) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <X size={20} color="#64748b" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Room</Text>
          <View style={{ width: 80 }} />
        </View>

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
            <View style={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat.label}
                  onPress={() => setCategoryLabel(cat.label)}
                  activeOpacity={0.7}
                >
                  {categoryLabel === cat.label ? (
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
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
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((dur) => (
                <TouchableOpacity
                  key={dur.label}
                  style={styles.durationButton}
                  onPress={() => setDurationValue(dur.value)}
                  activeOpacity={0.7}
                >
                  {durationValue === dur.value ? (
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.durationGradient}
                    >
                      <Text style={[styles.durationText, { color: '#fff' }]}>
                        {dur.label}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.durationInactive}>
                      <Text style={styles.durationText}>{dur.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
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

            {/* Distance Slider (Matching Web) */}
            {visibilityType === 'nearby' && (
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <View style={styles.sliderLabelRow}>
                    <MapPin size={16} color="#f97316" />
                    <Text style={styles.sliderLabel}>Search Range</Text>
                  </View>
                  <View style={styles.sliderValueBox}>
                    <Text style={styles.sliderValueText}>{radius} km</Text>
                  </View>
                </View>

                <View
                  ref={sliderRef}
                  style={styles.sliderTrackWrapper}
                  onLayout={onSliderLayout}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleSliderTouch}
                  onResponderMove={handleSliderTouch}
                >
                  <View style={styles.sliderTrackBase}>
                    <LinearGradient
                      colors={['#f97316', '#f43f5e']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.sliderTrackActive, { width: `${((radius - 1) / 99) * 100}%` }]}
                    />
                  </View>
                  <View style={[styles.sliderThumb, { left: `${((radius - 1) / 99) * 100}%` }]}>
                    <View style={styles.sliderThumbInner} />
                  </View>
                </View>

                <View style={styles.sliderMarkers}>
                  <Text style={styles.sliderMarkerText}>1 km</Text>
                  <Text style={styles.sliderMarkerText}>50 km</Text>
                  <Text style={styles.sliderMarkerText}>100 km</Text>
                </View>
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
                {/* Simplified slider for participants since standard RN slider needs extra lib */}
                <View style={styles.participantOptions}>
                  {[50, 100, 200, 500].map(val => (
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
                      ]}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Create Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={isLoading || !title.trim() || !categoryLabel}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#f97316', '#ff4d4d']} // Refined for more vibrance
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.createRoomButton,
                  (isLoading || !title.trim() || !categoryLabel) && { opacity: 0.5 }
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createRoomButtonText}>Create Room</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.dailyLimitText}>
              Daily limit: {roomsCreatedToday}/3 rooms
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cancelText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
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
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipInactive: {
    backgroundColor: '#f1f5f9',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationButton: {
    flex: 1,
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
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  visibilityCardActive: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  visibilityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  visibilityIconBoxActive: {
    backgroundColor: '#f97316',
  },
  visibilityContent: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  visibilityTitleActive: {
    color: '#f97316',
  },
  visibilityDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  sliderContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  sliderValueBox: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sliderValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
  },
  sliderTrackWrapper: {
    height: 30,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrackBase: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  sliderTrackActive: {
    height: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f97316',
    marginLeft: -12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderThumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  sliderMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderMarkerText: {
    fontSize: 11,
    color: '#94a3b8',
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
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  advancedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 8,
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
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  participantChipActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  participantChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  participantChipTextActive: {
    color: '#fff',
  },
  footer: {
    gap: 12,
  },
  createRoomButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  createRoomButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  dailyLimitText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94a3b8',
  },
});

