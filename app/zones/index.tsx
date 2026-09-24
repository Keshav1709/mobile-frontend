import { CameraAreaList } from '@/components/CameraAreaList';
import { Screen } from '@/components/Screen';
import { goBack } from '@/lib/helpers';

/** Areas, outside setup: reachable from Profile any time. */
export default function ZonesIndex() {
  return (
    <Screen
      onBack={() => goBack('/(tabs)/profile')}
      eyebrow="Facility"
      title="Camera areas"
      subtitle="Outline the areas that matter on each camera. Change them whenever the camera moves."
    >
      <CameraAreaList />
    </Screen>
  );
}
