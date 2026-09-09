# Pipeline v2 user guide

This version keeps the original navigation, Canvas, Operation pages and AgentBar. Execution uses v2 requests, approvals, Jobs and managed artifacts.

## Setup

Windows Native requires a dedicated PostgreSQL target. Follow the [Desktop setup and build instructions](../../apps/desktop-app/README.md). Initialize only an empty target; existing legacy data is not automatically migrated. The application creates its credentials and owns its backend. Configure and authenticate the intended local Agent CLI before running Agent operations.

Standalone Web retains the existing login session and uses an owner-restricted server-side execution proxy. Its deployment must configure the execution target and credential files; users should not paste application credentials into the page. Standalone Web has not yet passed the latest human-use reacceptance.

## Create and run

1. Describe the goal, input and desired file on the homepage.
2. Review the Agent plan, then confirm it in the new Canvas conversation.
3. Review the proposed Canvas changes and click **Apply and save**. Finishing the Agent turn does not itself save the proposal.
4. Ask the Agent to prepare the saved workflow. Review fixed revisions and inputs in the run confirmation card, then approve.
5. Wait for execution completion. Download the published file and check its content; a prepared request or completed Agent conversation is not file delivery.
6. To reuse the workflow, provide new input and request another run. Each run has a separate request and Job.

Use **New conversation** for an independent task. Historical results remain in their own conversation. Failed preparation should show the actual error; correct it before retrying. Pause, resume and cancel operate on the v2 Job rather than submitting a replacement Job.

For manual operations, define stable port IDs, value types and cardinality. JavaScript executes as Node ESM and receives typed input values on stdin. Managed output nodes publish downloadable artifacts; unsupported legacy output and implicit port mappings are rejected.
