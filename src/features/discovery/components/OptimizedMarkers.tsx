/**
 * Optimized Map Markers
 * 
 * Memoized marker components to prevent crashes during zoom/pan.
 * Issue: MapLibre crashes when markers are recreated too frequently.
 * Solution: React.memo with strict comparison to minimize re-renders.
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { RoomPin } from './RoomPin';
import { MapCluster } from './MapCluster';
import { Room } from '../../../types';
import { ClusterFeature } from '../../../utils/mapClustering';

/**
 * Room Marker Component
 * Memoized to prevent unnecessary re-renders during zoom/pan
 */
interface RoomMarkerProps {
  room: Room;
  isSelected: boolean;
  onPress: (room: Room) => void;
}

export const RoomMarker = memo(function RoomMarker({ 
  room, 
  isSelected, 
  onPress 
}: RoomMarkerProps) {
  // Skip rendering if coordinates are invalid
  if (room.latitude == null || room.longitude == null) {
    return null;
  }

  return (
    <MarkerView
      key={`room-${room.id}`}
      id={`room-${room.id}`}
      coordinate={[room.longitude, room.latitude]}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity
        onPress={() => onPress(room)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.markerContainer}>
          <RoomPin room={room} isSelected={isSelected} />
        </View>
      </TouchableOpacity>
    </MarkerView>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific props change
  return (
    prevProps.room.id === nextProps.room.id &&
    prevProps.room.latitude === nextProps.room.latitude &&
    prevProps.room.longitude === nextProps.room.longitude &&
    prevProps.room.participantCount === nextProps.room.participantCount &&
    prevProps.isSelected === nextProps.isSelected
  );
});

/**
 * Cluster Marker Component
 * Memoized to prevent unnecessary re-renders
 */
interface ClusterMarkerProps {
  cluster: ClusterFeature;
  onPress: (cluster: ClusterFeature) => void;
}

export const ClusterMarker = memo(function ClusterMarker({ 
  cluster, 
  onPress 
}: ClusterMarkerProps) {
  const [lng, lat] = cluster.geometry.coordinates;

  return (
    <MarkerView
      key={`cluster-${cluster.properties.cluster_id}`}
      id={`cluster-${cluster.properties.cluster_id}`}
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <TouchableOpacity
        onPress={() => onPress(cluster)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MapCluster count={cluster.properties.point_count} />
      </TouchableOpacity>
    </MarkerView>
  );
}, (prevProps, nextProps) => {
  // Only re-render if cluster ID or count changes
  return (
    prevProps.cluster.properties.cluster_id === nextProps.cluster.properties.cluster_id &&
    prevProps.cluster.properties.point_count === nextProps.cluster.properties.point_count
  );
});

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
