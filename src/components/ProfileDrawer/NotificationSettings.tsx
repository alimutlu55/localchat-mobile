/**
 * NotificationSettings Component
 * 
 * Notification preferences section with toggles
 */

import React from 'react';
import { Bell, MessageSquare } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface NotificationSettingsProps {
    pushNotifications: boolean;
    messageNotifications: boolean;
    onPushToggle: (value: boolean) => void;
    onMessageToggle: (value: boolean) => void;
}

export function NotificationSettings({
    pushNotifications,
    messageNotifications,
    onPushToggle,
    onMessageToggle,
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
        </Section>
    );
}
