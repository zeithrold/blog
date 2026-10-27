# Shiki tokenization completeness

`@shikijs/primitive@4.5.0` ignores TextMate's `stoppedEarly` result. When a cold
JavaScript regex compilation consumes the default 500ms line budget after emitting
only a keyword, Shiki extends that partial token's color over the remaining source.
Multi-theme alignment can then make a truncated light stream look complete because
the warm dark stream provides its token boundaries.

The pinned pnpm patch checks both native tokenization paths (binary colors and
optional scope explanations). Each theme operation has one retry credit, shared
across its lines and both paths. A separately tokenized `grammarContextCode` has
its own credit; Blog does not use that option. A retry uses the original incoming grammar state
and the same finite per-line budget. A second interruption throws instead of
returning plausible but incorrect colors. Reader rendering already preserves the
literal source when highlighting fails. No theme rules, colors, grammar definitions,
CSP settings or browser assertions are changed.

The native limit is cooperative: a synchronous regex compilation cannot be preempted
mid-call. This patch does not claim a hard wall-clock bound. Remove it only after an
upstream release handles incomplete tokenization, and rerun the clock-controlled
regressions in `tests/unit/code-highlighter-budget.test.ts`, the all-grammar tests,
and real editor/preview/public-reader browser journeys. Shiki's installed MIT
license remains unchanged.

The all-grammar compatibility test uses `tokenizeTimeLimit: 0` only for its trusted,
fixed inputs, and an advancing fake clock makes this independent of machine speed.
Cold C++ regex compilation can exhaust both finite attempts on slower CI machines;
that is an allowed bounded failure, not evidence that the grammar is unsupported.
Production calls keep the default finite budget. The separate clock-controlled
budget tests continue to require bounded retries and rejection of incomplete streams.
