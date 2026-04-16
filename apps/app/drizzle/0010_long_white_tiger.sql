ALTER TABLE "job_logs" RENAME TO "job_traces";--> statement-breakpoint
ALTER TABLE "job_traces" DROP CONSTRAINT "job_logs_job_id_jobs_id_fk";
--> statement-breakpoint
DROP INDEX "job_logs_job_id_idx";--> statement-breakpoint
DROP INDEX "job_logs_created_at_idx";--> statement-breakpoint
ALTER TABLE "job_traces" ADD CONSTRAINT "job_traces_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_traces_job_id_idx" ON "job_traces" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_traces_created_at_idx" ON "job_traces" USING btree ("created_at");