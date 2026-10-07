import "../../../text-imports.d.ts";

import { proposeActions, type ProposeActionsOptions } from "../../helpers/proposeActions";

import type { PipelinesServiceBindings } from "../../contracts";
export const createProposeActionsMethod =
  (
    serviceBindings: Pick<
      PipelinesServiceBindings,
      | "agentRuntimesDao"
      | "conversationMessagesDao"
      | "jobsDao"
      | "jobTracesDao"
      | "operationsDao"
      | "settingsDao"
      | "getCapabilityCatalog"
      | "db"
    >,
  ) =>
  (opts: ProposeActionsOptions) =>
    proposeActions(
      {
        agentRuntimesDao: serviceBindings.agentRuntimesDao,
        conversationMessagesDao: serviceBindings.conversationMessagesDao,
        jobsDao: serviceBindings.jobsDao,
        jobTracesDao: serviceBindings.jobTracesDao,
        operationsDao: serviceBindings.operationsDao,
        settingsDao: serviceBindings.settingsDao,
        capabilityCatalog: (0, serviceBindings.getCapabilityCatalog)(serviceBindings.db),
      },
      opts,
    );
