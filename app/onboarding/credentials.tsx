import { router } from 'expo-router';
import { useState } from 'react';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useOnboarding } from '@/state/onboarding';

export default function CredentialsScreen() {
  const { target, setCredentials } = useOnboarding();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const submit = () => {
    setCredentials({ username: username.trim(), password });
    setPassword('');
    router.push('/onboarding/connecting');
  };

  return (
    <Screen
      onBack={() => router.back()}
      eyebrow="Authenticate"
      title="Camera sign-in"
      subtitle={`Enter the username and password for ${target?.label ?? 'this camera'}.`}
      footer={
        <>
          <Button label="Connect" onPress={submit} disabled={!username.trim() || !password} />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <TextField
        label="Username"
        required
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
      />
      <TextField
        label="Password"
        required
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
      />
      <Banner
        tone="info"
        title="Stays on this network"
        message="These credentials are used to talk to the camera over your Wi-Fi. They are never sent to the cloud."
      />
    </Screen>
  );
}
