export type IconName = 'today' | 'protocols' | 'timeline' | 'health' | 'more' | 'chevron' | 'check' | 'profile' | 'close'

const paths: Record<IconName, string> = {
  today: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  protocols: 'm16 3 5 5m-7-3 5 5M5 14l5 5m-7 2 3-3m1-7 6-6 6 6-6 6H7v-6Zm3-3 3 3',
  timeline: 'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 9h2m4 0h4m-10 4h2',
  health: 'M4 20v-7m5 7V8m6 12V4m5 16v-9',
  more: 'M4 12h.01M12 12h.01M20 12h.01',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  profile: 'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  close: 'm6 6 12 12M6 18 18 6',
}

export default function AppIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
