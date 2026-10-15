// Run in <head> before the router captures the native History methods. Keep this
// literal self-contained: server bundling must not introduce script dependencies.
export const historyBootstrap = String.raw`
(() => {
  const key = '__blogHistory';
  const installed = Symbol.for(key);
  if (window[installed]) return;
  window[installed] = true;
  const session = crypto.randomUUID();
  const history = window.history;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  const nativeIndex = () => {
    const value = window.navigation?.currentEntry?.index;
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const position = () => {
    const value = history.state?.[key];
    return value?.session === session && Number.isSafeInteger(value.index) ? value.index : null;
  };
  const stamp = (data, index) => ({
    ...(data !== null && typeof data === 'object' ? data : {}),
    [key]: { session, index },
  });
  let index = nativeIndex() ?? 0;
  replace(stamp(history.state, index), '');
  history.pushState = function(data, unused, url) {
    const next = (position() ?? index) + 1;
    push(stamp(data, next), unused, url);
    index = next;
    window.dispatchEvent(new Event('blog:history-write'));
  };
  history.replaceState = function(data, unused, url) {
    const current = position() ?? index;
    replace(stamp(data, current), unused, url);
    index = current;
    window.dispatchEvent(new Event('blog:history-write'));
  };
  window.addEventListener('popstate', (event) => {
    index = position() ?? index;
    if (!window.dispatchEvent(new Event('blog:history-pop', { cancelable: true }))) {
      event.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('hashchange', () => {
    const physical = nativeIndex();
    if (position() === null || (physical !== null && physical !== position())) {
      index = physical ?? index + 1;
      replace(stamp(history.state, index), '');
      window.dispatchEvent(new Event('blog:history-write'));
    }
  });
})();`
