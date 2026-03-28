import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/assistant')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/assistant"!</div>
}
