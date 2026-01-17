import React from 'react';
import { useMembership } from '../../features/user/hooks/useMembership';
import { SubscriptionLimits } from '../../types/subscription';

export interface FeatureGateProps {
    /** Feature key from the manifest/limits object */
    feature: keyof SubscriptionLimits;
    /** Optional predicate to check the feature value */
    requirement?: (value: any) => boolean;
    /** UI to show when access is denied */
    fallback?: React.ReactNode;
    /** Children to render if conditions are met */
    children: React.ReactNode;
}

/**
 * FeatureGate - Granular UI control based on specific manifest limits
 * 
 * Usage:
 * <FeatureGate feature="maxParticipants" requirement={val => val > 100}>
 *   <LargeRoomOptions />
 * </FeatureGate>
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
    feature,
    requirement,
    fallback = null,
    children
}) => {
    const { canAccess } = useMembership();

    const hasAccess = canAccess(feature as string, requirement);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

export default FeatureGate;
