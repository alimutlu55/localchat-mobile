import React from 'react';
import { useMembership } from '../../features/user/hooks/useMembership';
import { DEFAULT_FREE_LIMITS, Entitlement, SubscriptionLimits } from '../../types/subscription';
import { View, ViewStyle } from 'react-native';

export interface FeatureGateProps {
    /** Feature key from the manifest/limits object */
    feature?: keyof SubscriptionLimits;
    /** Semantic entitlement key */
    entitlement?: Entitlement;
    /** Optional predicate to check the feature value */
    requirement?: (value: any) => boolean;
    /** UI to show when access is denied */
    fallback?: React.ReactNode;
    /** Children to render if conditions are met */
    children: React.ReactNode;
    /** Whether to completely remove the container from layout (default: true) */
    collapse?: boolean;
    /** Optional style for the wrapper if not collapsed */
    style?: ViewStyle;
}

/**
 * FeatureGate - Granular UI control based on specific manifest limits or entitlements
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
    feature,
    entitlement,
    requirement,
    fallback = null,
    children,
    collapse = true,
    style
}) => {
    const { canAccess, entitlements } = useMembership();

    let hasAccess = true;

    if (entitlement) {
        const value = entitlements[entitlement] ?? false;
        hasAccess = requirement ? requirement(value) : value;
    } else if (feature) {
        hasAccess = canAccess(feature as string, requirement);
    }

    if (!hasAccess) {
        if (collapse) return null;
        return <View style={style}>{fallback}</View>;
    }

    return <View style={style}>{children}</View>;
};

export default FeatureGate;
