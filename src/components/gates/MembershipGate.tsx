import React from 'react';
import { useMembership } from '../../features/user/hooks/useMembership';

export interface MembershipGateProps {
    /** Show children only if user is pro */
    proOnly?: boolean;
    /** Show children only if user is NOT pro */
    freeOnly?: boolean;
    /** Show children only if user belongs to specific tiers */
    tiers?: string | string[];
    /** UI to show when access is denied */
    fallback?: React.ReactNode;
    /** Children to render if conditions are met */
    children: React.ReactNode;
}

/**
 * MembershipGate - Declaratively control UI based on membership
 * 
 * Usage:
 * <MembershipGate proOnly fallback={<UpgradeButton />}>
 *   <ExclusiveFeature />
 * </MembershipGate>
 */
export const MembershipGate: React.FC<MembershipGateProps> = ({
    proOnly,
    freeOnly,
    tiers,
    fallback = null,
    children
}) => {
    const { isPro, isTier } = useMembership();

    let hasAccess = true;

    if (proOnly && !isPro) {
        hasAccess = false;
    }

    if (freeOnly && isPro) {
        hasAccess = false;
    }

    if (tiers && !isTier(tiers)) {
        hasAccess = false;
    }

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

export default MembershipGate;
