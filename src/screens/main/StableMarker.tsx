import React, { memo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Marker } from 'react-native-maps';
import { Room } from '../../types';
import { RoomPin } from '../../components/RoomPin';

interface StableMarkerProps {
    room: Room;
    id: string;
    showCircle: boolean;
    radiusPixels: number;
    isSelected: boolean;
    onPress: (room: Room) => void;
    isMapMoving: boolean;
}

/**
 * StableMarker Component
 * 
 * A specialized marker that maintains a static view hierarchy to prevent 
 * RCTComponentViewRegistry crashes on React Native Fabric (iOS).
 * Instead of adding/removing views, it uses opacity to toggle visibility.
 */
const StableMarker = ({
    room,
    id,
    showCircle,
    radiusPixels,
    isSelected,
    onPress,
    isMapMoving,
}: StableMarkerProps) => {
    // Use a ref to track if we need to enable tracksViewChanges for a frame
    const lastPropsRef = useRef({ showCircle, radiusPixels, isSelected });
    const [tracksViewChanges, setTracksViewChanges] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const propsChanged =
            lastPropsRef.current.showCircle !== showCircle ||
            lastPropsRef.current.radiusPixels !== radiusPixels ||
            lastPropsRef.current.isSelected !== isSelected;

        if (propsChanged) {
            lastPropsRef.current = { showCircle, radiusPixels, isSelected };

            // Toggle tracksViewChanges to allow native layer to update the marker content
            // We do this for a short burst to ensure stability
            setTracksViewChanges(true);

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setTracksViewChanges(false);
            }, 100); // 100ms is enough for a few frames
        }
    }, [showCircle, radiusPixels, isSelected]);

    return (
        <Marker
            key={id}
            coordinate={{
                latitude: room.latitude as number,
                longitude: room.longitude as number,
            }}
            onPress={() => onPress(room)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksViewChanges || !isMapMoving}
            zIndex={isSelected ? 30 : 20}
            tappable={true}
        >
            <View pointerEvents="none" style={styles.container}>
                {/* Radius Circle - ALWAYS RENDERED, visibility controlled by opacity */}
                <View
                    style={[
                        styles.circle,
                        {
                            width: Math.max(1, radiusPixels * 2),
                            height: Math.max(1, radiusPixels * 2),
                            borderRadius: Math.max(0.5, radiusPixels),
                            opacity: showCircle ? 1 : 0,
                            backgroundColor: room.isExpiringSoon ? 'rgba(254, 215, 170, 0.15)' : 'rgba(254, 205, 211, 0.15)',
                            borderColor: room.isExpiringSoon ? 'rgba(249, 115, 22, 0.5)' : 'rgba(244, 63, 94, 0.5)',
                        },
                    ]}
                />

                {/* Room Pin - Centered on top of the circle center */}
                <View
                    style={styles.pinWrapper}
                >
                    <RoomPin
                        room={room}
                        isSelected={isSelected}
                    />
                </View>
            </View>
        </Marker>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    circle: {
        borderWidth: 2,
        position: 'absolute',
        zIndex: 1,
    },
    pinWrapper: {
        position: 'absolute',
        bottom: '50%', // Aligns pin bottom tip with center coordinate
        zIndex: 10,
    },
});

export default memo(StableMarker);
