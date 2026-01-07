import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Plus } from 'lucide-react-native';
import { ConnectionBanner } from '../../../components/chat/ConnectionBanner';
import { styles } from '../screens/DiscoveryScreen.styles';

interface DiscoveryHeaderProps {
    onOpenSidebar: () => void;
    onCreateRoom: () => void;
}

export const DiscoveryHeader: React.FC<DiscoveryHeaderProps> = ({
    onOpenSidebar,
    onCreateRoom,
}) => {
    return (
        <SafeAreaView style={styles.header} edges={['top']}>
            {/* Self-contained banner - reads from NetworkStore, handles retries internally */}
            <ConnectionBanner />
            <View style={styles.headerContent}>
                <TouchableOpacity
                    style={styles.hamburgerButton}
                    onPress={onOpenSidebar}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Menu size={24} color="#374151" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>BubbleUp</Text>

                <TouchableOpacity
                    style={styles.headerCreateButton}
                    onPress={onCreateRoom}
                    activeOpacity={0.8}
                >
                    <Plus size={20} color="#ffffff" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default DiscoveryHeader;
