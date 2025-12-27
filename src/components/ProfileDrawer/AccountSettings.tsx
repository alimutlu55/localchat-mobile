/**
 * AccountSettings Component
 * 
 * Account-related settings section (Privacy, Blocked Users)
 */

import React from 'react';
import { Lock, UserX } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface AccountSettingsProps {
    blockedUsersCount: number;
    onPrivacyPress: () => void;
    onBlockedUsersPress: () => void;
}

export function AccountSettings({
    blockedUsersCount,
    onPrivacyPress,
    onBlockedUsersPress,
}: AccountSettingsProps) {
    return (
        <Section title="ACCOUNT">
            <SettingRow
                icon={Lock}
                label="Privacy"
                onPress={onPrivacyPress}
            />
            <SettingRow
                icon={UserX}
                label="Blocked Users"
                value={blockedUsersCount > 0 ? `${blockedUsersCount}` : undefined}
                onPress={onBlockedUsersPress}
            />
        </Section>
    );
}
