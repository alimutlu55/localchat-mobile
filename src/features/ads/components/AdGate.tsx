import { FeatureGate } from '../../../components/gates/FeatureGate';
import { useAds } from '../context/AdProvider';

interface AdGateProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * AdGate - Specialized gate for advertisements.
 * 
 * Logic:
 * 1. Checks if the user has the 'NO_ADS' entitlement (Subscription).
 * 2. Checks if the user has given consent for ads (GDPR/UMP).
 * 
 * Automatically handles container collapse for Pro users.
 */
export const AdGate: React.FC<AdGateProps> = ({ children, fallback = null }) => {
    const { canShowAds } = useAds();

    return (
        <FeatureGate
            entitlement="NO_ADS"
            collapse={true}
            requirement={(isNoAds: boolean) => !isNoAds} // Show children only IF NO_ADS is false
        >
            {/* If subscription allows ads, then check consent */}
            {canShowAds ? children : fallback}
        </FeatureGate>
    );
};

export default AdGate;
