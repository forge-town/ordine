import {
  createAgentThreadsDao,
  createPipelineAgentMessagesDao,
  type DbConnection,
} from "@repo/models";

import type { AgentThreadsServiceBindings } from "../../contracts";

import { createAgentThreadsGetAllMethod } from "../../methods/agentThreadsGetAll";
import { createAgentThreadsGetByIdMethod } from "../../methods/agentThreadsGetById";
import { createAgentThreadsCreateMethod } from "../../methods/agentThreadsCreate";
import { createAgentThreadsUpdateContextMethod } from "../../methods/agentThreadsUpdateContext";
import { createAgentThreadsRenameMethod } from "../../methods/agentThreadsRename";
import { createAgentThreadsArchiveMethod } from "../../methods/agentThreadsArchive";
import { createAgentThreadsGetMessagesMethod } from "../../methods/agentThreadsGetMessages";
import { createAgentThreadsAddMessageMethod } from "../../methods/agentThreadsAddMessage";

export const createAgentThreadsService = (db: DbConnection) => {
  const serviceBindings: AgentThreadsServiceBindings = {
    get db() {
      return db;
    },
    get threadsDao() {
      return threadsDao;
    },
    get messagesDao() {
      return messagesDao;
    },
  };

  const threadsDao = createAgentThreadsDao(db);
  const messagesDao = createPipelineAgentMessagesDao(db);

  return {
    getAll: createAgentThreadsGetAllMethod(serviceBindings),

    getById: createAgentThreadsGetByIdMethod(serviceBindings),

    create: createAgentThreadsCreateMethod(serviceBindings),

    updateContext: createAgentThreadsUpdateContextMethod(serviceBindings),

    rename: createAgentThreadsRenameMethod(serviceBindings),

    archive: createAgentThreadsArchiveMethod(serviceBindings),

    getMessages: createAgentThreadsGetMessagesMethod(serviceBindings),

    addMessage: createAgentThreadsAddMessageMethod(serviceBindings),
  };
};
