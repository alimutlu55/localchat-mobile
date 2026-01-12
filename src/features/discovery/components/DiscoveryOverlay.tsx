import React from 'react';
import { Text, TouchableOpacity, Animated } from 'react-native';
import { styles } from '../screens/DiscoveryScreen.styles';
import { MAX_ZOOM } from '../types/discovery.contracts';

interface DiscoveryOverlayProps {
    markersOpacity: Animated.Value;
    totalEventsInView: number;
    serverFeaturesCount: number;
    isLoadingClusters: boolean;
    isMapStable: boolean;
    isUserInView: boolean;
    isMapMoving: boolean;
    onCreateRoom: () => void;
    zoom: number;
    topOffset?: number;
    emptyStateStyle?: any;
}

export const DiscoveryOverlay: React.FC<DiscoveryOverlayProps> = ({
    markersOpacity,
    totalEventsInView,
    serverFeaturesCount,
    isLoadingClusters,
    isMapStable,
    isUserInView,
    isMapMoving,
    onCreateRoom,
    zoom,
    topOffset = 140,
    emptyStateStyle,
}) => {
    return (
        <>
            {/* Events Counter - Fade in with markers */}
            <Animated.View style={[styles.eventsCounter, { opacity: markersOpacity, top: topOffset + 5 }]}>
                <Text style={styles.eventsCounterText}>
                    {totalEventsInView} {totalEventsInView === 1 ? 'event' : 'events'} in view
                </Text>
            </Animated.View>

            {/* Empty State - Show if empty, user in view, and (map stable OR at max zoom) */}
            {serverFeaturesCount === 0 && !isLoadingClusters && isUserInView && (zoom >= MAX_ZOOM || (isMapStable && !isMapMoving)) && zoom > MAX_ZOOM - 1 && (
                <Animated.View style={[styles.emptyState, { opacity: markersOpacity }, emptyStateStyle]}>
                    <Text style={styles.emptyTitle}>No rooms nearby</Text>
                    <Text style={styles.emptyText}>Be the first to start a conversation!</Text>
                    <TouchableOpacity style={styles.createButton} onPress={onCreateRoom}>
                        <Text style={styles.createButtonText}>Create Room</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </>
    );
};

export default DiscoveryOverlay;
