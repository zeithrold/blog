import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: 'https://bea52dd656d23221cfa8e9c499daab4f@o4510256199303168.ingest.us.sentry.io/4510711790698496',

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 0.3,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending of user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
