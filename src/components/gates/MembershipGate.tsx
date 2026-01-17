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
 * Includes error boundary to prevent crashes if UserStore is corrupted.
 * Falls back to showing fallback (or nothing) on error.
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
    // Error boundary: Catch potential errors from useMembership hook
    // This prevents app crashes if UserStore is in an invalid state
    let isPro = false;
    let isTier: (tiers: string | string[]) => boolean = () => false;

    try {
        const membership = useMembership();
        isPro = membership.isPro;
        isTier = membership.isTier;
    } catch (error) {
        // Log error but don't crash - fallback to showing fallback prop
        console.error('[MembershipGate] Error accessing membership:', error);
        return <>{fallback}</>;
    }

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
