import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ConsentScreen from '../ConsentScreen';
import { consentService } from '../../../services/consent';
import { useAuth } from '../../../features/auth/hooks/useAuth';

// Mock dependencies
jest.mock('../../../services/consent', () => ({
    consentService: {
        acceptAll: jest.fn().mockResolvedValue(undefined),
        acceptEssentialOnly: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../../features/auth/hooks/useAuth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../../core/theme', () => ({
    useTheme: () => ({
        tokens: {
            brand: { primary: '#000' },
            text: { primary: '#000', secondary: '#000', tertiary: '#000', onPrimary: '#fff' },
            bg: { surface: '#fff' },
            border: { subtle: '#ccc' },
        },
    }),
}));

describe('ConsentScreen', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            logout: jest.fn().mockResolvedValue(undefined),
        });
    });

    it('should have both buttons disabled initially', () => {
        render(<ConsentScreen />);

        const acceptAllButton = screen.getByText('Accept All');

        fireEvent.press(acceptAllButton);
        expect(consentService.acceptAll).not.toHaveBeenCalled();
    });

    it('should enable buttons only after all checkboxes (including age) are checked', async () => {
        render(<ConsentScreen />);

        // We target the outer Text's parent or the text itself carefully
        // "I agree to the " is unique to the checkbox row prefix
        const tosPart = screen.getAllByText(/I agree to the/i)[0];
        const privacyPart = screen.getAllByText(/I agree to the/i)[1];
        const ageCheckbox = screen.getByText(/I confirm I am at least/i);

        fireEvent.press(tosPart);
        fireEvent.press(privacyPart);

        const acceptAllButton = screen.getByText('Accept All');
        fireEvent.press(acceptAllButton);
        expect(consentService.acceptAll).not.toHaveBeenCalled(); // Still disabled (no age)

        fireEvent.press(ageCheckbox); // Now all checked

        await act(async () => {
            fireEvent.press(acceptAllButton);
        });
        await waitFor(() => {
            expect(consentService.acceptAll).toHaveBeenCalled();
        });
    });

    it('should call acceptEssentialOnly when the respective button is pressed', async () => {
        render(<ConsentScreen />);

        fireEvent.press(screen.getAllByText(/I agree to the/i)[0]);
        fireEvent.press(screen.getAllByText(/I agree to the/i)[1]);
        fireEvent.press(screen.getByText(/I confirm I am at least/i));

        const essentialsButton = screen.getByText('Only Essentials');
        fireEvent.press(essentialsButton);

        await waitFor(() => {
            expect(consentService.acceptEssentialOnly).toHaveBeenCalled();
        });
    });
});
