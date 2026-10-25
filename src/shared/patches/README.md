# Vinext speculative prefetch batches

Vinext 1.0.1 limits low-priority prefetch fetches to four at a time. Its failure
callback frees a slot and immediately dispatches the next queued fetch. During a
document departure WebKit can cancel those first four requests before emitting
`pagehide`, then report the newly started fetches as JavaScript access-control
errors. Existing Promise rejection handlers do not prevent those browser errors.

The pinned patch rejects only the low-priority work still queued when a
speculative fetch fails. It preserves the original failure cause, leaves active
requests and promoted/high-priority navigation independent, and permits future
batches. The same rule applies if headers arrived but caching the response body
fails: release carries the failure cause before another queued fetch can start.
The prefetch cache's existing failure handling discards unsuccessful
entries; actual user navigation still fetches normally. No URL/message matching,
page-error suppression, response replay, CSP change or navigation retry is added.

Remove this patch after an upstream release handles failed speculative batches
without dispatching more work into a departing document. Recheck the native queue
regressions in `tests/unit/prefetch-queue.test.ts` and real WebKit page departures;
a mock that sends `pagehide` before transport rejection cannot establish this
ordering. The installed Vinext MIT license remains unchanged.
