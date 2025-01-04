import { router as R } from '@/middlewares/trpc'
import init from './init'
import whoami from './whoami'

export default R({
  whoami,
  init,
})
