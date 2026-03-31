import { createFileRoute } from '@tanstack/react-router'

const RouteComponent = () => {
  return <div>Hello "/assistant"!</div>
}

export const Route = createFileRoute('/assistant')({
  component: RouteComponent,
})