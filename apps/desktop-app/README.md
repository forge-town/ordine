# Ordine Desktop execution v2

The native application owns its server, credentials, and process tree. Reloading the
WebView only reconnects to the same native session. A crashed server is shown as an
error and requires an explicit retry.

## Development

From the workspace root, install dependencies once and run:

```powershell
bun run --cwd apps/desktop-app tauri:dev
```

The script builds the Bun/server and MCP sidecars before Tauri starts. Configure a
dedicated PostgreSQL database through the startup screen, or provide
`ORDINE_EXECUTION_DATABASE_URL` explicitly in the launching process. There is no
fallback to a shared database. `ORDINE_EXECUTION_SCHEMA` defaults to `public`.
Set `ORDINE_EXECUTION_INITIALIZE=true` only when intentionally initializing an empty
target. Existing execution v2 schemas are checked against the migration checksum;
legacy schemas are refused without adoption or deletion.

Configuration entered in the screen applies to the current native session. It is
saved only when the user enables the save option. Default v2 files live under
`~/.ordine/v2`; the old `~/.ordine/data` is not used.

Desktop uses port **19433** and rejects a conflicting listener. If independent
test instances need different ports, give each one a separate
`ORDINE_EXECUTION_DATA_DIR` as well. The MCP configuration available on the Settings page
points to the packaged MCP executable, the actual fixed API port, and the v2
Agent token file. Application credentials are owned by the native session and
supplied to its WebView for requests without being written to disk.

## Windows package

```powershell
bun run --cwd apps/desktop-app tauri:build --bundles nsis
```

The wrapper uses the installed Rust target for both Cargo and sidecar names,
including GNU installations. It discovers the standard user Rust tool directory
if it is missing from the current PATH. Other native desktop targets continue to
use Tauri's platform bundle types.

MinGW cannot reliably link files whose build-output path contains non-ASCII
characters. On such a checkout, set `CARGO_TARGET_DIR` to an ASCII-only directory
for this command. The build script also stages the icon under that output directory.
The bundle includes the frozen v2 SQL migration, the 13 authoring metadata SQL migrations
in `migrations-authoring`, and native PowerShell launchers next to the server bundle.
The original navigation uses the authoring API as the default Refine provider and the
named `execution` provider for v2 requests on the same native-owned API origin.

## Native verification

```powershell
cargo test --manifest-path apps/desktop-app/src-tauri/Cargo.toml --release --target x86_64-pc-windows-gnu --test native_lifecycle
```

The Windows integration test uses a real parent and descendant process and checks
their kernel process handles after closing the owned Job Object. The other tests
cover bounded structured output, independent credentials, and legacy data-path
refusal. Native GUI acceptance should additionally verify authenticated startup,
reload, visible failure and retry, and normal window close while a job is running.

Window close sends the authenticated shutdown request and stdin STOP, allows up to
35 seconds for convergence, then closes the process job. The server and all Windows
descendants are contained before stdin START authorizes server initialization.
