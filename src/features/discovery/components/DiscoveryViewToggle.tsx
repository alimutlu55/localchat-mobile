import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Map as MapIcon, List } from 'lucide-react-native';
import { styles } from '../screens/DiscoveryScreen.styles';

interface DiscoveryViewToggleProps {
    viewMode: 'map' | 'list';
    onSetViewMode: (mode: 'map' | 'list') => void;
    style?: any;
}

export const DiscoveryViewToggle: React.FC<DiscoveryViewToggleProps> = ({
    viewMode,
    onSetViewMode,
    style,
}) => {
    return (
        <View style={[styles.viewToggleContainer, style]} pointerEvents="box-none">
            <View style={styles.viewToggle}>
                <TouchableOpacity
                    style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
                    onPress={() => onSetViewMode('map')}
                >
                    <MapIcon size={22} color={viewMode === 'map' ? '#ffffff' : '#6b7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
                    onPress={() => onSetViewMode('list')}
                >
                    <List size={22} color={viewMode === 'list' ? '#ffffff' : '#6b7280'} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default DiscoveryViewToggle;
