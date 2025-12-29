/**
 * Server Cluster Markers
 * 
 * Marker components for server-side clustered data.
 * These work with ClusterFeature from the server API response.
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { RoomPin } from './RoomPin';
import { MapCluster } from './MapCluster';
import { Room, ClusterFeature } from '../../../types';

/**
 * Server Room Marker Component
 * For individual rooms from server clustering response
 */
interface ServerRoomMarkerProps {
  feature: ClusterFeature;
  isSelected: boolean;
  onPress: (feature: ClusterFeature) => void;
}

export const ServerRoomMarker = memo(function ServerRoomMarker({ 
  feature, 
  isSelected, 
  onPress 
}: ServerRoomMarkerProps) {
  const { properties, geometry } = feature;
  
  // Skip if not a room or missing coordinates
  if (properties.cluster || !properties.roomId || !geometry?.coordinates) {
    return null;
  }

  const [lng, lat] = geometry.coordinates;
  
  if (lng == null || lat == null) {
    return null;
  }

  // Create a minimal Room object for RoomPin
  const roomForPin: Partial<Room> = {
    id: properties.roomId,
    title: properties.title || '',
    category: properties.category as Room['category'],
    emoji: properties.categoryIcon || '💬',
    participantCount: properties.participantCount || 0,
    status: properties.status as Room['status'],
  };

  return (
    <MarkerView
      key={`server-room-${properties.roomId}`}
      id={`server-room-${properties.roomId}`}
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity
        onPress={() => onPress(feature)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.markerContainer}>
          <RoomPin room={roomForPin as Room} isSelected={isSelected} />
        </View>
      </TouchableOpacity>
    </MarkerView>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.feature.properties.roomId === nextProps.feature.properties.roomId &&
    prevProps.feature.properties.participantCount === nextProps.feature.properties.participantCount &&
    prevProps.isSelected === nextProps.isSelected
  );
});

/**
 * Server Cluster Marker Component
 * For cluster aggregations from server clustering response
 */
interface ServerClusterMarkerProps {
  feature: ClusterFeature;
  onPress: (feature: ClusterFeature) => void;
}

export const ServerClusterMarker = memo(function ServerClusterMarker({ 
  feature, 
  onPress 
}: ServerClusterMarkerProps) {
  const { properties, geometry } = feature;
  
  // Skip if not a cluster or missing data
  if (!properties.cluster || properties.clusterId == null || !geometry?.coordinates) {
    return null;
  }
  
  const [lng, lat] = geometry.coordinates;
  
  if (lng == null || lat == null) {
    return null;
  }

  return (
    <MarkerView
      key={`server-cluster-${properties.clusterId}`}
      id={`server-cluster-${properties.clusterId}`}
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <TouchableOpacity
        onPress={() => onPress(feature)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MapCluster count={properties.pointCount || 0} />
      </TouchableOpacity>
    </MarkerView>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.feature.properties.clusterId === nextProps.feature.properties.clusterId &&
    prevProps.feature.properties.pointCount === nextProps.feature.properties.pointCount
  );
});

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
