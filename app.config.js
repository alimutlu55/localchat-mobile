export default ({ config }) => {
    // If config already contains the expo object (common in Expo 49+),
    // use it directly, otherwise fallback to config.expo
    const expoConfig = config.expo || config;
    const plugins = expoConfig.plugins || [];

    return {
        ...config,
        plugins: plugins.map((plugin) => {
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
    };
};
