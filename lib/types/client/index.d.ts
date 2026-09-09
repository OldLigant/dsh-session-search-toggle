import type { Context } from 'cordis';
import type { StoreHandle, StoreInstance } from '@deepseek-ai/dsh-client-ui-slots';
import { type SwitchSearchConfig } from '../config.ts';
/** ------------------------------------------------------------------ types */
/** The client slots service face (structural subset used here). */
interface SwitchSlotsService {
    inject(key: string, callback: () => () => void, label?: string): () => void;
    register(options: {
        name: string;
        id?: string;
        key?: string;
        order?: number;
        store?: unknown;
        locale?: string;
        inject?: (actions: unknown) => unknown;
    }, component: unknown): () => void;
}
/** The client sessions service face: open a session from a search result. */
interface SwitchSessionsService {
    open(id: string): void;
}
/**
 * Two-release mirror of the Host settings snapshot.
 *
 * Anchors — 0.1.1-rc.2 exports `SettingsScopeSnapshot<T>` from
 * `@deepseek-ai/dsh-client-runtime/client`; 0.1.2-rc.1 moved the export to
 * `@deepseek-ai/dsh-client-store`. Both declare the same seven fields, so the
 * shape is mirrored structurally here instead of imported: a value or type
 * import of either package pins this client half to one release.
 */
interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
/** The client settings-scope service face (structural subset). */
interface SwitchSettingsScope<T> {
    bind<T>(spec: {
        namespace: string;
    }): SwitchScopeLike<T>;
}
interface SwitchScopeLike<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
}
/** Local mirror of the settings namespace the General row edits. */
export interface SwitchSearchSettingsState {
    enabled: boolean;
    defaultMode: SwitchSearchConfig['defaultMode'];
    /** Namespace revision fencing the sync (skips stale snapshots). */
    revision: number;
    /** Whether the Host document accepts writes. */
    writable: boolean;
    /** Namespace not exposed to this client (row renders the unavailable note). */
    unavailable: boolean;
}
/** Write face the settings row receives from the inject factory. */
export interface SwitchSearchSettingsInjected {
    setEnabled: (value: boolean) => void;
    setDefaultMode: (value: SwitchSearchConfig['defaultMode']) => void;
}
/**
 * The settings store — a local implementation of the slot store seat.
 *
 * The seat contract (`StoreHandle`/`StoreInstance`) is owned by
 * `@deepseek-ai/dsh-client-ui-slots`, a module both releases share, and only
 * asks for `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`.
 * The runtime's `defineStore` engine, by contrast, lives in a package that was
 * renamed across releases (`@deepseek-ai/dsh-client-runtime/client` in
 * 0.1.1-rc.2 → `@deepseek-ai/dsh-client-store` in 0.1.2-rc.1), so importing it
 * would pin this client half to one release. This mirror is a plain mutable
 * snapshot, so the engine buys nothing here.
 */
/** The store's write set in declaration form (immer-draft mutators). */
export type SwitchSearchActionsDecl = {
    sync: (draft: SwitchSearchSettingsState, snap: SettingsScopeSnapshot<SwitchSearchConfig>) => void;
};
/** The live instance the renderer binds `useStore` to. */
export type SwitchSearchStoreInstance = StoreInstance<SwitchSearchSettingsState, SwitchSearchActionsDecl>;
/** The registration handle (shared identity across the plugin's registrations). */
export type SwitchSearchStore = StoreHandle<SwitchSearchSettingsState, SwitchSearchActionsDecl>;
/** Baked store actions handed to the inject factory (the `sync` write set;
 *  the draft parameter is bound by the framework, so consumers pass only snap). */
export type SwitchSearchActions = SwitchSearchStoreInstance['actions'];
/** The settings store handle registered on the General settings row. */
export declare const switchSearchStore: SwitchSearchStore;
declare module 'cordis' {
    interface Context {
        slots: SwitchSlotsService;
        sessions?: SwitchSessionsService;
        settingsScope?: SwitchSettingsScope<SwitchSearchConfig>;
    }
}
/** ------------------------------------------------------------------ plugin */
/** Services required before mounting: the slot registry, sessions, and settings scope. */
export declare const inject: string[];
/**
 * Client plugin body: inject the stylesheet and register the footer entry
 * plus the General settings row.
 * @param ctx - client plugin context (slots, sessions, settingsScope).
 */
export declare function apply(ctx: Context): void;
export {};
//# sourceMappingURL=index.d.ts.map