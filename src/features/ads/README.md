# Ads Feature Module

Google AdMob integration for BubbleUp.

## Quick Start

```tsx
// Banner ad (in any screen)
import { AdBanner } from '@/features/ads';

<AdBanner />

// Interstitial ad (e.g., on room join)
import { useInterstitialAd } from '@/features/ads';

const { showAd } = useInterstitialAd();
await showAd(); // Shows on 2nd+ join per session
```

## Production Setup

1. **Get AdMob IDs** from [admob.google.com](https://admob.google.com)

2. **Update `app.json`**:
   ```json
   ["react-native-google-mobile-ads", {
     "androidAppId": "ca-app-pub-YOUR_APP_ID",
     "iosAppId": "ca-app-pub-YOUR_APP_ID"
   }]
   ```

3. **Update `config/adConfig.ts`** - Replace `PROD_AD_UNITS` values

4. **Rebuild**: `npx expo prebuild --clean && npx expo run:ios`

## Files

| File | Purpose |
|------|---------|
| `config/adConfig.ts` | All ad unit IDs (single source of truth) |
| `components/AdBanner.tsx` | Banner ad component |
| `hooks/useInterstitialAd.ts` | Interstitial with session limiting |
| `hooks/useAdConsent.ts` | GDPR/ATT consent |

## Adding New Ad Types

1. Add ad unit IDs to `adConfig.ts`
2. Create hook in `hooks/` (see `useInterstitialAd.ts` as example)
3. Export from `index.ts`
