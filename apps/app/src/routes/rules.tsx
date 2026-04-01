import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/rules')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/rules"!</div>
}
