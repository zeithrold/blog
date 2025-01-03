import { handle } from '@/lib/helper/handler'
import * as F from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import { returnUser } from '../postprocess/api/auth-whoami'
import { prepareOpenID } from '../preprocess/api/auth-whoami'
import { getUser } from '../process/get-user'

const backend = F.flow(
  F.flow(
    prepareOpenID,
    TE.chain(getUser),
    TE.chain(returnUser),
  ),
  handle,
)

export default backend
