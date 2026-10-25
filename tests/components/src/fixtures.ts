// Credentials are deliberately fake: the component harness never talks to the
// Worker, and every HTTP response is supplied by a Playwright route in the spec.
export const COMPONENT_TEST_FIXTURES = Object.freeze({
  csrfToken: 'component-test-csrf',
  owner: 'component-test-owner',
} as const)
