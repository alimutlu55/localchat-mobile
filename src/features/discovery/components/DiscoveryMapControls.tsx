import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Plus, Minus, Navigation, Globe } from 'lucide-react-native';
import { styles } from '../screens/DiscoveryScreen.styles';

interface DiscoveryMapControlsProps {
    zoom: number;
    markersOpacity: Animated.Value;
    isMapStable: boolean;
    hasLocationPermission: boolean;
    userLocation: { latitude: number; longitude: number } | null;
    zoomIn: () => void;
    zoomOut: () => void;
    onCenterOnUser: () => void;
    onResetToWorldView: () => void;
}

export const DiscoveryMapControls: React.FC<DiscoveryMapControlsProps> = ({
    zoom,
    markersOpacity,
    isMapStable,
    hasLocationPermission,
    userLocation,
    zoomIn,
    zoomOut,
    onCenterOnUser,
    onResetToWorldView,
}) => {
    return (
        <Animated.View
            style={[
                styles.mapControls,
                { opacity: markersOpacity }
            ]}
            pointerEvents={isMapStable ? 'auto' : 'none'}
        >
            <View style={styles.zoomCard}>
                <TouchableOpacity style={styles.zoomButton} onPress={zoomIn} activeOpacity={0.7}>
                    <Plus size={20} color="#374151" />
                </TouchableOpacity>
                <View style={styles.zoomDivider} />
                <TouchableOpacity style={styles.zoomButton} onPress={zoomOut} activeOpacity={0.7}>
                    <Minus size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            {hasLocationPermission && (
                <TouchableOpacity
                    style={[styles.controlButton, userLocation && styles.controlButtonActive]}
                    onPress={onCenterOnUser}
                    activeOpacity={0.7}
                >
                    <Navigation size={20} color={userLocation ? '#2563eb' : '#6b7280'} />
                </TouchableOpacity>
            )}

            {zoom > 1 && (
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={onResetToWorldView}
                    activeOpacity={0.7}
                >
                    <Globe size={20} color="#FF6410" />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};

export default DiscoveryMapControls;
