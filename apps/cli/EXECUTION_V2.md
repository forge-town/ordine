# Execution API v2

Execution commands use `ordine execution` and always print JSON. The old top-level
`run`, `pipelines`, `operations` / `ops`, and `jobs` commands are removed.
MCP exposes only the `ordine.v2.*` execution catalog. Legacy Agent Control tools
are not aliases and are not forwarded to another API.

Authentication, MCP installation/setup, and the general rules, skills,
best-practices, filesystem and runtime daemon commands remain available.
Choose one authentication mode and its token or token file. Credentials are read
on every request; there is no fallback between Desktop and bearer identities.
Every execution request includes `X-Ordine-Api-Version: 2`.

## Submit and recover

1. Run `ordine execution readiness` or `ordine mcp doctor <target>`.
2. Read `execution operations list` and `execution pipelines get <id>`.
3. Save a request JSON file with an explicit UUID `requestId` before submission:

   ```json
   {
     "apiVersion": 2,
     "requestId": "11111111-1111-4111-8111-111111111111",
     "pipelineId": "pipeline-id",
     "expectedRevision": 1,
     "inputs": {},
     "executionOverrides": {},
     "deliveryRequirements": []
   }
   ```

4. Run `ordine execution run-requests submit request.json`.
5. An `awaiting_approval` response returns immediately with an App approval
   instruction. The user approves in the ORDINE App. Neither CLI nor MCP exposes
   an approval or rejection action for an agent to authorize its own request.
6. Run `ordine execution run-requests get <requestId>` until the user has approved
   and an accepted receipt supplies a `jobId`.
7. Query `execution jobs get <jobId>`, `jobs events <jobId> --after-sequence 0`,
   `jobs result <jobId>` and `jobs artifacts <jobId>` under `ordine execution`.

A timeout is an uncertain submission outcome. Query the original requestId.
There is no automatic resubmission, replacement requestId, polling loop or restart.
A 404 receipt also does not authorize making a replacement requestId.
Job creation or a terminal state alone does not prove delivered content.
Check typed outputs, artifact metadata, provenance, warnings and complete-file
SHA-256 before reporting delivery.

## Definitions and files

- `execution operations save operation.json` accepts
  `{apiVersion:2,expectedRevision,operation:OperationRevision}`.
- `execution pipelines save pipeline.json` accepts `SavePipelineDefinition` with
  `pipelineId`, `expectedRevision` and `definition`. Zero expectedRevision creates
  a new definition; existing definitions require their current revision.
- `execution input-assets import <explicit-file-path> --import-request-id <uuid>
--mime-type <type>` imports up to 8 MiB. Reuse the immutable returned artifactId
  in typed inputs. No paths are inferred from script output.
- `execution artifacts get <id>` returns public metadata.
- `execution artifacts content <id> <outFile> --offset 0 --length 65536` writes
  exactly that returned byte range. A range is at most 1 MiB; read all ranges and
  assemble them before comparing the metadata SHA-256. MCP returns base64 bytes.
- `execution jobs control <jobId> <pause|resume|cancel>` controls an existing job.
- `execution jobs checkpoint-ack <jobId> <nodeId>` acknowledges an execution
  checkpoint. This is distinct from user approval of a submitted run request.

JSON input files are limited to 12 MiB. Inputs and responses are validated with
the shared execution v2 schemas. Successful HTTP responses are direct DTOs;
legacy `{data: ...}` wrappers are rejected. Doctor validates v2 database readiness
and performs a real `ordine.v2.jobs.list` call through MCP.
