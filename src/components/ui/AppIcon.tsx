import React from 'react';
import { Image, View, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { ASSETS } from '../../constants/assets';

interface AppIconProps {
    size?: number;
    rounded?: boolean;
    style?: ViewStyle;
}

/**
 * Reusable AppIcon component to ensure consistent display of the app logo
 */
export const AppIcon: React.FC<AppIconProps> = ({
    size = 96,
    rounded = true,
    style
}) => {
    const borderRadius = rounded ? size / 4 : 0;

    return (
        <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
            <Image
                source={ASSETS.IDENTITIES.APP_ICON}
                style={{ width: size, height: size, borderRadius } as ImageStyle}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffffff',
        shadowColor: '#FF6410',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
});
