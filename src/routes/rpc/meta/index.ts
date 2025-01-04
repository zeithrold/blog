import { router as R } from '@/middlewares/trpc'
import version from './version'

export default R({
  version,
})
