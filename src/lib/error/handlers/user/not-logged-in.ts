import type { Error } from '../..'

export default function notLoggedIn(): Error {
  return {
    id: 'not_logged_in',
    description: 'User is not logged in',
    status: 401,
  }
}
