const { withAndroidManifest } = require('expo/config-plugins');

function withSmsReader(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add SMS permissions
    const usesPermissions = manifest['uses-permission'] || [];
    const permissionsToAdd = [
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
    ];

    for (const perm of permissionsToAdd) {
      if (!usesPermissions.some((p) => p.$?.['android:name'] === perm)) {
        usesPermissions.push({ $: { 'android:name': perm } });
      }
    }
    manifest['uses-permission'] = usesPermissions;

    // Register broadcast receiver for SMS
    const application = manifest.application?.[0];
    if (application) {
      const receivers = application.receiver || [];
      const exists = receivers.some(
        (r) => r.$?.['android:name'] === 'expo.modules.smsnative.SmsBroadcastReceiver'
      );
      if (!exists) {
        receivers.push({
          $: {
            'android:name': 'expo.modules.smsnative.SmsBroadcastReceiver',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
            },
          ],
        });
        application.receiver = receivers;
      }
    }

    return config;
  });
}

module.exports = withSmsReader;
