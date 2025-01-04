import type { AppRouter } from '@/routes/rpc'
import { createTRPCProxyClient, httpLink } from '@trpc/client'

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: '/rpc',
    }),
  ],
})

export default trpc
