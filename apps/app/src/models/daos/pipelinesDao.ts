import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  pipelinesTable,
  type NewPipelineRow,
  type PipelineRow,
} from "@/models/tables/pipelines_table";
import type { PipelineNode, PipelineEdge } from "@/models/types/pipelineGraph";

export type PipelineEntity = Omit<PipelineRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
};

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** @deprecated Use PipelineEntity */
export type StoredPipeline = PipelineEntity;
/** @deprecated Use PipelineNode from @/models/types/pipelineGraph */
export type StoredNode = PipelineNode;

const rowToEntity = (row: PipelineRow): PipelineEntity => {
  return {
    ...row,
    nodeCount: row.nodes.length,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    nodes: row.nodes,
    edges: row.edges,
  };
};

export const pipelinesDao = {
  async findMany(): Promise<PipelineEntity[]> {
    const rows = await db.select().from(pipelinesTable).orderBy(desc(pipelinesTable.updatedAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<PipelineEntity | null> {
    const rows = await db.select().from(pipelinesTable).where(eq(pipelinesTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(
    data: Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">
  ): Promise<PipelineEntity> {
    const now = new Date();
    const row: NewPipelineRow = {
      ...data,
      nodes: data.nodes,
      edges: data.edges,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(pipelinesTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">
  ): Promise<PipelineEntity> {
    const now = new Date();
    const row: NewPipelineRow = {
      ...data,
      nodes: data.nodes,
      edges: data.edges,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await tx.insert(pipelinesTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async update(
    id: string,
    patch: Partial<Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">>
  ): Promise<PipelineEntity | null> {
    const updates: Partial<NewPipelineRow> = { updatedAt: new Date() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.tags !== undefined) updates.tags = patch.tags;
    if (patch.nodes !== undefined) updates.nodes = patch.nodes;
    if (patch.edges !== undefined) updates.edges = patch.edges;
    const [updated] = await db
      .update(pipelinesTable)
      .set(updates)
      .where(eq(pipelinesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<PipelineEntity, "createdAt" | "updatedAt" | "nodeCount">>
  ): Promise<PipelineEntity | null> {
    const updates: Partial<NewPipelineRow> = { updatedAt: new Date() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.tags !== undefined) updates.tags = patch.tags;
    if (patch.nodes !== undefined) updates.nodes = patch.nodes;
    if (patch.edges !== undefined) updates.edges = patch.edges;
    const [updated] = await tx
      .update(pipelinesTable)
      .set(updates)
      .where(eq(pipelinesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(pipelinesTable).where(eq(pipelinesTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(pipelinesTable).where(eq(pipelinesTable.id, id));
  },
};
