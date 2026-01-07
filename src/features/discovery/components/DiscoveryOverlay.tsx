import React from 'react';
import { Text, TouchableOpacity, Animated } from 'react-native';
import { styles } from '../screens/DiscoveryScreen.styles';

interface DiscoveryOverlayProps {
    markersOpacity: Animated.Value;
    totalEventsInView: number;
    serverFeaturesCount: number;
    isLoadingClusters: boolean;
    isMapStable: boolean;
    isUserInView: boolean;
    isMapMoving: boolean;
    onCreateRoom: () => void;
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
}) => {
    return (
        <>
            {/* Events Counter - Fade in with markers */}
            <Animated.View style={[styles.eventsCounter, { opacity: markersOpacity }]}>
                <Text style={styles.eventsCounterText}>
                    {totalEventsInView} {totalEventsInView === 1 ? 'event' : 'events'} in view
                </Text>
            </Animated.View>

            {/* Empty State - Only show if looking at user's area, it's empty, and map is NOT moving */}
            {serverFeaturesCount === 0 && !isLoadingClusters && isMapStable && isUserInView && !isMapMoving && (
                <Animated.View style={[styles.emptyState, { opacity: markersOpacity }]}>
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
