import React from 'react';
import { Lock, UserX, Database, CreditCard, Star, Shield } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface AccountSettingsProps {
    blockedUsersCount: number;
    onBlockedUsersPress: () => void;
    onDataControlsPress: () => void;
    isPro: boolean;
    onSubscriptionPress: () => void;
}

export function AccountSettings({
    blockedUsersCount,
    onBlockedUsersPress,
    onDataControlsPress,
    isPro,
    onSubscriptionPress,
}: AccountSettingsProps) {
    return (
        <Section title="ACCOUNT">
            <SettingRow
                icon={Star}
                label="Subscription"
                value={isPro ? "Pro Active" : "Upgrade"}
                onPress={onSubscriptionPress}
                highlight={!isPro}
            />
            <SettingRow
                icon={UserX}
                label="Blocked Users"
                value={blockedUsersCount > 0 ? `${blockedUsersCount}` : undefined}
                onPress={onBlockedUsersPress}
            />
            <SettingRow
                icon={Database}
                label="Data Controls"
                onPress={onDataControlsPress}
            />
        </Section>
    );
}

