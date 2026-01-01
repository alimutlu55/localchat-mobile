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
    onBlockedUsersPress: () => void;
}

export function AccountSettings({
    blockedUsersCount,
    onBlockedUsersPress,
}: AccountSettingsProps) {
    return (
        <Section title="ACCOUNT">
            <SettingRow
                icon={UserX}
                label="Blocked Users"
                value={blockedUsersCount > 0 ? `${blockedUsersCount}` : undefined}
                onPress={onBlockedUsersPress}
            />
        </Section>
    );
}
