'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import styles from './journal.module.css'

type JournalEntry = {
  id: string
  date: string
  mood: number | null
  energy: number | null
  hunger: number | null
  sleep: number | null
  weight: number | null
  notes: string | null
}

const scoreColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

export default function ManageHealthEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [hunger, setHunger] = useState<number | null>(null)
  const [sleep, setSleep] = useState('')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .order('date', { ascending: false })

    setEntries((data || []) as JournalEntry[])
    setLoading(false)
  }

  function startEdit(entry: JournalEntry) {
    setEditingId(entry.id)
    setDate(entry.date)
    setMood(entry.mood)
    setEnergy(entry.energy)
    setSleep(entry.sleep?.toString() || '')
    setWeight(entry.weight?.toString() || '')
    setHunger(entry.hunger ?? null)
    setNotes(entry.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    setSaving(true)
    const supabase = createClient()
    const row: Record<string, string | number | null> = {
      mood,
      energy,
      notes: notes.trim(),
    }

    if (sleep) row.sleep = parseFloat(sleep)
    if (weight) row.weight = parseFloat(weight)
    if (hunger !== null) row.hunger = hunger
    if (date) row.date = date

    await supabase.from('journal_entries').update(row).eq('id', editingId)

    setSaving(false)
    setEditingId(null)
    load()
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this health entry?')) return

    const supabase = createClient()
    await supabase.from('journal_entries').delete().eq('id', id)
    load()
  }

  function ScoreButton({
    label,
    value,
    current,
    onChange,
  }: {
    label: string
    value: number
    current: number | null
    onChange: (value: number) => void
  }) {
    const isActive = current === value
    const scoreColor = scoreColors[value - 1]

    return (
      <button
        type="button"
        className={styles.scoreButton}
        aria-label={`${label} ${value}`}
        aria-pressed={isActive}
        onClick={() => onChange(value)}
        style={
          isActive
            ? {
                backgroundColor: scoreColor,
                borderColor: scoreColor,
              }
            : undefined
        }
      >
        {value}
      </button>
    )
  }

  if (loading) {
    return (
      <main className={styles.loading} role="status">
        Loading health entries...
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Health data</p>
          <h1>Manage health entries</h1>
          <p className={styles.intro}>
            Correct or remove daily check-ins. Your complete history lives in
            Timeline.
          </p>
        </div>

        <Link
          className={styles.timelineLink}
          href="/timeline?category=journal"
        >
          View health timeline
          <span aria-hidden="true">›</span>
        </Link>
      </header>

      {editingId && (
        <section className={styles.editor} aria-labelledby="edit-entry-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Selected entry</p>
              <h2 id="edit-entry-title">Edit health entry</h2>
            </div>
            <button
              type="button"
              className={styles.quietButton}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>

          <label className={styles.field}>
            <span>Date</span>
            <input
              className={styles.dateInput}
              type="date"
              value={date}
              onChange={event => setDate(event.target.value)}
            />
          </label>

          <div className={styles.scoreRows}>
            {[
              ['Mood', mood, setMood],
              ['Energy', energy, setEnergy],
              ['Hunger', hunger, setHunger],
            ].map(([label, current, setter]) => (
              <div className={styles.scoreRow} key={label as string}>
                <span>{label as string}</span>
                <div
                  className={styles.scoreGroup}
                  role="group"
                  aria-label={label as string}
                >
                  {[1, 2, 3, 4, 5].map(value => (
                    <ScoreButton
                      key={value}
                      label={label as string}
                      value={value}
                      current={current as number | null}
                      onChange={setter as (value: number) => void}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Sleep, hours</span>
              <input
                type="number"
                step="0.5"
                value={sleep}
                onChange={event => setSleep(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Weight, lbs</span>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={event => setWeight(event.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Add context..."
              rows={3}
            />
          </label>

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={cancelEdit}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={saveEdit}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="saved-entries-title">
        <div className={styles.listHeading}>
          <div>
            <p className={styles.eyebrow}>Recorded check-ins</p>
            <h2 id="saved-entries-title">Saved entries</h2>
          </div>
          <span>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className={styles.empty}>
            <h2>No health entries yet</h2>
            <p>Add your first check-in from Today.</p>
            <Link href="/protocol">Go to Today</Link>
          </div>
        ) : (
          <div className={styles.entryList}>
            {entries.map(entry => (
              <article className={styles.entryCard} key={entry.id}>
                <div className={styles.entryHeading}>
                  <time dateTime={entry.date}>
                    {new Date(
                      entry.date + 'T12:00:00'
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>

                  <div className={styles.entryActions}>
                    <button type="button" onClick={() => startEdit(entry)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => deleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className={styles.metrics}>
                  {entry.mood !== null && <span>Mood {entry.mood}/5</span>}
                  {entry.energy !== null && (
                    <span>Energy {entry.energy}/5</span>
                  )}
                  {entry.sleep !== null && <span>Sleep {entry.sleep} h</span>}
                  {entry.weight !== null && <span>{entry.weight} lbs</span>}
                  {entry.hunger !== null && (
                    <span>Hunger {entry.hunger}/5</span>
                  )}
                </div>

                {entry.notes && (
                  <p className={styles.notes}>{entry.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
