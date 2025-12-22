/**
 * Create Room Screen
 *
 * Form to create a new chat room.
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import {
  X,
  MapPin,
  Clock,
  Users,
  Check,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { roomService } from '../services';
import { RoomCategory, RoomDuration } from '../types';
import { CATEGORIES, ROOM_CONFIG } from '../constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateRoom'>;

/**
 * Category option data
 */
const CATEGORY_OPTIONS: Array<{ id: RoomCategory; emoji: string; label: string }> = [
  { id: 'GENERAL', emoji: '💬', label: 'General' },
  { id: 'TRAFFIC', emoji: '🚗', label: 'Traffic' },
  { id: 'EVENTS', emoji: '🎉', label: 'Events' },
  { id: 'EMERGENCY', emoji: '🚨', label: 'Emergency' },
  { id: 'LOST_FOUND', emoji: '🔍', label: 'Lost & Found' },
  { id: 'SPORTS', emoji: '⚽', label: 'Sports' },
  { id: 'FOOD', emoji: '🍕', label: 'Food' },
  { id: 'NEIGHBORHOOD', emoji: '🏘️', label: 'Neighborhood' },
];

/**
 * Duration option data
 */
const DURATION_OPTIONS: Array<{ id: RoomDuration; label: string; backendValue: '1h' | '3h' | '6h' | '24h' }> = [
  { id: 'short', label: '1 hour', backendValue: '1h' },
  { id: 'medium', label: '3 hours', backendValue: '3h' },
  { id: 'long', label: '8 hours', backendValue: '6h' },
  { id: 'extended', label: '24 hours', backendValue: '24h' },
];

/**
 * Map UI duration to backend format
 */
function mapDurationToBackend(duration: RoomDuration): '1h' | '3h' | '6h' | '24h' {
  const option = DURATION_OPTIONS.find(opt => opt.id === duration);
  return option?.backendValue || '3h';
}

/**
 * Create Room Screen Component
 */
export default function CreateRoomScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RoomCategory>('GENERAL');
  const [duration, setDuration] = useState<RoomDuration>('medium');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(true);

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
   * Get selected category emoji
   */
  const selectedCategoryEmoji = CATEGORY_OPTIONS.find(c => c.id === category)?.emoji || '💬';

  /**
   * Handle room creation
   */
  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a room title.');
      return;
    }

    if (!location) {
      Alert.alert('Location Required', 'Could not determine your location.');
      return;
    }

    setIsLoading(true);

    try {
      const room = await roomService.createRoom({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        duration: mapDurationToBackend(duration),
        maxParticipants,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: 5000, // Default 5km radius to match web's privacy feel
      });

      // Navigate to the new room
      navigation.replace('ChatRoom', { room });
    } catch (error) {
      console.error('Failed to create room:', error);
      Alert.alert('Error', 'Failed to create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Room</Text>
          <TouchableOpacity
            style={[styles.createButton, (!title.trim() || isLoading) && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.createButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Room Title *</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="What's happening?"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              maxLength={50}
              autoFocus
            />
            <Text style={styles.charCount}>{title.length}/50</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Add more details..."
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryOption,
                    category === cat.id && styles.categoryOptionSelected,
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={[
                    styles.categoryLabel,
                    category === cat.id && styles.categoryLabelSelected,
                  ]}>
                    {cat.label}
                  </Text>
                  {category === cat.id && (
                    <View style={styles.categoryCheck}>
                      <Check size={12} color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Clock size={16} color="#6b7280" />
              <Text style={styles.label}>Duration</Text>
            </View>
            <View style={styles.durationOptions}>
              {DURATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.durationOption,
                    duration === opt.id && styles.durationOptionSelected,
                  ]}
                  onPress={() => setDuration(opt.id)}
                >
                  <Text style={[
                    styles.durationLabel,
                    duration === opt.id && styles.durationLabelSelected,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Max Participants */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Users size={16} color="#6b7280" />
              <Text style={styles.label}>Max Participants</Text>
              <Text style={styles.participantValue}>{maxParticipants}</Text>
            </View>
            <View style={styles.participantOptions}>
              {[10, 20, 30, 50].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.participantOption,
                    maxParticipants === num && styles.participantOptionSelected,
                  ]}
                  onPress={() => setMaxParticipants(num)}
                >
                  <Text style={[
                    styles.participantLabel,
                    maxParticipants === num && styles.participantLabelSelected,
                  ]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location Info */}
          <View style={styles.locationInfo}>
            <MapPin size={16} color="#22c55e" />
            <Text style={styles.locationText}>
              Room will be created at your current location
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
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  createButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#fdba74',
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  titleInput: {
    fontSize: 18,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  descriptionInput: {
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  categoryOptionSelected: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryLabelSelected: {
    color: '#f97316',
  },
  categoryCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  durationOption: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  durationOptionSelected: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  durationLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  durationLabelSelected: {
    color: '#f97316',
  },
  participantValue: {
    marginLeft: 'auto',
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  participantOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  participantOption: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  participantOptionSelected: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  participantLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  participantLabelSelected: {
    color: '#f97316',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 10,
    marginTop: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#15803d',
    flex: 1,
  },
});

