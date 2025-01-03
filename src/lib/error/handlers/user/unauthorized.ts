import type { Error } from '../..'

export default function unauthorized(): Error {
  return {
    id: 'unauthorized',
    description: 'User is not authorized to perform this action',
    status: 403,
  }
}
