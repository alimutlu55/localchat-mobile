/**
 * Map Screen
 *
 * Main discovery screen showing nearby rooms on a map.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, {
  Marker,
  MapMarker,
  Region,
  UrlTile,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Plus, Minus, Navigation, RefreshCw, Menu, Map as MapIcon, List, Globe } from 'lucide-react-native';
import { RootStackParamList } from '../../navigation/types';
import { Room } from '../../types';
import { ROOM_CONFIG, MAP_CONFIG } from '../../constants';
import StableMarker from './StableMarker';
import { useAuth } from '../../context/AuthContext';
import { useRooms, useSidebarRooms } from '../../context/RoomContext';
import { Sidebar } from '../../components/Sidebar';
import { ProfileDrawer } from '../../components/ProfileDrawer';

import { MapCluster } from '../../components/MapCluster';
import {
  createClusterIndex,
  getClustersForBounds,
  isCluster,
  getClusterExpansionZoom,
  getClusterLeaves,
  MapFeature,
  ClusterFeature
} from '../../utils/mapClustering';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const mapRef = useRef<MapView>(null);

  const { user, logout } = useAuth();

  // Use RoomContext for room state management
  const {
    activeRooms,
    myRooms,
    isLoadingRooms,
    fetchRooms: contextFetchRooms,
    selectedRoom,
    setSelectedRoom,
  } = useRooms();

  // Get sidebar-specific room lists (active vs expired)
  const sidebarRooms = useSidebarRooms();

  // Local UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<Region>({
    ...MAP_CONFIG.DEFAULT_CENTER,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [currentZoom, setCurrentZoom] = useState(13); // Track zoom level for UI

  // Map movement tracking - prevents Circle crash during zoom/pan
  const [isMapMoving, setIsMapMoving] = useState(false);
  const circleIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce timer for smooth zooming - prevents crash from rapid updates
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sidebar and profile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Use activeRooms from context for clustering (only non-expired, non-closed)
  const clusterIndex = useMemo(() => createClusterIndex(activeRooms), [activeRooms]);

  // Get clusters/features for current viewport
  const features = useMemo(() => {
    // Convert region to westLng, southLat, eastLng, northLat
    const westLng = region.longitude - region.longitudeDelta / 2;
    const southLat = region.latitude - region.latitudeDelta / 2;
    const eastLng = region.longitude + region.longitudeDelta / 2;
    const northLat = region.latitude + region.latitudeDelta / 2;

    return getClustersForBounds(
      clusterIndex,
      [westLng, southLat, eastLng, northLat],
      currentZoom
    );
  }, [clusterIndex, region, currentZoom]);

  /**
   * Fetch nearby rooms using context
   */
  const fetchRooms = useCallback(async (lat: number, lng: number) => {
    try {
      await contextFetchRooms(lat, lng, ROOM_CONFIG.DEFAULT_RADIUS);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [contextFetchRooms]);

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
        setRegion(prev => ({
          ...prev,
          ...coords,
        }));

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
        console.error('Location error:', error);
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

  // Note: User's rooms are fetched automatically by RoomContext when user logs in

  /**
   * Refresh rooms
   */
  const handleRefresh = async () => {
    if (!userLocation) return;
    setIsRefreshing(true);
    await fetchRooms(userLocation.latitude, userLocation.longitude);
  };

  // Calculate pixel radius for the simulated circle marker
  // Based on the approximate meters per degree of longitude at a given latitude
  const getRadiusInPixels = (meters: number, lat: number, lngDelta: number) => {
    // 111320 is meters per degree at equator
    const metersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
    const pixelsPerDegree = Dimensions.get('window').width / lngDelta;
    return (meters / metersPerDegree) * pixelsPerDegree;
  };

  /**
   * Center map on user location (matching web: fly to zoom 14)
   */
  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01, // ~zoom 14
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  /**
   * Zoom in - reduce delta by half
   */
  const handleZoomIn = () => {
    if (mapRef.current) {
      const newDelta = Math.max(region.latitudeDelta / 2, 0.001);
      mapRef.current.animateToRegion({
        ...region,
        latitudeDelta: newDelta,
        longitudeDelta: newDelta,
      }, 300);
      setRegion(prev => ({ ...prev, latitudeDelta: newDelta, longitudeDelta: newDelta }));
      setCurrentZoom(prev => Math.min(prev + 1, 18));
    }
  };

  /**
   * Zoom out - double delta
   */
  const handleZoomOut = () => {
    if (mapRef.current) {
      const newDelta = Math.min(region.latitudeDelta * 2, 100);
      mapRef.current.animateToRegion({
        ...region,
        latitudeDelta: newDelta,
        longitudeDelta: newDelta,
      }, 300);
      setRegion(prev => ({ ...prev, latitudeDelta: newDelta, longitudeDelta: newDelta }));
      setCurrentZoom(prev => Math.max(prev - 1, 3));
    }
  };

  /**
   * Reset to world view (matching web: [20, 0] at zoom 3)
   */
  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: 20,
        longitude: 0,
        latitudeDelta: 80, // ~zoom 3
        longitudeDelta: 80,
      }, 1500);
      setRegion({ latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 });
      setCurrentZoom(3);
    }
  };

  /**
   * Calculate adaptive map fly animation duration based on zoom difference (matching web)
   */
  const calculateMapFlyDuration = (targetZoom: number) => {
    const zoomDiff = Math.abs(targetZoom - currentZoom);
    const duration = 0.5 + zoomDiff * 0.15; // MIN_DURATION + diff * DURATION_PER_LEVEL
    return Math.min(duration, 1.5) * 1000; // Convert to ms, MAX_DURATION = 1.5s
  };

  /**
   * Handle room marker press
   */
  const handleRoomPress = useCallback((room: Room) => {
    console.log('Huddle: [handleRoomPress] room id:', room.id);
    if (!mapRef.current || !room.latitude || !room.longitude) {
      setSelectedRoom(room);
      navigation.navigate('RoomDetails', { room });
      return;
    }

    const currentZoomVal = currentZoom;
    const targetZoom = Math.min(Math.max(currentZoomVal + 2, 14), 16);
    const zoomDiff = Math.abs(targetZoom - currentZoomVal);

    // If already at a good zoom level (within 1.5 levels), open immediately (matching web)
    if (zoomDiff <= 1.5) {
      setSelectedRoom(room);
      navigation.navigate('RoomDetails', { room });
      return;
    }

    // Otherwise zoom in first
    const duration = calculateMapFlyDuration(targetZoom);

    mapRef.current.animateToRegion({
      latitude: room.latitude,
      longitude: room.longitude,
      latitudeDelta: 360 / Math.pow(2, targetZoom),
      longitudeDelta: 360 / Math.pow(2, targetZoom),
    }, duration);

    // Update state to match animation target
    setRegion({
      latitude: room.latitude,
      longitude: room.longitude,
      latitudeDelta: 360 / Math.pow(2, targetZoom),
      longitudeDelta: 360 / Math.pow(2, targetZoom),
    });
    setCurrentZoom(targetZoom);

    // Delay navigation to allow animation (buffer of 150ms matching web)
    setTimeout(() => {
      setSelectedRoom(room);
      navigation.navigate('RoomDetails', { room });
    }, duration + 150);
  }, [currentZoom, navigation]);

  /**
   * Handle cluster press - zoom in to expand
   */
  const handleClusterPress = useCallback((cluster: ClusterFeature) => {
    console.log('Huddle: [handleClusterPress] cluster id:', cluster.properties.cluster_id);
    if (!mapRef.current) return;

    const [lng, lat] = cluster.geometry.coordinates;
    const leaves = getClusterLeaves(clusterIndex, cluster.properties.cluster_id, Infinity);

    // Logic for clusters that won't expand (matching web)
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
      // Calculate bounds of all points in cluster for precise zoom (matching web)
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

      // Add 15% padding (matching web)
      const latPadding = Math.max((maxLat - minLat) * 0.15, 0.001);
      const lngPadding = Math.max((maxLng - minLng) * 0.15, 0.001);

      const targetBounds = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: (maxLat - minLat) + (latPadding * 2),
        longitudeDelta: (maxLng - minLng) + (lngPadding * 2),
      };

      // Estimate target zoom from bounds delta
      const targetZoom = Math.min(
        Math.floor(Math.log2(360 / targetBounds.longitudeDelta)),
        16 // Cap at 16 (matching web)
      );

      const duration = calculateMapFlyDuration(targetZoom);

      mapRef.current.animateToRegion(targetBounds, duration);
      setCurrentZoom(targetZoom);
    } else {
      // Fallback
      const expansionZoom = getClusterExpansionZoom(clusterIndex, cluster.properties.cluster_id);
      const targetZoom = Math.min(Math.max(expansionZoom, currentZoom + 2), 16);
      const nextDelta = 360 / Math.pow(2, targetZoom);
      const duration = calculateMapFlyDuration(targetZoom);

      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: nextDelta,
        longitudeDelta: nextDelta,
      }, duration);

      setRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: nextDelta,
        longitudeDelta: nextDelta,
      });
      setCurrentZoom(targetZoom);
    }
  }, [clusterIndex, currentZoom, navigation]);

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
      {/* Map - using OpenStreetMap with CartoDB Positron tiles (matching web) */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={region}
        showsUserLocation={false} // Use custom marker only like web for privacy/customization
        showsMyLocationButton={false}
        userLocationCalloutEnabled={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsScale={false}
        pitchEnabled={false}
        rotateEnabled={false}
        onRegionChange={() => {
          // Mark map as moving to disable Circle rendering during gestures
          if (!isMapMoving) {
            setIsMapMoving(true);
          }
          // Clear any pending idle timer
          if (circleIdleTimerRef.current) {
            clearTimeout(circleIdleTimerRef.current);
            circleIdleTimerRef.current = null;
          }
        }}
        onRegionChangeComplete={(newRegion) => {
          // Debounce region updates to prevent crash from rapid zoom gestures
          if (regionDebounceRef.current) {
            clearTimeout(regionDebounceRef.current);
          }
          regionDebounceRef.current = setTimeout(() => {
            setRegion(newRegion);
            // Calculate approximate zoom from delta (inverse relationship)
            const zoom = Math.round(Math.log(360 / newRegion.longitudeDelta) / Math.LN2);
            setCurrentZoom(Math.max(3, Math.min(18, zoom)));
          }, 100); // 100ms debounce for smooth experience

          // Wait for map to settle before enabling circles again
          if (circleIdleTimerRef.current) {
            clearTimeout(circleIdleTimerRef.current);
          }
          circleIdleTimerRef.current = setTimeout(() => {
            setIsMapMoving(false);
          }, 300); // 300ms delay after gesture ends to stabilize
        }}
      >
        {/* CartoDB Positron no-labels tiles - clean minimal view like web */}
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          tileSize={256}
        />
        {/* Custom User Location Marker - matching web pulse */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={5} // Below pins
            tappable={false} // User indicator shouldn't intercept map touches
          >
            <View pointerEvents="none" style={styles.userLocationMarkerContainer}>
              <View style={styles.userLocationPulse} />
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}

        {features.map((feature: MapFeature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const id = isCluster(feature)
            ? `cluster-${feature.properties.cluster_id}`
            : `room-${feature.properties.eventId}`;

          if (isCluster(feature)) {
            return (
              <Marker
                key={id}
                coordinate={{ latitude: lat, longitude: lng }}
                onPress={() => handleClusterPress(feature as ClusterFeature)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={!isMapMoving}
                zIndex={20}
                tappable={true}
              >
                <MapCluster
                  count={feature.properties.point_count}
                />
              </Marker>
            );
          }

          const room = feature.properties.room;
          if (room.latitude == null || room.longitude == null) {
            return null;
          }

          const showCircle = !isMapMoving && currentZoom >= 12;
          const radiusMeters = room.radius || 500;
          const radiusPixels = getRadiusInPixels(radiusMeters, room.latitude, region.longitudeDelta);

          return (
            <StableMarker
              key={id}
              room={room}
              id={id}
              showCircle={showCircle}
              radiusPixels={radiusPixels}
              isSelected={selectedRoom?.id === room.id}
              onPress={handleRoomPress}
              isMapMoving={isMapMoving}
            />
          );
        })}
      </MapView>

      {/* Header - matching web MapDiscovery */}
      < SafeAreaView style={styles.header} edges={['top']} >
        <View style={styles.headerContent}>
          {/* Left: Hamburger */}
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => setIsSidebarOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu size={24} color="#374151" />
          </TouchableOpacity>

          {/* Center: Title */}
          <Text style={styles.headerTitle}>Huddle</Text>

          {/* Right: Create Room */}
          <TouchableOpacity
            style={styles.headerCreateButton}
            onPress={handleCreateRoom}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView >

      {/* Map Controls - matching web InteractiveMap */}
      < View style={styles.mapControls} >
        {/* Zoom Controls Card */}
        < View style={styles.zoomCard} >
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomIn}
            activeOpacity={0.7}
          >
            <Plus size={20} color="#374151" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomOut}
            activeOpacity={0.7}
          >
            <Minus size={20} color="#374151" />
          </TouchableOpacity>
        </View >

        {/* Center on User Button */}
        < TouchableOpacity
          style={
            [
              styles.controlButton,
              userLocation && styles.controlButtonActive,
            ]}
          onPress={centerOnUser}
          activeOpacity={0.7}
        >
          <Navigation
            size={20}
            color={userLocation ? '#2563eb' : '#6b7280'}
          />
        </TouchableOpacity >

        {/* World View Reset - only show when zoomed in past world view */}
        {
          region.latitudeDelta < 30 && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleResetView}
              activeOpacity={0.7}
            >
              <Globe size={20} color="#f97316" />
            </TouchableOpacity>
          )
        }
      </View >

      {/* Events Counter - bottom left (matching web) */}
      < View style={styles.eventsCounter} >
        <Text style={styles.eventsCounterText}>
          {activeRooms.length} {activeRooms.length === 1 ? 'event' : 'events'} in view
        </Text>
      </View >

      {/* Floating Map/List Toggle - Bottom Center (matching web) */}
      < View style={styles.viewToggleContainer} >
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleButton, styles.viewToggleButtonActive]}
          >
            <MapIcon size={18} color="#ffffff" />
            <Text style={styles.viewToggleTextActive}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => {
              navigation.navigate('List');
            }}
          >
            <List size={18} color="#6b7280" />
            <Text style={styles.viewToggleText}>List</Text>
          </TouchableOpacity>
        </View>
      </View >

      {/* Empty State */}
      {
        activeRooms.length === 0 && !isLoading && (
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
        )
      }

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        rooms={myRooms}
        onRoomSelect={(room) => {
          navigation.navigate('ChatRoom', { room });
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
    </View >
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
    fontSize: 22,
    fontWeight: '600',
    color: '#1f2937',
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
  },
  mapControls: {
    position: 'absolute',
    top: 150,
    right: 10,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  controlButtonActive: {
    backgroundColor: '#eff6ff',
  },
  zoomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 2,
  },
  eventsCounter: {
    position: 'absolute',
    bottom: 115,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
  },
  eventsCounterText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
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
    gap: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: '#f97316',
  },
  viewToggleText: {
    fontSize: 14,
    color: '#6b7280',
  },
  viewToggleTextActive: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
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
  simulatedCircle: {
    borderWidth: 2,
    position: 'absolute',
  },
});

