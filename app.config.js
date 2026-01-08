export default ({ config }) => ({
    ...config,
    expo: {
        ...config.expo,
        plugins: [
            ...config.expo.plugins.map((plugin) => {
                if (Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads") {
                    return [
                        "react-native-google-mobile-ads",
                        {
                            androidAppId: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713",
                            iosAppId: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-3940256099942544~1458002511",
                        },
                    ];
                }
                return plugin;
            }),
        ],
    },
});
