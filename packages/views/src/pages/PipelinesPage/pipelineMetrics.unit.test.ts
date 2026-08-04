import { describe, expect, it } from "vitest";
import type { Job, PipelineAsset, PipelineData, Routine } from "@repo/schemas";
import { buildPipelineMetrics, filterPipelines } from "./pipelineMetrics";

describe("buildPipelineMetrics", () => {
  it("aggregates only top-level pipeline runs and enabled routines", () => {
    const base = {
      title: "run",
      type: "pipeline_run" as const,
      parentJobId: null,
      projectId: null,
      totalTokens: null,
      nodeStatuses: null,
      triggeredBy: "manual" as const,
      error: null,
    };
    const jobs = [
      {
        ...base,
        id: "done",
        pipelineId: "pipeline-1",
        status: "done" as const,
        startedAt: new Date(0),
        finishedAt: new Date(1000),
      },
      {
        ...base,
        id: "failed",
        pipelineId: "pipeline-1",
        status: "failed" as const,
        startedAt: new Date(0),
        finishedAt: new Date(3000),
      },
      {
        ...base,
        id: "running",
        pipelineId: "pipeline-1",
        status: "running" as const,
        startedAt: new Date(0),
        finishedAt: null,
      },
      {
        ...base,
        id: "child",
        pipelineId: "pipeline-1",
        parentJobId: "done",
        status: "done" as const,
        startedAt: new Date(0),
        finishedAt: new Date(20_000),
      },
    ] satisfies Job[];

    const result = buildPipelineMetrics(
      ["pipeline-1"],
      jobs,
      [{ pipelineId: "pipeline-1" } as PipelineAsset],
      [
        { pipelineId: "pipeline-1", enabled: false } as Routine,
        { pipelineId: "pipeline-1", enabled: true } as Routine,
      ],
    ).get("pipeline-1");

    expect(result).toEqual({
      totalRuns: 3,
      successRate: 0.5,
      avgDurationMs: 2000,
      isSavedSkill: true,
      isScheduled: true,
    });
  });

  it("uses null for metrics without terminal or completed runs", () => {
    expect(buildPipelineMetrics(["pipeline-1"], [], [], []).get("pipeline-1")).toEqual({
      totalRuns: 0,
      successRate: null,
      avgDurationMs: null,
      isSavedSkill: false,
      isScheduled: false,
    });
  });

  it("combines project, text, tag, and category filters", () => {
    const assignedPipeline = {
      id: "pipeline-1",
      name: "Release",
      description: "Publish artifacts",
      tags: ["shipping"],
      projectId: "project-1",
      status: "draft",
    } as PipelineData;
    const unassignedPipeline = {
      ...assignedPipeline,
      id: "pipeline-2",
      name: "Legacy release",
      projectId: null,
    } as PipelineData;
    const pipelines = [assignedPipeline, unassignedPipeline];
    const metricsByPipeline = buildPipelineMetrics(
      pipelines.map((pipeline) => pipeline.id),
      [],
      [],
      [],
    );

    expect(
      filterPipelines({
        pipelines,
        metricsByPipeline,
        search: "publish",
        selectedTags: ["shipping"],
        currentProjectId: "project-1",
        activeFilter: "drafts",
      }),
    ).toEqual([assignedPipeline]);
    expect(
      filterPipelines({
        pipelines,
        metricsByPipeline,
        search: "",
        selectedTags: [],
        currentProjectId: "project-2",
        activeFilter: "all",
      }),
    ).toEqual([]);
    expect(
      filterPipelines({
        pipelines,
        metricsByPipeline,
        search: "",
        selectedTags: [],
        currentProjectId: null,
        activeFilter: "all",
      }),
    ).toEqual(pipelines);
  });
});
