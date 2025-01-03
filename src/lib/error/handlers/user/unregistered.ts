import type { Error } from '../..'

export default function unregistered(): Error {
  return {
    id: 'unregistered',
    description: 'User is not registered',
    status: 404,
  }
}
