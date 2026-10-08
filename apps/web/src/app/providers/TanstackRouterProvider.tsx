import { createRouter, RouterProvider } from '@tanstack/react-router'

import { routeTree } from '../routeTree.gen'

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient: undefined!,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export const TanstackRouterProvider = () => {
  return <RouterProvider router={router} />
}
