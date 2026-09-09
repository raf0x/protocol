export function activeTab(path: string) {
  if (path === '/protocol') return 'Today'
  if (path === '/protocol/manage' || path.startsWith('/protocol/manage/')) return 'Protocols'
  if (path === '/timeline' || path.startsWith('/timeline/')) return 'Timeline'
  if (path === '/journal' || path.startsWith('/journal/')) return 'Health'
  return 'More'
}
