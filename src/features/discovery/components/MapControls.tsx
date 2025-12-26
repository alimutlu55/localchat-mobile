/**
 * MapControls Component
 *
 * Floating controls for the map screen:
 * - Zoom in/out buttons
 * - Center on user location
 * - Reset to world view
 *
 * Extracted from MapScreen for better separation of concerns.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus, Navigation, Globe } from 'lucide-react-native';

interface MapControlsProps {
  /** Handler for zoom in */
  onZoomIn: () => void;
  /** Handler for zoom out */
  onZoomOut: () => void;
  /** Handler for center on user */
  onCenterUser: () => void;
  /** Handler for reset to world view */
  onResetView: () => void;
  /** Whether user location is available */
  hasUserLocation: boolean;
  /** Current zoom level (for conditional rendering) */
  currentZoom: number;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onCenterUser,
  onResetView,
  hasUserLocation,
  currentZoom,
}: MapControlsProps) {
  return (
    <View style={styles.container}>
      {/* Zoom Card */}
      <View style={styles.zoomCard}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={onZoomIn}
          activeOpacity={0.7}
        >
          <Plus size={18} color="#374151" strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={onZoomOut}
          activeOpacity={0.7}
        >
          <Minus size={18} color="#374151" strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {/* Center on User */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          hasUserLocation && styles.controlButtonActive,
        ]}
        onPress={onCenterUser}
        activeOpacity={0.7}
      >
        <Navigation
          size={18}
          color={hasUserLocation ? '#2563eb' : '#6b7280'}
          strokeWidth={1.5}
        />
      </TouchableOpacity>

      {/* Reset to World View */}
      {currentZoom > 3 && (
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onResetView}
          activeOpacity={0.7}
        >
          <Globe size={18} color="#f97316" strokeWidth={1.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 150,
    right: 10,
    gap: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  controlButtonActive: {
    backgroundColor: '#eff6ff',
  },
  zoomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 1,
  },
});

export default MapControls;
