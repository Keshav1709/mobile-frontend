export type Camera = {
  camera_id: string;
  tenant_id: string;
  display_name: string;
  manufacturer: string | null;
  model: string | null;
  firmware: string | null;
  serial_number: string | null;
  ip: string | null;
  onvif_xaddr: string | null;
  selected_profile: string | null;
  /** Set when the stream is published to the relay; the go2rtc stream name. */
  stream_reference: string | null;
  resolution: string | null;
  connection_status: string;
  last_seen: string | null;
};

/** What the app writes to the registry after a successful connect. */
export type RegisterCamera = {
  camera_id: string;
  tenant_id: string;
  user_id?: string;
  display_name: string;
  manufacturer?: string | null;
  model?: string | null;
  firmware?: string | null;
  serial_number?: string | null;
  ip: string;
  onvif_xaddr?: string | null;
  selected_profile?: string | null;
  stream_reference?: string | null;
  resolution?: string | null;
  connection_status?: string;
};

export type UserProfile = {
  user_id: string;
  tenant_id: string;
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  camera_type: string | null;
  auth_provider: string;
  created_at: string | null;
  profile_completed: boolean;
  onboarding_completed: boolean;
};

/** Fields the profile screen can write. Any subset is accepted. */
export type ProfileDraft = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  date_of_birth?: string;
  camera_type?: string;
};
