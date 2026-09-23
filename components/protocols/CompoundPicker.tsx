'use client'
import { useEffect, useRef, useState } from 'react'
import AppIcon from '../app/AppIcon'
import { compoundQuickPicks, compoundSearch, quickPickCategories, type QuickPickCategory } from '../../lib/protocols/catalog'
import { selectCompound } from '../../lib/protocols/quickStart'
import type { Compound } from '../../lib/protocols/form'
import { QuickStartError } from './QuickStartControls'

export default function CompoundPicker({ value, onChange, idPrefix = 'quick-compound' }: { value: Compound; onChange: (value: Compound) => void; idPrefix?: string }) {
  const [changing, setChanging] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<QuickPickCategory>('Peptides')
  const [page, setPage] = useState(0)
  const searchInput = useRef<HTMLInputElement>(null)
  const changeButton = useRef<HTMLButtonElement>(null)
  const selectedByUser = useRef(false)
  useEffect(() => {
    if (changing) searchInput.current?.focus()
    else if (selectedByUser.current) changeButton.current?.focus()
  }, [changing, value.name])
  const choose = (name: string) => { selectedByUser.current = true; onChange(selectCompound(value, name)); setChanging(false); setQuery(''); setPage(0) }
  if (value.name && !changing) return <div className="quick-selected">
    <span className="quick-compound-icon"><AppIcon name="protocols" size={20} /></span><strong>{value.name}</strong>
    <button ref={changeButton} className="quick-text-action" type="button" onClick={() => { setQuery(value.name); setChanging(true); setPage(0) }}>Change</button>
  </div>
  const searching = Boolean(query.trim())
  const search = compoundSearch(query)
  const matches = searching ? search.matches : compoundQuickPicks(category)
  return <div className="quick-picker">
    <div className="quick-search-field">
      <label htmlFor={`${idPrefix}-search`}>Search compounds</label>
      <div className="quick-search-control">
        <AppIcon name="search" size={20} />
        <input ref={searchInput} id={`${idPrefix}-search`} type="search" aria-label="Search compounds" aria-describedby={search.error ? `${idPrefix}-search-error` : undefined} aria-invalid={Boolean(search.error)} placeholder="Name, abbreviation or brand" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} onKeyDown={event => { if (event.key === 'Enter' && search.exact) { event.preventDefault(); choose(search.exact.name) } }} />
        {query && <button className="quick-clear" type="button" aria-label="Clear compound search" onClick={() => { setQuery(''); setPage(0); searchInput.current?.focus() }}><AppIcon name="close" size={18} /></button>}
      </div>
    </div>
    {!searching && <div className="quick-segmented" role="group" aria-label="Compound category">{quickPickCategories.map(name => <button type="button" key={name} aria-pressed={category === name} onClick={() => { setCategory(name); setPage(0) }}><span>{name}</span>{category === name && <AppIcon name="check" size={14} />}</button>)}</div>}
    {matches.length > 0 && <div className="quick-picks" role="group" aria-label={searching ? 'Matching compounds' : `${category} quick picks`}>{matches.slice(page * 5, page * 5 + 5).map(item => <button type="button" key={item.id} data-long-name={(item.shortName || item.name).length > 18} onClick={() => choose(item.name)}>{item.shortName || item.name}</button>)}</div>}
    {search.customName && <button className="quick-text-action quick-custom" type="button" onClick={() => choose(search.customName!)}>Use “{search.customName}”</button>}
    <QuickStartError id={`${idPrefix}-search-error`} message={search.error} />
    {matches.length > 5 && <nav className="quick-options" aria-label="Search result pages">
      {page > 0 && <button className="quick-text-action" type="button" onClick={() => setPage(page - 1)}>Previous results</button>}
      {(page + 1) * 5 < matches.length && <button className="quick-text-action" type="button" onClick={() => setPage(page + 1)}>More results</button>}
    </nav>}
    {changing && <button className="quick-text-action" type="button" onClick={() => setChanging(false)}>Keep current compound</button>}
  </div>
}
