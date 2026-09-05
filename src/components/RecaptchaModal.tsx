import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { firebaseConfig } from '@/api/firebase';
import { Button } from '@/components/Button';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

export type RecaptchaHandle = {
  /** Firebase ApplicationVerifier contract: resolves with a reCAPTCHA token. */
  verify: () => Promise<string>;
  type: 'recaptcha';
};

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

const page = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:-apple-system,sans-serif}</style>
<script src="${SDK}/firebase-app-compat.js"></script>
<script src="${SDK}/firebase-auth-compat.js"></script></head>
<body><div id="recaptcha"></div><script>
  var send = function (data) { window.ReactNativeWebView.postMessage(JSON.stringify(data)); };
  firebase.initializeApp(${JSON.stringify(firebaseConfig)});
  var verifier = new firebase.auth.RecaptchaVerifier('recaptcha', {
    size: 'normal',
    callback: function (token) { send({ type: 'token', token: token }); },
    'expired-callback': function () { send({ type: 'expired' }); }
  });
  verifier.render().catch(function (e) { send({ type: 'error', message: String(e) }); });
</script></body></html>`;

/**
 * Firebase phone auth needs a reCAPTCHA token, which only exists in a browser
 * context. This hosts Firebase's own widget in a WebView and hands the token
 * back through the ApplicationVerifier interface.
 */
export const RecaptchaModal = forwardRef<RecaptchaHandle>((_props, ref) => {
  const { color } = useTheme();
  const [visible, setVisible] = useState(false);
  const pending =
    useRef<{ resolve: (token: string) => void; reject: (e: Error) => void } | undefined>(undefined);

  const settle = (token?: string, error?: Error) => {
    setVisible(false);
    if (token) pending.current?.resolve(token);
    else pending.current?.reject(error ?? new Error('Verification was cancelled.'));
    pending.current = undefined;
  };

  useImperativeHandle<RecaptchaHandle, RecaptchaHandle>(ref, () => ({
    type: 'recaptcha',
    verify: () =>
      new Promise<string>((resolve, reject) => {
        pending.current = { resolve, reject };
        setVisible(true);
      }),
  }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => settle()}>
      <SafeAreaView style={[styles.safe, { backgroundColor: color.base }]}>
        <View style={styles.header}>
          <Text style={[font.heading, { color: color.text }]}>Confirm you&apos;re not a robot</Text>
          <Text style={[font.caption, { color: color.textMuted }]}>Required once before we send your code.</Text>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html: page, baseUrl: `https://${firebaseConfig.authDomain}` }}
          onMessage={(event) => {
            const data = JSON.parse(event.nativeEvent.data) as { type: string; token?: string };
            if (data.type === 'token' && data.token) settle(data.token);
            if (data.type === 'error') settle(undefined, new Error('Verification failed.'));
          }}
        />
        <View style={styles.footer}>
          <Button label="Cancel" variant="secondary" onPress={() => settle()} />
        </View>
      </SafeAreaView>
    </Modal>
  );
});

RecaptchaModal.displayName = 'RecaptchaModal';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { padding: space.xl, gap: space.xs },
  footer: { padding: space.xl },
});
