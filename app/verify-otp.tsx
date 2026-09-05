import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { font } from '@/theme';

export default function VerifyOtp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { confirmOtp, sendOtp } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      await confirmOtp(code);
      router.replace('/');
    } catch (cause) {
      setError(errorMessage(cause, 'That code is not correct.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await sendOtp(phone);
      setResent(true);
    } catch (cause) {
      setError(errorMessage(cause, 'We could not resend the code.'));
    }
  };

  return (
    <Screen
      onBack={() => router.back()}
      eyebrow="Verification"
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${phone}.`}
      footer={
        <>
          <Button label="Verify" onPress={verify} disabled={code.length !== 6} loading={busy} />
          <Button label="Use a different number" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      {error ? <Banner tone="error" title="Verification failed" message={error} /> : null}
      <TextField
        label="Verification code"
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
      />
      <Text style={font.caption} onPress={resend}>
        {resent ? 'Code sent again.' : "Didn't get it? Send again."}
      </Text>
    </Screen>
  );
}
