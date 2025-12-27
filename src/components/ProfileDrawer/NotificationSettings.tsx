/**
 * NotificationSettings Component
 * 
 * Notification preferences section with toggles
 */

import React from 'react';
import { Bell, MessageSquare, Volume2 } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface NotificationSettingsProps {
    pushNotifications: boolean;
    messageNotifications: boolean;
    soundEnabled: boolean;
    onPushToggle: (value: boolean) => void;
    onMessageToggle: (value: boolean) => void;
    onSoundToggle: (value: boolean) => void;
}

export function NotificationSettings({
    pushNotifications,
    messageNotifications,
    soundEnabled,
    onPushToggle,
    onMessageToggle,
    onSoundToggle,
}: NotificationSettingsProps) {
    return (
        <Section title="NOTIFICATIONS">
            <SettingRow
                icon={Bell}
                label="Push Notifications"
                isToggle
                isEnabled={pushNotifications}
                onToggle={onPushToggle}
            />
            <SettingRow
                icon={MessageSquare}
                label="Message Notifications"
                isToggle
                isEnabled={messageNotifications}
                onToggle={onMessageToggle}
            />
            <SettingRow
                icon={Volume2}
                label="Sounds"
                isToggle
                isEnabled={soundEnabled}
                onToggle={onSoundToggle}
            />
        </Section>
    );
}
