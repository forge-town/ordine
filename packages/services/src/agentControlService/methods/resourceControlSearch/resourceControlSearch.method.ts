import type { AgentResourceType } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";

import type { ResourceControlError, ResourceControlValue } from "../../helpers/resourceControl";
import { parseOffset } from "../../helpers/resourceControlParseOffset";
import { resourceRef } from "../../helpers/resourceControlResourceRef";
import { compactResource } from "../../helpers/resourceControlCompactResource";
import { matchesQuery } from "../../helpers/resourceControlMatchesQuery";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlSearchMethod = (
  serviceBindings: Pick<ResourceControlBindings, "daos" | "list">,
) =>
  ({
    async search({
      query,
      resourceTypes,
      cursor,
      limit,
    }: {
      query: string;
      resourceTypes?: AgentResourceType[];
      cursor?: string;
      limit: number;
    }): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const offset = parseOffset(cursor);
      if (offset.isErr()) return err(offset.error);
      const types = resourceTypes ?? (Object.keys(serviceBindings.daos) as AgentResourceType[]);
      const groups = await Promise.all(
        types.map(async (type) =>
          (await (0, serviceBindings.list)(type))
            .map((entry) => compactResource(type, entry))
            .filter((entry) => matchesQuery(entry, query))
            .map((entry) => ({ type, entry })),
        ),
      );
      const all = groups.flat();
      const page = all.slice(offset.value, offset.value + limit);
      const nextOffset = offset.value + page.length;

      return ok({
        resources: page.map(({ type, entry }) => resourceRef(type, entry)),
        summary: `Found ${all.length} matching ORDINE resources; returned ${page.length}.`,
        data: {
          items: page.map(({ type, entry }) => ({ type, ...entry })),
          nextCursor: nextOffset < all.length ? String(nextOffset) : null,
          total: all.length,
        },
      });
    },
  }).search;
