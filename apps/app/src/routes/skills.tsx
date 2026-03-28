import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/skills')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/skills"!</div>
}
