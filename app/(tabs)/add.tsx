import { Redirect } from 'expo-router';

/**
 * The Add tab opens the onboarding stack rather than rendering in place, so the
 * flow gets the whole screen. The tab press is intercepted in the layout; this
 * redirect only runs if the route is reached some other way.
 */
export default function Add() {
  return <Redirect href="/onboarding" />;
}
