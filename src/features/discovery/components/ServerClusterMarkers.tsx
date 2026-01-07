/**
 * Server Cluster Markers
 * 
 * Marker components for server-side clustered data.
 * These work with ClusterFeature from the server API response.
 */

import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { PointAnnotation } from '@maplibre/maplibre-react-native';
import { Bubble, MiniRoomCard } from './index';
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

export const ServerRoomMarker = memo(function ServerRoomMarker({
  feature,
  isSelected,
  onPress,
  onDeselect
}: ServerRoomMarkerProps) {
  const { properties, geometry } = feature;

  // Skip if not a room or missing coordinates
  if (properties.cluster || !properties.roomId || !geometry?.coordinates) {
    return null;
  }

  const [lng, lat] = geometry.coordinates;

  if (lng == null || lat == null || isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
    return null;
  }

  // Memoize room object to prevent unnecessary Bubble re-renders
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
  }), [
    properties.roomId,
    properties.title,
    properties.category,
    properties.categoryIcon,
    properties.participantCount,
    properties.status,
    properties.isExpiringSoon,
    properties.isHighActivity,
    properties.isNew,
  ]);

  return (
    <PointAnnotation
      key={`server-room-${properties.roomId}`}
      id={`server-room-${properties.roomId}`}
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: 1 }}
      selected={isSelected}
      onDeselected={onDeselect}
    >
      <TouchableOpacity
        style={[
          styles.markerContainer,
          isSelected && styles.selectedMarker
        ]}
        activeOpacity={0.85}
        onPress={() => onPress(feature)}
        hitSlop={{ top: 15, bottom: 20, left: 20, right: 20 }}
      >
        {USE_CARD_STYLE ? (
          <MiniRoomCard room={roomForPin as Room} isSelected={isSelected} />
        ) : (
          <Bubble room={roomForPin as Room} isSelected={isSelected} />
        )}
      </TouchableOpacity>
    </PointAnnotation>
  );
}, (prevProps, nextProps) => {
  // Enhanced comparison to prevent re-renders
  return (
    prevProps.feature.properties.roomId === nextProps.feature.properties.roomId &&
    prevProps.feature.properties.participantCount === nextProps.feature.properties.participantCount &&
    prevProps.feature.properties.status === nextProps.feature.properties.status &&
    prevProps.feature.properties.category === nextProps.feature.properties.category &&
    prevProps.feature.properties.categoryIcon === nextProps.feature.properties.categoryIcon &&
    prevProps.feature.properties.isExpiringSoon === nextProps.feature.properties.isExpiringSoon &&
    prevProps.feature.properties.isHighActivity === nextProps.feature.properties.isHighActivity &&
    prevProps.feature.properties.isNew === nextProps.feature.properties.isNew &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.feature.geometry.coordinates[0] === nextProps.feature.geometry.coordinates[0] &&
    prevProps.feature.geometry.coordinates[1] === nextProps.feature.geometry.coordinates[1]
  );
});

/**
 * Server Cluster Marker Component
 * For cluster aggregations from server clustering response
 */
interface ServerClusterMarkerProps {
  feature: ClusterFeature;
  isSelected?: boolean;
  onPress: (feature: ClusterFeature) => void;
  onDeselect?: () => void;
}

export const ServerClusterMarker = memo(function ServerClusterMarker({
  feature,
  isSelected = false,
  onPress,
  onDeselect
}: ServerClusterMarkerProps) {
  const { properties, geometry } = feature;

  // Skip if not a cluster or missing data
  if (!properties.cluster || properties.clusterId == null || !geometry?.coordinates) {
    return null;
  }

  const [lng, lat] = geometry.coordinates;

  if (lng == null || lat == null || isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
    return null;
  }

  return (
    <PointAnnotation
      key={`server-cluster-${properties.clusterId}`}
      id={`server-cluster-${properties.clusterId}`}
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: 0.5 }}
      onDeselected={onDeselect}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(feature)}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      >
        <MapCluster count={properties.pointCount || 0} />
      </TouchableOpacity>
    </PointAnnotation>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.feature.properties.clusterId === nextProps.feature.properties.clusterId &&
    prevProps.feature.properties.pointCount === nextProps.feature.properties.pointCount &&
    prevProps.feature.geometry.coordinates[0] === nextProps.feature.geometry.coordinates[0] &&
    prevProps.feature.geometry.coordinates[1] === nextProps.feature.geometry.coordinates[1]
  );
});

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMarker: {
    zIndex: 100, // Ensure selected marker is above others
  },
});
