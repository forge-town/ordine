# Jobs

Jobs track the execution of pipeline runs with real-time progress and structured output.

## Job Lifecycle

```
queued → running → done
                 → failed
                 → cancelled
                 → expired
```

## Structure

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (UUID) |
| `title` | Job title |
| `type` | Job type |
| `status` | Current status |
| `pipelineId` | Associated pipeline |
| `logs` | Array of log lines |
| `result` | Structured output (JSON) |
| `error` | Error message (if failed) |
| `startedAt` | Execution start time |
| `finishedAt` | Execution end time |

## Job Types

| Type | Description |
|------|-------------|
| `pipeline_run` | Pipeline execution |
| `code_analysis` | Standalone code analysis |
| `skill_execution` | Direct skill execution |
| `file_scan` | File scanning task |
| `custom` | Custom job type |

## Monitoring Jobs

### Via the Web UI

The Jobs page shows all recent jobs with their status, duration, and results. Click a job to see detailed traces and output.

### Via the REST API

```sh
# Get job status
curl http://localhost:9433/api/jobs/{jobId}

# Get job traces
curl http://localhost:9433/api/jobs/{jobId}/traces
```

## Traces

Each job emits traces during execution — structured log entries that record what happened at each step:

- Pipeline level start/complete
- Node processing events
- LLM content output
- Error details

Traces are stored in the database and accessible via the API and web UI.
