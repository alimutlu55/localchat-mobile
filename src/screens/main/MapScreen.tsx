/**
 * Map Screen (MapLibre Version)
 *
 * Main discovery screen showing nearby rooms on a map.
 * Uses MapLibre for consistent grayscale map rendering across iOS and Android.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  CircleLayer,
  type MapViewRef,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Menu, Map as MapIcon, List } from 'lucide-react-native';
import { RootStackParamList } from '../../navigation/types';
import { Room } from '../../types';
import { ROOM_CONFIG, MAP_CONFIG } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useRooms, useSidebarRooms } from '../../context/RoomContext';
import { Sidebar } from '../../components/Sidebar';
import { ProfileDrawer } from '../../components/ProfileDrawer';
import { RoomPin } from '../../components/RoomPin';
import { MapCluster } from '../../components/MapCluster';
import {
  createClusterIndex,
  getClustersForBounds,
  isCluster,
  getClusterExpansionZoom,
  getClusterLeaves,
  getStableFeatureKey,
  MapFeature,
  ClusterFeature,
  EventFeature
} from '../../utils/mapClustering';

// New architecture components
import { MapControls } from '../../features/discovery/components';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('MapScreen');

// CartoDB Positron raster tiles - EXACT same tiles as web version
// Using inline style to get identical appearance to Leaflet web version
const MAP_STYLE = {
  version: 8,
  name: 'CartoDB Positron',
  sources: {
    'carto-positron': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [
    {
      id: 'carto-positron-layer',
      type: 'raster',
      source: 'carto-positron',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  const { user, logout } = useAuth();

  // Use RoomContext for room state management
  const {
    activeRooms,
    myRooms,
    isLoading: isLoadingRooms,
    fetchDiscoveredRooms,
    selectedRoom,
    setSelectedRoom,
  } = useRooms();

  // Get sidebar-specific room lists (active vs expired)
  const sidebarRooms = useSidebarRooms();

  // Local UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(13);
  const [bounds, setBounds] = useState<[number, number, number, number]>([-180, -85, 180, 85]);
  const [centerCoord, setCenterCoord] = useState<[number, number]>([
    MAP_CONFIG.DEFAULT_CENTER.longitude,
    MAP_CONFIG.DEFAULT_CENTER.latitude,
  ]);

  // Sidebar and profile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Use activeRooms from context for clustering (only non-expired, non-closed)
  const clusterIndex = useMemo(() => createClusterIndex(activeRooms), [activeRooms]);

  // Get clusters/features for current viewport
  // getClustersForBounds already uses expanded bounds internally for stability
  const features = useMemo(() => {
    return getClustersForBounds(clusterIndex, bounds, currentZoom);
  }, [clusterIndex, bounds, currentZoom]);

  // Create a single GeoJSON FeatureCollection for all room circles
  // REMOVED isMapMoving check - circles now stay visible during map movement
  const circlesGeoJSON = useMemo(() => {
    if (!mapReady || currentZoom < 10) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }

    const circleFeatures = features
      .filter((f): f is EventFeature => !isCluster(f))
      .filter(f => f.properties.room.latitude != null && f.properties.room.longitude != null)
      .map(f => {
        const room = f.properties.room;
        const [lng, lat] = f.geometry.coordinates;
        const radiusMeters = room.radius || 500;
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, currentZoom);
        const circleRadiusPixels = Math.max(radiusMeters / metersPerPixel, 20);

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [lng, lat],
          },
          properties: {
            id: room.id,
            radius: circleRadiusPixels,
            isExpiringSoon: room.isExpiringSoon || false,
          },
        };
      });

    return {
      type: 'FeatureCollection' as const,
      features: circleFeatures,
    };
  }, [features, currentZoom, mapReady]);

  /**
   * Fetch nearby rooms using context
   */
  const fetchRooms = useCallback(async (lat: number, lng: number) => {
    try {
      await fetchDiscoveredRooms(lat, lng, ROOM_CONFIG.DEFAULT_RADIUS);
    } catch (error) {
      log.error('Failed to fetch rooms', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchDiscoveredRooms]);

  /**
   * Request location permissions and get current location
   */
  useEffect(() => {
    let locationSubscription: any;

    const startWatchingLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location Permission', 'Permission needed to show nearby rooms.');
          setIsLoading(false);
          return;
        }

        // Get initial position
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const coords = {
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
        };

        setUserLocation(coords);
        setCenterCoord([coords.longitude, coords.latitude]);

        await fetchRooms(coords.latitude, coords.longitude);

        // Start watching for changes
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 50,
          },
          (location) => {
            const newCoords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            setUserLocation(newCoords);
          }
        );
      } catch (error) {
        log.error('Location error', error);
      } finally {
        setIsLoading(false);
      }
    };

    startWatchingLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [fetchRooms]);

  /**
   * Refresh rooms
   */
  const handleRefresh = async () => {
    if (!userLocation) return;
    setIsRefreshing(true);
    await fetchRooms(userLocation.latitude, userLocation.longitude);
  };

  /**
   * Handle map ready
   */
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  /**
   * Handle region change - updates viewport for clustering
   */
  const handleRegionDidChange = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      const zoom = await mapRef.current.getZoom();
      const visibleBounds = await mapRef.current.getVisibleBounds();
      const center = await mapRef.current.getCenter();

      if (visibleBounds && visibleBounds.length === 2) {
        const newBounds: [number, number, number, number] = [
          visibleBounds[1][0], visibleBounds[1][1], 
          visibleBounds[0][0], visibleBounds[0][1]
        ];
        setBounds(newBounds);
      }

      if (center) {
        setCenterCoord(center as [number, number]);
      }

      setCurrentZoom(Math.round(zoom));
    } catch (error) {
      log.error('Error getting map state', error);
    }
  }, []);

  /**
   * Calculate total events in view (summing cluster counts)
   * Matches web implementation for consistency
   */
  const totalEventsInView = useMemo(() => {
    return features.reduce((sum, feature) => {
      if (isCluster(feature)) {
        return sum + (feature.properties.point_count || 0);
      }
      return sum + 1;
    }, 0);
  }, [features]);

  /**
   * Calculate adaptive map fly animation duration based on zoom difference
   */
  const calculateMapFlyDuration = useCallback((targetZoom: number) => {
    const zoomDiff = Math.abs(targetZoom - currentZoom);
    // Smoother base (0.8s) and more gradual per-level (0.2s)
    const duration = 0.8 + zoomDiff * 0.2;
    // Capped at 2.5s for long distances (e.g. world to city)
    return Math.min(duration, 2.5) * 1000;
  }, [currentZoom]);

  /**
   * Center map on user location with smooth fly animation
   */
  const centerOnUser = useCallback(() => {
    if (!mapReady || !userLocation || !cameraRef.current) return;

    const targetZoom = 14;
    const duration = calculateMapFlyDuration(targetZoom);

    cameraRef.current.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: targetZoom,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  }, [userLocation, mapReady, calculateMapFlyDuration]);

  /**
   * Zoom in with smooth animation
   */
  const handleZoomIn = useCallback(() => {
    if (!mapReady || !cameraRef.current) return;

    const newZoom = Math.min(currentZoom + 1, 18);
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [currentZoom, mapReady]);

  /**
   * Zoom out with smooth animation
   */
  const handleZoomOut = useCallback(() => {
    if (!mapReady || !cameraRef.current) return;

    const newZoom = Math.max(currentZoom - 1, 1);
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [currentZoom, mapReady]);

  /**
   * Reset to world view with smooth fly animation
   */
  const handleResetView = useCallback(() => {
    if (!mapReady || !cameraRef.current) return;
    const targetZoom = 1;
    const duration = calculateMapFlyDuration(targetZoom);

    cameraRef.current.setCamera({
      centerCoordinate: [0, 20],
      zoomLevel: targetZoom,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  }, [mapReady, calculateMapFlyDuration]);



  /**
   * Handle room marker press - smart behavior based on zoom difference
   * If already close, open immediately. If far, zoom first then open.
   */
  const handleRoomPress = useCallback((room: Room) => {
    log.debug('Room pressed', { roomId: room.id });

    if (mapReady && cameraRef.current && room.latitude != null && room.longitude != null) {
      const targetZoom = Math.min(Math.max(currentZoom + 2, 14), 16);
      const zoomDiff = Math.abs(targetZoom - currentZoom);

      // If already at a good zoom level (within 1.5 levels), open immediately
      if (zoomDiff <= 1.5) {
        setSelectedRoom(room);
        navigation.navigate('RoomDetails', { room });
        return;
      }

      // Need significant zoom - fly to room first, then open details
      const duration = calculateMapFlyDuration(targetZoom);

      cameraRef.current.setCamera({
        centerCoordinate: [room.longitude, room.latitude],
        zoomLevel: targetZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });

      // CRITICAL: We DO NOT call setCurrentZoom(targetZoom) here.
      // This prevents the map from re-clustering/re-rendering markers during the Jump,
      // which is what causes the native EXC_BAD_ACCESS on Fabric.
      // currentZoom will be updated automatically in handleRegionDidChange when finished.

      // Open details after zoom completes (with buffer)
      setTimeout(() => {
        setSelectedRoom(room);
        navigation.navigate('RoomDetails', { room });
      }, duration + 150);
    } else {
      setSelectedRoom(room);
      navigation.navigate('RoomDetails', { room });
    }
  }, [navigation, setSelectedRoom, mapReady, currentZoom, calculateMapFlyDuration]);

  /**
   * Force viewport refresh - directly updates bounds/zoom from current map state
   */
  const forceViewportRefresh = useCallback(async () => {
    if (!mapRef.current) return;
    
    try {
      const zoom = await mapRef.current.getZoom();
      const visibleBounds = await mapRef.current.getVisibleBounds();
      
      if (visibleBounds && visibleBounds.length === 2) {
        const newBounds: [number, number, number, number] = [
          visibleBounds[1][0], visibleBounds[1][1], 
          visibleBounds[0][0], visibleBounds[0][1]
        ];
        const roundedZoom = Math.round(zoom);
        
        // Force state update to trigger re-clustering
        setCurrentZoom(roundedZoom);
        setBounds(newBounds);
      }
    } catch (error) {
      log.error('Error forcing viewport refresh', error);
    }
  }, []);

  /**
   * Calculate optimal zoom level to fit bounds with proper padding
   * Uses screen dimensions and accounts for UI elements (header, controls)
   */
  const calculateOptimalZoom = useCallback((
    boundsToFit: { minLng: number; maxLng: number; minLat: number; maxLat: number },
    paddingPercent: number = 0.25 // 25% padding on each side
  ): number => {
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // Account for UI elements (header ~100px, bottom toggle ~80px)
    const usableHeight = screenHeight - 180;
    const usableWidth = screenWidth - 40; // Side controls
    
    const lngSpan = boundsToFit.maxLng - boundsToFit.minLng;
    const latSpan = boundsToFit.maxLat - boundsToFit.minLat;
    
    // Add padding to spans
    const paddedLngSpan = lngSpan * (1 + paddingPercent * 2);
    const paddedLatSpan = latSpan * (1 + paddingPercent * 2);
    
    // Web Mercator: at zoom z, world width = 256 * 2^z pixels
    // Calculate zoom needed to fit each dimension
    const WORLD_SIZE = 256;
    
    // Longitude: simple linear mapping
    const zoomForLng = Math.log2((usableWidth / WORLD_SIZE) * (360 / paddedLngSpan));
    
    // Latitude: need to account for Mercator distortion at center latitude
    const centerLat = (boundsToFit.minLat + boundsToFit.maxLat) / 2;
    const latRadians = centerLat * Math.PI / 180;
    const mercatorScale = Math.cos(latRadians);
    const zoomForLat = Math.log2((usableHeight / WORLD_SIZE) * (180 / paddedLatSpan) * mercatorScale);
    
    // Use the smaller zoom to ensure both dimensions fit
    const optimalZoom = Math.min(zoomForLng, zoomForLat);
    
    // Clamp to valid zoom range and round down to be safe
    return Math.max(1, Math.min(Math.floor(optimalZoom), 18));
  }, []);

  /**
   * Handle cluster press - zoom in to expand with smart bounds fitting
   */
  const handleClusterPress = useCallback((cluster: ClusterFeature) => {
    log.debug('Cluster pressed', { clusterId: cluster.properties.cluster_id });
    if (!mapReady || !cameraRef.current) return;

    const [lng, lat] = cluster.geometry.coordinates;
    const leaves = getClusterLeaves(clusterIndex, cluster.properties.cluster_id, Infinity);

    // Logic for clusters that won't expand
    if (currentZoom >= 17 && leaves.length > 0) {
      const expansionZoom = getClusterExpansionZoom(clusterIndex, cluster.properties.cluster_id);
      if (expansionZoom > 18) {
        const firstRoom = leaves[0].properties.room;
        setSelectedRoom(firstRoom);
        navigation.navigate('RoomDetails', { room: firstRoom });
        return;
      }
    }

    if (leaves.length > 0) {
      // Calculate bounds of all points in cluster
      let minLng = leaves[0].geometry.coordinates[0];
      let maxLng = leaves[0].geometry.coordinates[0];
      let minLat = leaves[0].geometry.coordinates[1];
      let maxLat = leaves[0].geometry.coordinates[1];

      leaves.forEach(leaf => {
        const [lLng, lLat] = leaf.geometry.coordinates;
        minLng = Math.min(minLng, lLng);
        maxLng = Math.max(maxLng, lLng);
        minLat = Math.min(minLat, lLat);
        maxLat = Math.max(maxLat, lLat);
      });

      // Calculate optimal zoom to fit all points with generous padding (30%)
      const optimalZoom = calculateOptimalZoom(
        { minLng, maxLng, minLat, maxLat },
        0.30 // 30% padding ensures nothing is at edges
      );

      // Add visual padding for fitBounds (in pixels)
      // Use larger padding to ensure points aren't at screen edges
      const edgePadding = 80;

      // Calculate padded bounds for state update
      const lngPadding = (maxLng - minLng) * 0.30 || 0.002;
      const latPadding = (maxLat - minLat) * 0.30 || 0.002;
      
      const targetBounds: [number, number, number, number] = [
        minLng - lngPadding,
        minLat - latPadding,
        maxLng + lngPadding,
        maxLat + latPadding
      ];

      // IMMEDIATELY update state with target values so features render
      setBounds(targetBounds);
      setCurrentZoom(optimalZoom);

      // Fit to bounds with proper edge padding
      cameraRef.current.fitBounds(
        [maxLng + lngPadding, maxLat + latPadding], // NE corner
        [minLng - lngPadding, minLat - latPadding], // SW corner
        edgePadding, // Padding in pixels
        1200 // Animation duration
      );

      // Refresh viewport after animation to get accurate values
      setTimeout(forceViewportRefresh, 1400);
    } else {
      // Fallback - fly to cluster location
      const expansionZoom = getClusterExpansionZoom(clusterIndex, cluster.properties.cluster_id);
      const targetZoom = Math.min(Math.max(expansionZoom, currentZoom + 2), 16);
      const duration = calculateMapFlyDuration(targetZoom);

      cameraRef.current.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: targetZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });

      // Force viewport refresh after animation
      setTimeout(forceViewportRefresh, duration + 200);
    }
  }, [clusterIndex, currentZoom, navigation, setSelectedRoom, mapReady, calculateMapFlyDuration, calculateOptimalZoom, forceViewportRefresh]);

  /**
   * Navigate to create room
   */
  const handleCreateRoom = () => {
    navigation.navigate('CreateRoom');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Finding nearby rooms...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MapLibre Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
        onDidFinishLoadingMap={handleMapReady}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: centerCoord,
            zoomLevel: currentZoom,
          }}
          minZoomLevel={1}
          maxZoomLevel={18}
        />

        {/* Single ShapeSource for all room circles - prevents crash from dynamic children */}
        {mapReady && circlesGeoJSON.features.length > 0 && (
          <ShapeSource
            id="room-circles-source"
            shape={circlesGeoJSON}
          >
            <CircleLayer
              id="room-circles-layer"
              style={{
                circleRadius: ['get', 'radius'],
                circleColor: [
                  'case',
                  ['get', 'isExpiringSoon'],
                  'rgba(254, 215, 170, 0.2)',
                  'rgba(254, 205, 211, 0.2)',
                ],
                circleStrokeColor: [
                  'case',
                  ['get', 'isExpiringSoon'],
                  'rgba(249, 115, 22, 0.6)',
                  'rgba(244, 63, 94, 0.6)',
                ],
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}

        {/* User Location Marker - using MarkerView for stability */}
        {mapReady && userLocation && (
          <MarkerView
            id="user-location"
            coordinate={[userLocation.longitude, userLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userLocationMarkerContainer}>
              <View style={styles.userLocationPulse} />
              <View style={styles.userLocationDot} />
            </View>
          </MarkerView>
        )}

        {/* Room Markers and Clusters - using MarkerView for stability */}
        {mapReady && features.map((feature: MapFeature) => {
          const [lng, lat] = feature.geometry.coordinates;
          // Use stable keys that survive re-clustering
          const stableKey = getStableFeatureKey(feature);
          const id = isCluster(feature)
            ? `cluster-${feature.properties.cluster_id}`
            : `room-${feature.properties.eventId}`;

          if (isCluster(feature)) {
            return (
              <MarkerView
                key={stableKey}
                id={id}
                coordinate={[lng, lat]}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <TouchableOpacity
                  onPress={() => handleClusterPress(feature as ClusterFeature)}
                  activeOpacity={0.8}
                >
                  <MapCluster count={feature.properties.point_count} />
                </TouchableOpacity>
              </MarkerView>
            );
          }

          const room = feature.properties.room;
          if (room.latitude == null || room.longitude == null) {
            return null;
          }

          return (
            <MarkerView
              key={stableKey}
              id={id}
              coordinate={[lng, lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <TouchableOpacity
                onPress={() => handleRoomPress(room)}
                activeOpacity={0.8}
              >
                <View style={styles.pinMarkerContainer}>
                  <RoomPin room={room} isSelected={selectedRoom?.id === room.id} />
                </View>
              </TouchableOpacity>
            </MarkerView>
          );
        })}
      </MapView>

      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => setIsSidebarOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu size={20} color="#374151" strokeWidth={1.5} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Huddle</Text>

          <TouchableOpacity
            style={styles.headerCreateButton}
            onPress={handleCreateRoom}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Map Controls - Using extracted component */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterUser={centerOnUser}
        onResetView={handleResetView}
        hasUserLocation={!!userLocation}
        currentZoom={currentZoom}
      />

      {/* Events Counter */}
      <View style={styles.eventsCounter}>
        <Text style={styles.eventsCounterText}>
          {totalEventsInView} {totalEventsInView === 1 ? 'event' : 'events'} in view
        </Text>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggleContainer}>
        <View style={styles.viewToggle}>
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewToggleButtonActiveGradient}
          >
            <MapIcon size={18} color="#ffffff" strokeWidth={1.5} />
            <Text style={styles.viewToggleTextActive}>Map</Text>
          </LinearGradient>
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => {
              navigation.navigate('List');
            }}
          >
            <List size={18} color="#6b7280" strokeWidth={1.5} />
            <Text style={styles.viewToggleText}>List</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Empty State */}
      {activeRooms.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No rooms nearby</Text>
          <Text style={styles.emptyText}>
            Be the first to start a conversation!
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateRoom}
          >
            <Text style={styles.createButtonText}>Create Room</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        rooms={myRooms}
        onRoomSelect={(room) => {
          // Check if user needs to join first (e.g., after being kicked)
          if (!room.hasJoined && !room.isCreator) {
            navigation.navigate('RoomDetails', { room });
          } else {
            navigation.navigate('ChatRoom', { room });
          }
        }}
        onProfilePress={() => {
          setIsSidebarOpen(false);
          setIsProfileDrawerOpen(true);
        }}
      />

      {/* Profile Drawer */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        onSignOut={logout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  headerCreateButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f97316',
    // Remove extra shadow to match web's simpler style
  },
  // Map control styles moved to MapControls component
  eventsCounter: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  eventsCounterText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '400',
  },
  userLocationMarkerContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocationDot: {
    width: 16,
    height: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  userLocationPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  pinMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  viewToggleContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  viewToggleButtonActive: {
    backgroundColor: '#f97316',
  },
  viewToggleButtonActiveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  viewToggleText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '400',
  },
  viewToggleTextActive: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '400',
  },
  emptyState: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

