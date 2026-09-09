#!/usr/bin/env node
/**
 * The settings-row store seat, proven against the built client bundle.
 *
 * What it proves (and what it does NOT):
 * - `lib/client.js` materializes without any release-specific specifier and
 *   registers exactly one `settings.general.item` entry carrying a store seat.
 * - The seat is a framework-neutral `StoreHandle`: `create()` yields
 *   `{ actions, getSnapshot, subscribe, clearPersisted }`, which is all the
 *   renderer binds (`useStore` from getSnapshot/subscribe, `actions` verbatim).
 * - The baked `sync` mirrors the Host snapshot, fences stale revisions, and
 *   notifies subscribers; unsubscribe stops delivery.
 * - It does NOT render React, and it does NOT prove GUI behaviour.
 *
 * Usage: node tests/client-store.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', 'lib', 'client.js')
const PLUGIN_ID = 'dsh-session-search-toggle'

/** Module table the web shell seeds in both target releases (react family only here). */
const TABLE = {
  'react': {
    createElement: () => ({}), Fragment: {},
    useState: (v) => [v, () => {}], useEffect: () => {}, useMemo: (f) => f(),
    useRef: (v) => ({ current: v }), useSyncExternalStore: (sub, get) => get(),
  },
  'react-dom': { createPortal: () => ({}) },
}

/** Minimal DOM so the stylesheet effect can run headless. */
function documentStub() {
  const el = () => ({
    dataset: {}, style: {}, textContent: '', attributes: {},
    setAttribute() {}, removeAttribute() {}, remove() {}, appendChild() {},
    querySelectorAll: () => [], closest: () => null,
  })
  return {
    head: { appendChild: () => {} },
    documentElement: {},
    createElement: () => el(),
    querySelector: () => null,
    querySelectorAll: () => [],
  }
}

/** Materialize the bundle and return its exports. */
function loadBundle() {
  const captured = []
  const sandbox = {
    window: { __ModuleLoader__: { load: (reg) => captured.push(reg) } },
    document: documentStub(),
    MutationObserver: class { observe() {} disconnect() {} },
    queueMicrotask: (fn) => fn(),
    setTimeout, clearTimeout, console,
  }
  sandbox.globalThis = sandbox
  runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'lib/client.js' })
  assert.equal(captured.length, 1, 'bundle must register exactly one factory')
  const reg = captured[0]
  assert.equal(reg.id, PLUGIN_ID, `factory id "${reg.id}" !== "${PLUGIN_ID}"`)
  const seen = new Set()
  const exports = reg.factory((spec) => {
    seen.add(spec)
    assert.ok(spec in TABLE, `non-baseline require "${spec}"`)
    return TABLE[spec]
  })
  return { exports, seen }
}

/** Client context that records slot registrations. */
function clientCtx(ledger) {
  const disposer = () => {}
  let snapshot = {
    status: 'ready',
    value: { enabled: false, defaultMode: 'title' },
    base: undefined,
    user: undefined,
    revision: 1,
    writable: false,
    mode: 'host',
  }
  const scope = {
    getSnapshot: () => snapshot,
    subscribe: () => disposer,
    set: async () => {},
    unset: async () => {},
  }
  const slots = {
    inject: (name, fn) => { fn(); return disposer },
    register: (options) => { ledger.push(options); return disposer },
  }
  return {
    ctx: {
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : disposer },
      on: () => disposer,
      get: (name) => {
        if (name === 'settingsScope') return { bind: () => scope }
        if (name === 'slots') return slots
        return undefined
      },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      slots,
    },
    setSnapshot: (next) => { snapshot = next },
  }
}

let failures = 0
const line = (s) => process.stdout.write(`${s}\n`)
const check = (name, fn) => {
  try { fn(); line(`  PASS  ${name}`) } catch (err) { failures++; line(`  FAIL  ${name} — ${err?.message ?? err}`) }
}

line('=== dsh-session-search-toggle settings store ===')

const { exports, seen } = loadBundle()
check('bundle materializes with only baseline specifiers', () => {
  for (const spec of seen) assert.ok(!/dsh-client-(runtime|store)/.test(spec), `release-specific require "${spec}"`)
  assert.equal(typeof exports.apply, 'function', 'client half exports no apply()')
})

const ledger = []
const { ctx, setSnapshot } = clientCtx(ledger)
exports.apply(ctx)

check('registers exactly one settings.general.item seat', () => {
  assert.equal(ledger.length, 1, `expected 1 registration, got ${ledger.length}`)
  const options = ledger[0]
  assert.equal(options.name, 'settings.general.item')
  assert.equal(options.id, PLUGIN_ID)
  assert.equal(typeof options.store, 'object', 'store seat must carry a handle')
  assert.equal(typeof options.store.create, 'function', 'handle must expose create()')
  assert.ok(options.store.spec !== undefined, 'handle must carry the spec')
})

const options = ledger[0]
if (options === undefined) {
  line('\nTEST FAIL (no settings.general.item registration)')
  process.exit(1)
}
const instance = options.store.create()

check('instance satisfies the StoreInstance contract', () => {
  assert.equal(typeof instance.getSnapshot, 'function')
  assert.equal(typeof instance.subscribe, 'function')
  assert.equal(typeof instance.clearPersisted, 'function')
  assert.equal(typeof instance.actions.sync, 'function', 'baked actions must carry sync')
  assert.equal(instance.actions.sync.length, 1, 'sync must be baked to a single snapshot argument')
  assert.doesNotThrow(() => instance.clearPersisted())
})

check('initial state mirrors the plugin defaults', () => {
  const state = instance.getSnapshot()
  // src/config.ts DEFAULT_CONFIG: { enabled: true, defaultMode: 'title' }
  assert.deepEqual(
    { enabled: state.enabled, defaultMode: state.defaultMode, revision: state.revision, writable: state.writable, unavailable: state.unavailable },
    { enabled: true, defaultMode: 'title', revision: -1, writable: false, unavailable: false },
  )
})

let notifications = 0
const unsubscribe = instance.subscribe(() => { notifications++ })
const injected = options.inject(instance.actions)

check('inject factory returns the write face and pushes the current snapshot', () => {
  assert.equal(typeof injected.setEnabled, 'function')
  assert.equal(typeof injected.setDefaultMode, 'function')
  assert.equal(notifications, 1, `expected 1 notification after the initial push, got ${notifications}`)
})

check('sync mirrors a Host snapshot', () => {
  setSnapshot({
    status: 'ready',
    value: { enabled: true, defaultMode: 'content' },
    base: undefined,
    user: undefined,
    revision: 4,
    writable: true,
    mode: 'host',
  })
  instance.actions.sync({
    status: 'ready',
    value: { enabled: true, defaultMode: 'content' },
    base: undefined, user: undefined, revision: 4, writable: true, mode: 'host',
  })
  const state = instance.getSnapshot()
  assert.equal(state.enabled, true)
  assert.equal(state.defaultMode, 'content')
  assert.equal(state.revision, 4)
  assert.equal(state.writable, true)
  assert.equal(state.unavailable, false)
})

check('stale revisions are fenced out', () => {
  const before = instance.getSnapshot()
  const notificationsBefore = notifications
  instance.actions.sync({
    status: 'ready',
    value: { enabled: false, defaultMode: 'title' },
    base: undefined, user: undefined, revision: 3, writable: true, mode: 'host',
  })
  assert.equal(instance.getSnapshot(), before, 'stale snapshot must not replace the state')
  assert.equal(notifications, notificationsBefore, 'stale snapshot must not notify')
})

check('unavailable namespaces surface as such', () => {
  instance.actions.sync({
    status: 'unavailable',
    value: undefined,
    base: undefined, user: undefined, revision: 5, writable: false, mode: 'memory',
  })
  const state = instance.getSnapshot()
  assert.equal(state.unavailable, true)
  assert.equal(state.writable, false)
})

check('unsubscribe stops delivery', () => {
  unsubscribe()
  const before = notifications
  instance.actions.sync({
    status: 'ready',
    value: { enabled: false, defaultMode: 'title' },
    base: undefined, user: undefined, revision: 6, writable: true, mode: 'host',
  })
  assert.equal(notifications, before, 'no notification after unsubscribe')
  assert.equal(instance.getSnapshot().revision, 6, 'state still updates after unsubscribe')
})

line(`\n${failures === 0 ? 'TEST PASS' : `TEST FAIL (${failures})`}`)
process.exitCode = failures === 0 ? 0 : 1
