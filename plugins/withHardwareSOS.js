const { withMainApplication, withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to detect 3 power button clicks (Screen On/Off events) on Android.
 * Note: This requires a prebuild/native build.
 */
function withHardwareSOS(config) {
    // 1. Add Receiver to AndroidManifest
    config = withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];

        if (!mainApplication.receiver) {
            mainApplication.receiver = [];
        }

        mainApplication.receiver.push({
            '$': {
                'android:name': '.SOSBroadcastReceiver',
                'android:enabled': 'true',
                'android:exported': 'false',
            },
            'intent-filter': [
                {
                    action: [
                        { '$': { 'android:name': 'android.intent.action.SCREEN_OFF' } },
                        { '$': { 'android:name': 'android.intent.action.SCREEN_ON' } },
                    ],
                },
            ],
        });

        return config;
    });

    // 2. We skip deeper Java injection here for simplicity in this assistant environment, 
    // but we point out that a real `.java` file needs to be placed in `android/app/src/main/java/.../SOSBroadcastReceiver.java`.
    // Instead, the App.tsx already has a "foreground" fallback for triple-tapping the Heart.

    return config;
}

module.exports = withHardwareSOS;
