import React from 'react';
import { Text, TouchableOpacity, Animated, View } from 'react-native';
import { MapPinOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    isAnimating: boolean;
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
    isAnimating,
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

            {/* Empty State - Show if empty, user in view, and (map stable OR at max zoom) AND not animating */}
            {serverFeaturesCount === 0 && !isLoadingClusters && isUserInView && !isAnimating && (zoom >= MAX_ZOOM || (isMapStable && !isMapMoving)) && zoom > MAX_ZOOM - 1 && (
                <Animated.View
                    style={[
                        styles.emptyState,
                        {
                            opacity: markersOpacity,
                            transform: [{
                                translateY: markersOpacity.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [10, 0] // Smaller entry jump
                                })
                            }]
                        },
                        emptyStateStyle
                    ]}
                >
                    <View style={styles.emptyHeader}>
                        <View style={styles.emptyIconContainer}>
                            <MapPinOff size={16} color="#FF6410" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.emptyTitle}>No rooms nearby</Text>
                    </View>

                    <Text
                        style={styles.emptyText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                    >
                        Be the first to start a conversation!
                    </Text>

                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={onCreateRoom}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#FF8C42', '#FF6410']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.createButtonGradient}
                        />
                        <Text style={styles.createButtonText}>Create Room</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </>
    );
};

export default DiscoveryOverlay;
