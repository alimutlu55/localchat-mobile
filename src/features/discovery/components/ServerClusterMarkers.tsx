/**
 * Server Cluster Markers
 * 
 * Marker components for server-side clustered data.
 * These work with ClusterFeature from the server API response.
 */

import React, { memo, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { PointAnnotation } from '@maplibre/maplibre-react-native';
import { Bubble } from './Bubble';
import { MiniRoomCard } from './MiniRoomCard';
import { MapCluster } from './MapCluster';
import { Room, ClusterFeature } from '../../../types';
import { getCategoryEmoji } from '../../../constants';

// Set this to true to use the new informative BubbleCard, 
// or false to use the traditional teardrop Bubble.
const USE_CARD_STYLE = true;

/**
 * Server Room Marker Component
 * For individual rooms from server clustering response
 */
interface ServerRoomMarkerProps {
  feature: ClusterFeature;
  isSelected: boolean;
  onPress: (feature: ClusterFeature) => void;
  onDeselect?: () => void;
}

/**
 * Internal: Android Room Marker
 */
const AndroidRoomMarker = memo(({ feature, isSelected, onPress, roomForPin }: any) => (
  <PointAnnotation
    id={`server-room-${feature.properties.roomId}`}
    coordinate={feature.geometry.coordinates}
    anchor={{ x: 0.5, y: 1 }}
    onSelected={() => onPress(feature)}
  >
    <View style={[styles.markerContainer, isSelected && styles.selectedMarker]}>
      {USE_CARD_STYLE ? (
        <MiniRoomCard room={roomForPin as Room} isSelected={isSelected} />
      ) : (
        <Bubble room={roomForPin as Room} isSelected={isSelected} />
      )}
    </View>
  </PointAnnotation>
));

/**
 * Internal: iOS Room Marker
 */
const IosRoomMarker = memo(({ feature, isSelected, onPress, onDeselect, roomForPin }: any) => (
  <PointAnnotation
    id={`server-room-${feature.properties.roomId}`}
    coordinate={feature.geometry.coordinates}
    anchor={{ x: 0.5, y: 1 }}
    onDeselected={onDeselect}
  >
    <TouchableOpacity
      style={[styles.markerContainer, isSelected && styles.selectedMarker]}
      activeOpacity={0.85}
      onPress={() => onPress(feature)}
    >
      {USE_CARD_STYLE ? (
        <MiniRoomCard room={roomForPin as Room} isSelected={isSelected} />
      ) : (
        <Bubble room={roomForPin as Room} isSelected={isSelected} />
      )}
    </TouchableOpacity>
  </PointAnnotation>
));

export const ServerRoomMarker = memo(function ServerRoomMarker({
  feature,
  isSelected,
  onPress,
  onDeselect
}: ServerRoomMarkerProps) {
  const { properties, geometry } = feature;

  if (properties.cluster || !properties.roomId || !geometry?.coordinates) return null;
  const [lng, lat] = geometry.coordinates;
  if (lng == null || lat == null || !isFinite(lng) || !isFinite(lat)) return null;

  const roomForPin = React.useMemo((): Partial<Room> => ({
    id: properties.roomId,
    title: properties.title || '',
    category: properties.category as Room['category'],
    emoji: properties.categoryIcon || getCategoryEmoji(properties.category),
    participantCount: properties.participantCount || 0,
    status: properties.status as Room['status'],
    isFull: properties.status === 'full',
    isExpiringSoon: properties.isExpiringSoon || false,
    isHighActivity: properties.isHighActivity || false,
    isNew: properties.isNew || false,
  }), [properties]);

  if (Platform.OS === 'android') {
    return <AndroidRoomMarker feature={feature} isSelected={isSelected} onPress={onPress} roomForPin={roomForPin} />;
  }

  return (
    <IosRoomMarker
      feature={feature}
      isSelected={isSelected}
      onPress={onPress}
      onDeselect={onDeselect}
      roomForPin={roomForPin}
    />
  );
}, (prev, next) => prev.isSelected === next.isSelected && prev.feature === next.feature);

/**
 * Server Cluster Marker Component
 */
interface ServerClusterMarkerProps {
  feature: ClusterFeature;
  onPress: (feature: ClusterFeature) => void;
  onDeselect?: () => void;
}

/**
 * Internal: Android Cluster Marker
 * Features the "Indestructible Container" (128px) and onSelected touch.
 */
const AndroidClusterMarker = memo(({ feature, onPress }: any) => (
  <PointAnnotation
    id={`server-cluster-${feature.properties.clusterId}`}
    coordinate={feature.geometry.coordinates}
    anchor={{ x: 0.5, y: 0.5 }}
    onSelected={() => onPress(feature)}
  >
    <View style={{
      width: 128, // Constant "Indestructible" size
      height: 128,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <MapCluster count={feature.properties.pointCount || 0} />
    </View>
  </PointAnnotation>
));

/**
 * Internal: iOS Cluster Marker
 * Clean implementation with zero extra padding or bitmap-specific scale logic.
 */
const IosClusterMarker = memo(({ feature, onPress, onDeselect }: any) => (
  <PointAnnotation
    id={`server-cluster-${feature.properties.clusterId}`}
    coordinate={feature.geometry.coordinates}
    anchor={{ x: 0.5, y: 0.5 }}
    onDeselected={onDeselect}
  >
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(feature)}>
      <MapCluster count={feature.properties.pointCount || 0} />
    </TouchableOpacity>
  </PointAnnotation>
));

export const ServerClusterMarker = memo(function ServerClusterMarker({
  feature,
  onPress,
  onDeselect
}: ServerClusterMarkerProps) {
  const { properties, geometry } = feature;

  if (!properties.cluster || properties.clusterId == null || !geometry?.coordinates) return null;
  const [lng, lat] = geometry.coordinates;
  if (lng == null || lat == null || !isFinite(lng) || !isFinite(lat)) return null;

  if (Platform.OS === 'android') {
    return <AndroidClusterMarker feature={feature} onPress={onPress} />;
  }

  return <IosClusterMarker feature={feature} onPress={onPress} onDeselect={onDeselect} />;
}, (prev, next) => prev.feature === next.feature);

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMarker: {
    zIndex: 100,
  },
});
