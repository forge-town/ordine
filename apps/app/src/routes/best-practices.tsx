import { createFileRoute } from '@tanstack/react-router'

const RouteComponent = () => {
  return <div>Hello "/best-practices"!</div>
}

export const Route = createFileRoute('/best-practices')({
  component: RouteComponent,
})
