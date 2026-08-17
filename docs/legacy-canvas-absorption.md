# Legacy Canvas absorption checklist

Baseline: `forge-town/ordine` `develop` at `5771dce1b4ab0e60af6af2bd5da3a67f905c86cf`.

The current `/canvas` route loads `@repo/views/CanvasPage`. The old
`apps/app/src/pages/WorkspacePage/canvas` tree has no production inbound
reference; it is retained only by its own Storybook stories and tests.

This checklist records why deleting that unreachable tree does not remove a
reachable product path. It is not a claim that every historical prototype
interaction has identical implementation details in the shared Canvas.

| Legacy surface                                                               | Current shared surface                                                                                               | Decision                                | Evidence                                                                                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CanvasRoot` and React Flow shell                                            | `CanvasPage` → `CanvasPageContent` → `CanvasInner`                                                                   | Current implementation                  | `apps/app/src/routes/canvas.tsx` imports `@repo/views/CanvasPage`; no route imports `WorkspacePage`.                                       |
| `CanvasFlow` and node rendering                                              | `CanvasFlow`, `NodeCard`, `OperationNode`, `PromptNode`, `FileNode`, `FolderNode`, `GitHubProjectNode`, output nodes | Equivalent implementation               | Shared Canvas has the corresponding node and flow modules plus current stories/tests.                                                      |
| `ComponentPanel`, drag payloads, node creation                               | `CanvasComponentPanel`, `CanvasNodeCreationPalette`, shared drag-payload utilities                                   | Equivalent implementation               | Current `CanvasInner` composes these surfaces directly.                                                                                    |
| `CanvasToolbar`, `TopPill`, `StateLegend`, `VersionMenu`                     | `CanvasToolbar`, `CanvasTopChrome`, `CanvasStatusBar`, `CanvasSettingsDrawer`                                        | Adapted shared implementation           | The shared Canvas owns toolbar, top chrome, status, settings, and persistence.                                                             |
| `EdgeInspector`, `NodeConfig`, mapping/quality sections                      | `CanvasNodePropertiesPanel`, `ConnectionMenu`, `NodeContextMenu`                                                     | Adapted shared implementation           | The shared Canvas renders the current node/edge editing surfaces from `CanvasInner`.                                                       |
| `CanvasEmptyState`                                                           | `CanvasEmptyState`                                                                                                   | Direct equivalent                       | Shared Canvas renders the empty state when `nodes.length === 0`.                                                                           |
| `RunConsole` and run trace UI                                                | `RunConsole`, `RunStatusCard`, Agent activity surfaces                                                               | Adapted shared implementation           | Shared Canvas renders `RunConsole`; Agent activity is owned by the shared AgentPanel.                                                      |
| `AskComposer`, `ComposeBar`, `DrillHint`                                     | `AgentPanel`, `Composer`, `CanvasFloatingMenu`, current context actions                                              | Adapted/shared interaction              | The current route exposes AgentPanel and Composer from `packages/views`; old components have no production entry.                          |
| Old canvas store slices (`graph`, `selection`, `proposal`, `run`, `history`) | `CanvasPageStore` (`canvas`, `ui`, `history`, `actions`)                                                             | Replaced state model                    | The shared store is the only production Canvas store; do not restore the old store.                                                        |
| Old `RunPoller` / checkpoint implementation                                  | Shared RunConsole and Agent activity lifecycle                                                                       | Not a deletion blocker                  | No production route loads the old poller; any missing desired behavior must be filed separately rather than preserved as unreachable code. |
| Legacy Storybook/Test-only fixtures                                          | Current shared Canvas stories/tests                                                                                  | Delete old fixtures with implementation | Old fixtures are coupled to the unreachable tree and are not runtime entry points.                                                         |

## Deletion boundary

- Delete the old Workspace Canvas implementation and its coupled stories/tests;
  do not move them to `archived/`.
- Delete only duplicate or unused frontend files confirmed by repository-wide
  reference search and Knip after the legacy tree is removed.
- Keep Storybook mocks, the Desktop server entry, and the MCP fake server; they
  are real tool/build/test entry points and should be configured in Knip.
- Keep public exports from shared packages unless a separate API-removal issue
  explicitly approves them.

## Verification commands

```bash
rg -n 'WorkspacePage|pages/WorkspacePage|CanvasRoot' apps packages
bun run knip
bun run check-types
bun run lint
bun run test
bun run build
```
