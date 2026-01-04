/**
 * AccountSettings Component
 * 
 * Account-related settings section (Privacy, Blocked Users, Data Controls)
 */

import React from 'react';
import { Lock, UserX, Database } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface AccountSettingsProps {
    blockedUsersCount: number;
    onBlockedUsersPress: () => void;
    onDataControlsPress: () => void;
}

export function AccountSettings({
    blockedUsersCount,
    onBlockedUsersPress,
    onDataControlsPress,
}: AccountSettingsProps) {
    return (
        <Section title="ACCOUNT">
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

