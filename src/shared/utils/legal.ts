import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

export const LEGAL_URLS = {
    termsOfService: 'https://bubbleupapp.com/terms.html',
    privacyPolicy: 'https://bubbleupapp.com/privacy.html',
};

const BRAND_PRIMARY = '#6366f1'; // Hardcoded to avoid circular deps with theme

export const openTermsOfService = async () => {
    try {
        await WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            controlsColor: BRAND_PRIMARY,
        });
    } catch (error) {
        console.error('Failed to open Terms of Service', error);
        Alert.alert('Error', 'Failed to open Terms of Service');
    }
};

export const openPrivacyPolicy = async () => {
    try {
        await WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            controlsColor: BRAND_PRIMARY,
        });
    } catch (error) {
        console.error('Failed to open Privacy Policy', error);
        Alert.alert('Error', 'Failed to open Privacy Policy');
    }
};


