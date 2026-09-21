'use client'
import { useEffect, useState } from 'react'
import { localCalendarDate } from './protocolDates'

export function useLocalCalendarDate() {
  const [date, setDate] = useState(localCalendarDate())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      setDate(localCalendarDate())
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 50)
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh) }
  }, [])
  return date
}
