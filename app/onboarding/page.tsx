import { redirect } from 'next/navigation'

export default function OnboardingPage() {
  // Retain old bookmarks; Today owns the authenticated ownership check.
  redirect('/protocol')
}
