import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
const fixedTime = Date.parse('2026-10-29T12:00:00Z')
const calendarDay = '2026-10-29'
const owner = 'fictional-owner'
const phase = { id: 'fictional-phase', dose: 5, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily', start_week: 1, end_week: null, time_of_day: 'Morning' }
const protocol = { id: 'fictional-protocol', name: 'Fictional protocol', status: 'active', start_date: '2026-09-01', created_at: '2026-09-01', compounds: [{ id: 'fictional-compound', name: 'Fictional compound', phases: [phase] }] }
const ok = data => ({ data, error: null })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'boolean' ? '' : String(tree ?? '')

// Run the actual page and its effects. Child components are presentation boundaries;
// their real props/callbacks remain observable, while no Next server or backend runs.
function fixture(t, plans = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: fixedTime })
  const globals = ['window', 'localStorage', 'sessionStorage', 'document', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  const listeners = new Map(), storage = new Map(), authListeners = new Set()
  const storageApi = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const redirects = [], requests = [], mutations = [], boundaries = new Map()
  const state = { date: calendarDay, user: { id: owner }, mounted: true, dirty: true, tree: null, firstReady: null }
  const windowMock = {
    setTimeout: (...args) => setTimeout(...args), clearTimeout: id => clearTimeout(id),
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn) },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn) },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event) },
    location: { assign: value => redirects.push(value), href: '', origin: 'http://fictional.local' },
  }
  for (const [name, value] of Object.entries({ window: windowMock, localStorage: storageApi, sessionStorage: storageApi, document: { visibilityState: 'visible' }, navigator: { vibrate() {} } })) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  const slots = [], effectSlots = [], pendingEffects = []
  let slot = 0, effectSlot = 0, updatesAfterUnmount = 0
  const hooks = {
    useState(initial) {
      const index = slot++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => {
        if (!state.mounted) { updatesAfterUnmount++; return }
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; state.dirty = true }
      }]
    },
    useRef(initial) { const index = slot++; return slots[index] ?? (slots[index] = { current: initial }) },
    useEffect(callback, dependencies) {
      const index = effectSlot++, old = effectSlots[index]
      if (!old || !dependencies || dependencies.some((value, i) => !Object.is(value, old.dependencies?.[i]))) {
        pendingEffects.push(() => { old?.cleanup?.(); effectSlots[index] = { dependencies, cleanup: callback() } })
      }
    },
    useMemo(callback, dependencies) {
      const index = slot++, old = slots[index]
      if (!old || !dependencies || dependencies.some((value, i) => !Object.is(value, old.dependencies?.[i]))) slots[index] = { dependencies, value: callback() }
      return slots[index].value
    },
    useCallback(callback, dependencies) { return hooks.useMemo(() => callback, dependencies) },
  }
  function queryKind(query) {
    if (query.table === 'protocol_events') throw Error('Today must not request unused protocol events')
    if (query.table === 'user_profiles') return 'profile'
    if (query.table === 'journal_entries') return 'journal'
    if (query.table === 'injection_logs') return query.filters.some(([field]) => field === 'date') ? 'today' : 'history'
    if (query.table === 'protocols') {
      if (query.columns === 'id') return 'ownership'
      return query.filters.some(([field, value]) => field === 'status' && value === 'planned') ? 'planned' : 'active'
    }
    if (query.table === 'compounds') return 'compound'
    throw Error(`Unexpected mocked table: ${query.table}`)
  }
  function defaultData(kind) {
    return { profile: { weight_unit: 'lbs' }, journal: [], active: [protocol], today: [], history: [], planned: [], ownership: [{ id: protocol.id }], compound: { doses_taken_override: 0 } }[kind]
  }
  const backend = {
    auth: {
      getUser() {
        const request = { kind: 'auth', started: Date.now() - fixedTime }
        requests.push(request)
        return Promise.resolve(plans.auth ? plans.auth(request) : { data: { user: state.user }, error: null })
      },
      onAuthStateChange(callback) { authListeners.add(callback); return { data: { subscription: { unsubscribe() { authListeners.delete(callback) } } } } },
    },
    from(table) {
      const query = { table, filters: [], methods: [], started: null }
      let result
      const chain = {
        select(columns) { query.columns = columns; return chain },
        eq(field, value) { query.filters.push([field, value]); return chain },
        order(...args) { query.methods.push(['order', ...args]); return chain },
        limit(...args) { query.methods.push(['limit', ...args]); return chain },
        range(...args) { query.methods.push(['range', ...args]); return chain },
        gte(...args) { query.methods.push(['gte', ...args]); return chain },
        single() { return chain }, maybeSingle() { return chain },
        abortSignal(signal) { query.signal = signal; return chain },
        upsert(value) { query.mutation = 'upsert'; query.value = value; return chain },
        update(value) { query.mutation = 'update'; query.value = value; return chain },
        then(resolve, reject) {
          if (!result) {
            query.started = Date.now() - fixedTime
            query.owner = state.user?.id
            if (query.mutation) {
              mutations.push(query)
              result = Promise.resolve(plans.mutation ? plans.mutation(query) : ok(table === 'user_profiles' ? { weight_unit: query.value.weight_unit } : null))
            } else {
              query.kind = queryKind(query); requests.push(query)
              result = Promise.resolve(plans[query.kind] ? plans[query.kind](query) : ok(defaultData(query.kind)))
            }
          }
          return result.then(resolve, reject)
        },
      }
      return chain
    },
  }
  const cache = new Map()
  function load(file) {
    const url = new URL(file, import.meta.url)
    if (cache.has(url.href)) return cache.get(url.href)
    const output = { exports: {} }
    const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions }).outputText
    new Function('require', 'module', 'exports', code)(name => {
      if (name === 'react') return { ...React, ...hooks }
      if (name === 'next/navigation') return { useRouter: () => ({ replace: path => redirects.push(path), push: path => redirects.push(path) }) }
      if (name.endsWith('/supabase')) return { createClient: () => backend }
      if (name.endsWith('/useLocalCalendarDate')) return { useLocalCalendarDate: () => state.date }
      if (name.endsWith('.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
      if (name.includes('/components/')) {
        const label = name.split('/').at(-1)
        if (!boundaries.has(label)) boundaries.set(label, Object.assign(() => null, { displayName: label }))
        return { __esModule: true, default: boundaries.get(label) }
      }
      if (!name.startsWith('.')) return require(name)
      return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
    }, output, output.exports)
    cache.set(url.href, output.exports)
    return output.exports
  }
  const Page = load('../app/protocol/page.tsx').default
  function draw() {
    if (!state.mounted) return
    state.dirty = false; slot = 0; effectSlot = 0
    state.tree = Page()
    if (find('TodayOverview') && state.firstReady === null) state.firstReady = Date.now() - fixedTime
    while (pendingEffects.length) pendingEffects.shift()()
  }
  function find(name, tree = state.tree) { return nodes(tree).find(node => node.type === boundaries.get(name)) }
  async function settle() {
    for (let i = 0; i < 30; i++) { await Promise.resolve(); if (state.dirty) draw() }
  }
  async function advance(ms) {
    for (let elapsed = 0; elapsed < ms;) { const step = Math.min(100, ms - elapsed); t.mock.timers.tick(step); elapsed += step; await settle() }
  }
  function unmount() {
    for (const effect of effectSlots) effect?.cleanup?.()
    state.mounted = false
  }
  t.after(() => {
    if (state.mounted) unmount()
    for (const [name, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
  })
  draw()
  return {
    state, plans, requests, mutations, redirects, backend, boundaries, find, settle, advance, unmount,
    text: () => text(state.tree), updatesAfterUnmount: () => updatesAfterUnmount,
    overview: () => find('TodayOverview')?.props,
    checkinTree() { const prompt = nodes(this.overview()?.checkin).find(node => node.type === boundaries.get('DailyCheckInPrompt')); return prompt?.props.children(() => {}) },
    checkin() { return find('DailyCheckIn', this.checkinTree())?.props },
    click(label, tree = state.tree) { const button = nodes(tree).find(node => node.type === 'button' && text(node).includes(label)); assert.ok(button, `Missing button: ${label}`); return button.props.onClick() },
    async day(value) { state.date = value; state.dirty = true; await settle() },
    async auth(event, user) { state.user = user; for (const callback of authListeners) callback(event, user ? { user } : null); await settle() },
    async refresh() { windowMock.dispatchEvent(new Event('doses_updated')); await settle() },
  }
}

test('critical Today renders in 400ms with 200ms auth/reads while secondary requests stall for 30 seconds', async t => {
  const after = (ms, value) => new Promise(resolve => setTimeout(() => resolve(value), ms))
  const f = fixture(t, {
    auth: () => after(200, { data: { user: { id: owner } }, error: null }),
    ownership: () => after(200, ok([{ id: protocol.id }])),
    active: () => after(200, ok([protocol])),
    today: () => after(200, ok([])),
    journal: () => after(30_000, ok([])),
    profile: () => after(30_000, ok({ weight_unit: 'lbs' })),
    history: () => after(30_000, ok([])),
    planned: () => after(30_000, ok([])),
  })
  await f.settle(); await f.advance(400)
  assert.ok(f.overview(), 'Verified critical data must reveal Today independently of secondary reads')
  assert.equal(f.state.firstReady, 400)
  assert.equal(f.overview().due.length, 1)
  assert.equal(f.overview().due[0].dose, '5 mg')
  assert.equal(typeof f.overview().onTaken, 'function')
  assert.equal(f.requests.filter(request => request.kind !== 'auth').length, 7)
  assert.equal(f.find('HeroProtocolCard', f.overview().detail), undefined, 'Inventory and next-dose history cannot be invented while history is pending')
  assert.equal(f.find('WeeklySchedule', f.overview().schedule), undefined, 'Pending history cannot render as an empty schedule')
  assert.equal(f.checkin(), undefined, 'Check-in waits for trustworthy history and profile')
  t.diagnostic(`Fictional elapsed first actionable Today: ${f.state.firstReady}ms; secondary response delay: 30000ms`)
})

for (const kind of ['auth', 'ownership', 'active', 'today']) {
  test(`${kind} stall reaches a recoverable deadline at 10 seconds and ignores its late response`, async t => {
    const pending = deferred()
    const f = fixture(t, { [kind]: () => pending.promise })
    await f.settle(); await f.advance(9_900)
    assert.match(f.text(), /Loading your day/)
    assert.equal(f.overview(), undefined)
    await f.advance(100)
    assert.doesNotMatch(f.text(), /Loading your day/)
    assert.match(f.text(), /Try again/)
    assert.equal(f.overview(), undefined)
    if (kind !== 'auth') assert.equal(f.requests.find(request => request.kind === kind).signal?.aborted, true, 'Timed out database reads are cancelled')
    pending.resolve(kind === 'auth' ? { data: { user: { id: owner } }, error: null } : ok(kind === 'active' ? [protocol] : []))
    await f.settle()
    assert.equal(f.overview(), undefined, 'A response after the deadline cannot dismiss the recovery UI')
    delete f.plans[kind]
    f.click('Try again'); await f.settle()
    assert.ok(f.overview(), 'Explicit retry can recover without reloading the document')
  })
}

test('authentication failure and missing session are distinct, and neither starts data reads', async t => {
  const f = fixture(t, { auth: () => ({ data: { user: null }, error: { name: 'AuthRetryableFetchError', message: 'Fictional offline network' } }) })
  await f.settle()
  const networkText = f.text()
  assert.match(networkText, /Try again/)
  assert.equal(f.requests.length, 1)
  f.plans.auth = () => ({ data: { user: null }, error: null })
  f.click('Try again'); await f.settle()
  assert.notEqual(f.text(), networkText)
  assert.match(f.text(), /sign in/i)
  assert.equal(f.requests.length, 2)
  assert.equal(f.overview(), undefined)
})

test('ownership failure never invokes empty-account onboarding; successful empty ownership does', async t => {
  const f = fixture(t, { ownership: () => ({ data: null, error: { message: 'Fictional unavailable ownership' } }) })
  await f.settle()
  assert.deepEqual(f.redirects, [])
  assert.equal(f.overview(), undefined)
  assert.match(f.text(), /Try again/)
  f.plans.ownership = () => ok([])
  f.click('Try again'); await f.settle()
  assert.deepEqual(f.redirects, ['/protocol/manage?new=1&onboarding=1'])
})

test('overlapping dose-update events share one active refresh batch', async t => {
  const pending = deferred()
  const f = fixture(t)
  await f.settle()
  const before = f.requests.length
  f.plans.active = () => pending.promise
  await f.refresh(); await f.refresh(); await f.refresh()
  const started = f.requests.slice(before)
  assert.equal(started.filter(request => request.kind === 'active').length, 1)
  assert.equal(started.filter(request => request.kind === 'auth').length, 1)
  assert.ok(f.overview(), 'Background refresh retains usable visible content')
  assert.doesNotMatch(f.text(), /Loading your day/)
  pending.resolve(ok([protocol])); await f.settle()
})

test('unmount aborts outstanding database reads and ignores completions', async t => {
  const pending = deferred()
  const f = fixture(t, { active: () => pending.promise, history: () => pending.promise, journal: () => pending.promise })
  await f.settle()
  f.unmount()
  assert.ok(f.requests.filter(request => ['active', 'history', 'journal'].includes(request.kind)).every(request => request.signal?.aborted))
  pending.resolve(ok([])); await f.settle(); await f.advance(11_000)
  assert.equal(f.updatesAfterUnmount(), 0)
})

test('sign-out clears usable Today and late history cannot resurrect the previous account', async t => {
  const pending = deferred()
  const f = fixture(t, { history: () => pending.promise })
  await f.settle()
  assert.ok(f.overview())
  await f.auth('SIGNED_OUT', null)
  assert.equal(f.overview(), undefined)
  assert.match(f.text(), /sign in/i)
  pending.resolve(ok([{ compound_id: 'fictional-compound', date: calendarDay, taken: true }]))
  await f.settle()
  assert.equal(f.overview(), undefined)
  delete f.plans.history
  await f.auth('SIGNED_IN', { id: owner })
  assert.ok(f.overview(), 'A verified sign-in event restores Today after the session ended')
})

test('calendar-day transition invalidates old reads before presenting the new day', async t => {
  const pending = deferred()
  const f = fixture(t, { today: request => request.filters.some(([key, value]) => key === 'date' && value === calendarDay) ? pending.promise : ok([]) })
  await f.settle()
  await f.day('2026-10-30')
  assert.ok(f.overview())
  assert.equal(f.overview().date, '2026-10-30')
  pending.resolve(ok([{ compound_id: 'fictional-compound', date: calendarDay, taken: true, discomfort: 0 }]))
  await f.settle()
  assert.equal(f.overview().date, '2026-10-30')
  assert.equal(f.overview().logs['fictional-compound'], undefined)
})

test('failed historical reads retain critical Today and expose recovery instead of empty history', async t => {
  const f = fixture(t, { history: () => ({ data: null, error: { message: 'Fictional history failure' } }) })
  await f.settle()
  assert.equal(f.overview().due.length, 1)
  assert.equal(f.find('HeroProtocolCard', f.overview().detail), undefined)
  assert.equal(f.find('WeeklySchedule', f.overview().schedule), undefined)
  assert.match(text(f.overview().schedule), /couldn.t be loaded/i)
  assert.match(text(f.overview().schedule), /Retry history/)
  const counts = Object.fromEntries(['auth', 'active', 'today', 'ownership'].map(kind => [kind, f.requests.filter(request => request.kind === kind).length]))
  const historic = [{ compound_id: 'fictional-compound', date: '2001-01-01', taken: true }]
  f.plans.history = () => ok(historic)
  f.click('Retry history', f.overview().schedule); await f.settle()
  assert.deepEqual(f.find('WeeklySchedule', f.overview().schedule).props.allLogs, historic)
  for (const [kind, count] of Object.entries(counts)) assert.equal(f.requests.filter(request => request.kind === kind).length, count, 'Section retry does not repeat unrelated critical reads')
})

test('every secondary group has a bounded deadline and retries independently', async t => {
  const pending = deferred()
  const f = fixture(t, { profile: () => pending.promise, journal: () => pending.promise, history: () => pending.promise, planned: () => pending.promise })
  await f.settle()
  assert.ok(f.overview())
  assert.equal(f.overview().healthStatus, 'loading')
  await f.advance(10_000)
  assert.ok(f.overview())
  assert.equal(f.overview().healthStatus, 'error')
  assert.equal(f.checkin(), undefined)
  assert.match(text(f.overview().schedule), /Retry history/)
  assert.match(f.text(), /Retry planned protocols/)
  for (const kind of ['profile', 'journal', 'history', 'planned']) {
    assert.equal(f.requests.find(request => request.kind === kind).signal?.aborted, true)
    delete f.plans[kind]
  }
  f.overview().onRetryHealth(); await f.settle()
  assert.equal(f.overview().healthStatus, 'ready')
  assert.ok(f.checkin())
  assert.match(text(f.overview().schedule), /Retry history/, 'Retrying health does not reset history errors')
  f.click('Retry history', f.overview().schedule); await f.settle()
  f.click('Retry planned protocols'); await f.settle()
  assert.ok(f.find('WeeklySchedule', f.overview().schedule))
  assert.ok(f.find('PlannedProtocols'))
  pending.resolve(ok([])); await f.settle()
  assert.equal(f.overview().healthStatus, 'ready', 'Stale timed-out secondary work cannot replace retry results')
})

test('journal and injection history retain early records, recent non-null defaults and canonical weight calculations', async t => {
  const entries = [
    { date: calendarDay, weight: null, sleep: null, mood: 4, energy: 3, hunger: 2, notes: 'Fictional notes' },
    { date: '2026-10-27', weight: 180, sleep: 8, mood: 3, energy: 4, hunger: 3 },
    { date: '2001-01-01', weight: 200, sleep: 7, mood: 2, energy: 2, hunger: 2 },
  ]
  const history = [{ compound_id: 'fictional-compound', date: '2001-01-01', taken: true }]
  const f = fixture(t, { journal: () => ok(entries), history: () => ok(history), profile: () => ok({ weight_unit: 'kg' }) })
  await f.settle()
  assert.deepEqual(f.overview().entries, entries)
  assert.equal(f.overview().weightUnit, 'kg')
  assert.equal(f.checkin().weight, '81.6')
  assert.equal(f.checkin().sleep, '8')
  assert.equal(f.checkin().mood, 4)
  assert.equal(f.checkin().notes, 'Fictional notes')
  const detail = f.find('HeroProtocolCard', f.overview().detail)
  assert.equal(detail.props.totalLost, '20.0')
  assert.deepEqual(detail.props.allLogs, history)
  assert.deepEqual(f.find('WeeklySchedule', f.overview().schedule).props.allLogs, history)
  for (const request of f.requests.filter(request => ['history', 'journal'].includes(request.kind))) {
    assert.ok(!request.methods.some(([name]) => ['limit', 'range', 'gte'].includes(name)), 'Historical reads retain all previously returned records')
    assert.ok(!request.filters.some(([key]) => key === 'date'), 'No historical date cutoff is introduced')
  }
})

test('account switch invalidates previous ownership, records and drafts before new data appears', async t => {
  const pending = deferred()
  const f = fixture(t, { journal: request => request.owner === owner ? pending.promise : ok([{ date: calendarDay, weight: 160, notes: 'Second fictional account' }]) })
  await f.settle()
  assert.ok(f.overview())
  const second = 'fictional-owner-two'
  await f.auth('SIGNED_IN', { id: second })
  assert.ok(f.overview())
  assert.equal(f.checkin().weight, '160')
  pending.resolve(ok([{ date: calendarDay, weight: 210, notes: 'Stale first fictional account' }]))
  await f.settle()
  assert.equal(f.checkin().weight, '160')
  assert.equal(f.checkin().notes, 'Second fictional account')
  assert.ok(f.requests.filter(request => request.kind === 'journal').some(request => request.owner === second))
})

test('account change during pending authentication cannot establish the previous owner', async t => {
  const oldAuth = deferred()
  let authCalls = 0
  const f = fixture(t, { auth: () => ++authCalls === 1 ? oldAuth.promise : { data: { user: { id: 'fictional-owner-two' } }, error: null } })
  await f.settle()
  await f.auth('SIGNED_IN', { id: 'fictional-owner-two' })
  oldAuth.resolve({ data: { user: { id: owner } }, error: null })
  await f.settle()
  assert.ok(f.overview())
  const ownership = f.requests.filter(request => request.kind === 'ownership')
  assert.ok(ownership.length > 0)
  assert.ok(ownership.every(request => request.filters.some(([field, value]) => field === 'user_id' && value === 'fictional-owner-two')))
})

test('background journal refresh preserves edited drafts and does not flash the page', async t => {
  const f = fixture(t, { journal: () => ok([{ date: calendarDay, weight: 180, sleep: 7, notes: 'Saved fictional note' }]) })
  await f.settle()
  f.checkin().onWeightChange('177'); f.checkin().onSleepChange('8'); f.checkin().onNotesChange('Unsaved fictional draft')
  await f.settle()
  const pending = deferred()
  f.plans.journal = () => pending.promise
  await f.refresh()
  assert.ok(f.overview())
  assert.equal(f.checkin().weight, '177')
  pending.resolve(ok([{ date: calendarDay, weight: 180, sleep: 7, notes: 'Stale saved note' }]))
  await f.settle()
  assert.equal(f.checkin().weight, '177')
  assert.equal(f.checkin().sleep, '8')
  assert.equal(f.checkin().notes, 'Unsaved fictional draft')
  assert.doesNotMatch(f.text(), /Loading your day/)
})

test('double journal-save invocation performs one upsert and retains the visible draft', async t => {
  const pending = deferred()
  const f = fixture(t, { mutation: query => query.table === 'journal_entries' ? pending.promise : ok(null) })
  await f.settle()
  f.checkin().onWeightChange('177'); f.checkin().onNotesChange('Fictional save')
  await f.settle()
  const save = f.checkin().onSave
  const first = save(), second = save()
  await f.settle()
  assert.equal(f.mutations.filter(query => query.table === 'journal_entries').length, 1)
  assert.ok(f.overview()); assert.equal(f.checkin().weight, '177')
  pending.resolve(ok(null)); await Promise.all([first, second]); await f.settle()
  assert.ok(f.overview()); assert.equal(f.checkin().weight, '177')
  assert.doesNotMatch(f.text(), /Loading your day/)
})

test('double dose action performs one upsert and late pre-save history cannot reverse saved state', async t => {
  const oldHistory = deferred(), save = deferred()
  const f = fixture(t)
  await f.settle()
  let reads = 0
  const savedLog = { compound_id: 'fictional-compound', date: calendarDay, taken: true, discomfort: 0 }
  f.plans.history = () => ++reads === 1 ? oldHistory.promise : ok([savedLog])
  f.plans.mutation = query => query.table === 'injection_logs' ? save.promise : ok(null)
  await f.refresh()
  const take = f.overview().onTaken
  const first = take('fictional-compound'), second = take('fictional-compound')
  await f.settle()
  assert.equal(f.mutations.filter(query => query.table === 'injection_logs').length, 1)
  f.plans.today = () => ok([savedLog])
  save.resolve(ok(null)); await Promise.all([first, second]); await f.settle()
  assert.ok(f.overview()); assert.equal(f.overview().logs['fictional-compound'].taken, true)
  oldHistory.resolve(ok([])); await f.settle()
  assert.equal(f.overview().logs['fictional-compound'].taken, true)
  assert.deepEqual(f.find('WeeklySchedule', f.overview().schedule).props.allLogs, [savedLog])
  assert.doesNotMatch(f.text(), /Loading your day/)
})

test('secondary refresh failures preserve health, history and drafts with dependent controls disabled', async t => {
  const entries = [{ date: calendarDay, weight: 180, sleep: 7, notes: 'Fictional recorded note' }]
  const history = [{ compound_id: 'fictional-compound', date: '2001-01-01', taken: true }]
  const f = fixture(t, { journal: () => ok(entries), history: () => ok(history) })
  await f.settle()
  f.checkin().onWeightChange('177'); f.checkin().onNotesChange('Keep this fictional draft')
  await f.settle()
  f.plans.journal = f.plans.history = () => ({ data: null, error: { message: 'Fictional refresh failure' } })
  await f.refresh()
  assert.ok(f.overview(), 'Secondary refresh failures keep essential Today content visible')
  assert.equal(f.overview().healthStatus, 'error')
  assert.equal(f.overview().healthAvailable, true)
  assert.deepEqual(f.overview().entries, entries)
  assert.equal(f.checkin().weight, '177')
  assert.equal(f.checkin().notes, 'Keep this fictional draft')
  assert.ok(nodes(f.overview().checkin).concat(nodes(f.checkinTree())).some(node => node.type === 'fieldset' && node.props.disabled), 'Retained check-in is disabled while health data is unverified')
  const detail = f.find('HeroProtocolCard', f.overview().detail)
  assert.deepEqual(detail.props.allLogs, history)
  const schedule = f.find('WeeklySchedule', f.overview().schedule)
  assert.deepEqual(schedule.props.allLogs, history)
  assert.ok(nodes(f.overview().detail).some(node => node.type === 'fieldset' && node.props.disabled), 'Retained protocol detail cannot mutate stale inventory')
  assert.ok(nodes(f.overview().schedule).some(node => node.type === 'fieldset' && node.props.disabled), 'Retained history cannot toggle stale logs')
  assert.match(text(f.overview().schedule), /Retry history/)
  assert.doesNotMatch(f.text(), /Loading your day/)
  f.plans.journal = () => ok(entries); f.plans.history = () => ok(history)
  f.overview().onRetryHealth(); f.click('Retry history', f.overview().schedule)
  await f.settle()
  assert.equal(f.overview().healthStatus, 'ready')
  assert.equal(f.checkin().weight, '177')
  assert.equal(f.checkin().notes, 'Keep this fictional draft')
  assert.ok(!nodes(f.overview().checkin).concat(nodes(f.checkinTree())).some(node => node.type === 'fieldset' && node.props.disabled))
  assert.ok(!nodes(f.overview().schedule).some(node => node.type === 'fieldset' && node.props.disabled))
})

for (const change of ['sign-out', 'account', 'day']) {
  for (const kind of ['journal', 'dose']) {
    test(`${kind} write finishing after ${change} cannot alter the new scope or start stale follow-up writes`, async t => {
      const pending = deferred()
      const table = kind === 'journal' ? 'journal_entries' : 'injection_logs'
      const f = fixture(t, { mutation: query => query.table === table ? pending.promise : ok(null) })
      await f.settle()
      f.checkin().onWeightChange('177'); f.checkin().onNotesChange('Old scope fictional draft')
      await f.settle()
      const write = kind === 'journal' ? f.checkin().onSave() : f.overview().onTaken('fictional-compound')
      await f.settle()
      assert.equal(f.mutations.length, 1)
      assert.equal(f.mutations[0].value.user_id, owner)
      assert.equal(f.mutations[0].value.date, calendarDay)
      if (change === 'sign-out') await f.auth('SIGNED_OUT', null)
      else if (change === 'account') await f.auth('SIGNED_IN', { id: 'fictional-owner-two' })
      else await f.day('2026-10-30')
      const before = {
        text: f.text(), entries: structuredClone(f.overview()?.entries), logs: structuredClone(f.overview()?.logs),
        weight: f.checkin()?.weight, saved: f.checkin()?.saved, requests: f.requests.length,
      }
      pending.resolve(ok(null)); await write; await f.settle()
      assert.equal(f.text(), before.text)
      assert.deepEqual(f.overview()?.entries, before.entries)
      assert.deepEqual(f.overview()?.logs, before.logs)
      assert.equal(f.checkin()?.weight, before.weight)
      assert.equal(f.checkin()?.saved, before.saved)
      assert.equal(f.requests.length, before.requests, 'Old completion must not refresh or query inventory in the new scope')
      assert.equal(f.mutations.length, 1, 'Old dose completion must not write inventory after scope changed')
      if (change === 'sign-out') assert.equal(f.overview(), undefined)
      else assert.ok(f.overview())
    })
  }
}

test('a stalled save bounds suspended profile/history sections, keeps its mutation lock and recovers when the write finishes', async t => {
  const oldRead = deferred(), pendingWrite = deferred()
  const f = fixture(t, { journal: () => ok([{ date: calendarDay, weight: 180, notes: 'Fictional saved entry' }]) })
  await f.settle()
  f.checkin().onWeightChange('177'); await f.settle()
  f.plans.profile = f.plans.history = () => oldRead.promise
  await f.refresh()
  f.plans.mutation = query => query.table === 'injection_logs' ? pendingWrite.promise : ok(null)
  const take = f.overview().onTaken
  const write = take('fictional-compound'); await f.settle()
  assert.equal(f.mutations.filter(query => query.table === 'injection_logs').length, 1)
  assert.ok(f.overview())
  await f.advance(10_000)
  assert.equal(f.overview().healthStatus, 'error')
  assert.equal(f.overview().healthAvailable, true)
  assert.equal(f.checkin().weight, '177')
  assert.match(text(f.overview().schedule), /Retry history/)
  assert.match(f.text(), /save is still pending/i)
  assert.equal(f.overview().saving, true)
  const beforeRetry = f.requests.length
  await take('fictional-compound'); await f.settle()
  assert.equal(f.mutations.filter(query => query.table === 'injection_logs').length, 1, 'An uncertain write stays locked after the read deadline')
  f.overview().onRetryHealth(); f.click('Retry history', f.overview().schedule)
  await f.settle()
  assert.equal(f.overview().healthStatus, 'loading', 'Section retry actively waits under a fresh deadline')
  assert.match(text(f.overview().schedule), /Loading schedule and protocol history/)
  assert.equal(f.requests.length, beforeRetry, 'Suspended reads must not race an unresolved write')
  await f.advance(10_000)
  assert.equal(f.overview().healthStatus, 'error')
  assert.match(text(f.overview().schedule), /Retry history/)
  assert.equal(f.mutations.filter(query => query.table === 'injection_logs').length, 1)
  delete f.plans.profile
  const savedLog = { compound_id: 'fictional-compound', date: calendarDay, taken: true, discomfort: 0 }
  f.plans.history = f.plans.today = () => ok([savedLog])
  pendingWrite.resolve(ok(null)); await write; await f.settle()
  assert.equal(f.overview().healthStatus, 'ready')
  assert.equal(f.checkin().weight, '177')
  assert.equal(f.overview().logs['fictional-compound'].taken, true)
  assert.deepEqual(f.find('WeeklySchedule', f.overview().schedule).props.allLogs, [savedLog])
  assert.equal(f.overview().saving, false)
  assert.doesNotMatch(f.text(), /save is still pending/i)
  oldRead.resolve(ok([])); await f.settle()
  assert.equal(f.overview().healthStatus, 'ready')
  assert.deepEqual(f.find('WeeklySchedule', f.overview().schedule).props.allLogs, [savedLog])
})

test('remote weight-profile refresh preserves both the unit and value of an edited draft', async t => {
  const f = fixture(t, { journal: () => ok([{ date: calendarDay, weight: 180 }]) })
  await f.settle()
  f.checkin().onWeightChange('177'); await f.settle()
  f.plans.profile = () => ok({ weight_unit: 'kg' })
  await f.refresh()
  assert.equal(f.overview().healthStatus, 'ready')
  assert.equal(f.overview().weightUnit, 'lbs')
  assert.equal(f.checkin().weightUnit, 'lbs')
  assert.equal(f.checkin().weight, '177', '177 pounds must not be relabeled as 177 kilograms')
  await f.checkin().onSave(); await f.settle()
  const write = f.mutations.find(query => query.table === 'journal_entries')
  assert.equal(write.value.weight, 177, 'Saving retains the original canonical pounds meaning')
})

test('failed unit save converts a newer edited draft back to its original unit without replacing it', async t => {
  const pending = deferred()
  const f = fixture(t, { journal: () => ok([{ date: calendarDay, weight: 180 }]), mutation: query => query.table === 'user_profiles' ? pending.promise : ok(null) })
  await f.settle()
  f.overview().onToggleUnit(); await f.settle()
  assert.equal(f.checkin().weightUnit, 'kg')
  assert.equal(f.checkin().weight, '81.6')
  f.checkin().onWeightChange('80.0'); await f.settle()
  pending.resolve({ data: null, error: { message: 'Fictional preference failure' } })
  await f.settle()
  assert.equal(f.checkin().weightUnit, 'lbs')
  assert.equal(f.checkin().weight, '176', 'Keep the new 80 kg edit converted using the existing integer-pound display precision')
  assert.equal(f.mutations.filter(query => query.table === 'user_profiles').length, 1)
  assert.equal(f.overview().healthStatus, 'ready')
})

