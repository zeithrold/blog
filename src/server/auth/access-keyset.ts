import { createRemoteJWKSet } from 'jose'

export function accessKeyset(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  return createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
    timeoutDuration: 5000,
    cooldownDuration: 30000,
  })
}
