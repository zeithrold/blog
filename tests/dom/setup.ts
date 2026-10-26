/*
 * React requires this flag before any `act` scope outside a Jest-like runner.
 * Vitest supplies the jsdom document; the flag is the only DOM harness setup the
 * pilot needs, so no global test framework is enabled.
 */
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
