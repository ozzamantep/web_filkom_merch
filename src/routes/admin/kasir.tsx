import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/kasir')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/kasir"!</div>
}
