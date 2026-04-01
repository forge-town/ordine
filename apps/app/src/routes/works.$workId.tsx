import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/works/$workId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/works/$workId"!</div>
}
