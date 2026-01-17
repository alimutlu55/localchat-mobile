import React from 'react';
import { Lock, UserX, Database, CreditCard, Star, Shield } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface AccountSettingsProps {
    blockedUsersCount: number;
    onBlockedUsersPress: () => void;
    onDataControlsPress: () => void;
    isPro: boolean;
    onProPress: () => void;
    onManagePress?: () => void;
}

export function AccountSettings({
    blockedUsersCount,
    onBlockedUsersPress,
    onDataControlsPress,
    isPro,
    onProPress,
    onManagePress,
}: AccountSettingsProps) {
    return (
        <Section title="ACCOUNT">
            <SettingRow
                icon={Star}
                label="Subscription"
                value={isPro ? "Pro Active" : "Upgrade"}
                onPress={onProPress}
                highlight={!isPro}
            />
            {isPro && onManagePress && (
                <SettingRow
                    icon={Shield}
                    label="Manage"
                    onPress={onManagePress}
                />
            )}
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

