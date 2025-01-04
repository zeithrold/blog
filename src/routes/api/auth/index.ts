import { Hono } from 'hono'
import callback from './callback'
import github from './github'
import signOut from './sign-out'

const auth = new Hono()

auth.get('/github', github)
auth.get('/callback', callback)
auth.get('/sign-out', signOut)

export default auth
