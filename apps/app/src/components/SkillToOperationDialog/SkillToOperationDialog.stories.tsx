import type { Meta, StoryObj } from "@storybook/react";
import type {
  BaseRecord,
  CreateParams,
  CreateResponse,
  CustomParams,
  CustomResponse,
  DataProvider,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import { Refine } from "@refinedev/core";
import { SkillToOperationDialog } from "./SkillToOperationDialog";

const getSkillToOperationOne = <TData extends BaseRecord = BaseRecord>(
  params: GetOneParams,
): Promise<GetOneResponse<TData>> => {
  const { resource, id } = params;

  if (resource === "skillDraftOperations") {
    return Promise.resolve({
      data: {
        id,
        name: "Review Code",
        description: "Find correctness issues before merging.",
        sourceSkillId: id,
        config: {
          executor: { type: "agent", agentMode: "skill", skillId: id },
          inputs: [],
          outputs: [],
        },
        acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
      } as unknown as TData,
    });
  }

  if (resource === "skillAnalyses") {
    return Promise.resolve({
      data: {
        id,
        skillType: "single-step",
        steps: [
          {
            name: "Review Code",
            description: "Find correctness issues before merging.",
            suggestedOutputs: [],
          },
        ],
        rationale: "Atomic task",
      } as unknown as TData,
    });
  }

  return Promise.resolve({ data: { id } as TData });
};

const createSkillToOperationRecord = <TData extends BaseRecord = BaseRecord, TVariables = object>(
  params: CreateParams<TVariables>,
): Promise<CreateResponse<TData>> => {
  const variables = params.variables as Record<string, unknown>;
  const id = typeof variables.id === "string" ? variables.id : `${params.resource}-story-created`;

  return Promise.resolve({ data: { id, ...variables } as TData });
};

const getSkillToOperationList = <TData extends BaseRecord = BaseRecord>(
  _params: GetListParams,
): Promise<GetListResponse<TData>> => Promise.resolve({ data: [] as TData[], total: 0 });

const getSkillToOperationMany = <TData extends BaseRecord = BaseRecord>(
  _params: GetManyParams,
): Promise<GetManyResponse<TData>> => Promise.resolve({ data: [] as TData[] });

const updateSkillToOperationRecord = <TData extends BaseRecord = BaseRecord, TVariables = object>(
  _params: UpdateParams<TVariables>,
): Promise<UpdateResponse<TData>> => Promise.resolve({ data: {} as TData });

const deleteSkillToOperationRecord = <TData extends BaseRecord = BaseRecord, TVariables = object>(
  _params: DeleteOneParams<TVariables>,
): Promise<DeleteOneResponse<TData>> => Promise.resolve({ data: {} as TData });

const getSkillToOperationCustom = <TData extends BaseRecord = BaseRecord>(
  _params: CustomParams,
): Promise<CustomResponse<TData>> => Promise.resolve({ data: {} as TData });

const skillToOperationDialogDataProvider: DataProvider = {
  getList: getSkillToOperationList,
  getMany: getSkillToOperationMany,
  getOne: getSkillToOperationOne,
  create: createSkillToOperationRecord,
  update: updateSkillToOperationRecord,
  deleteOne: deleteSkillToOperationRecord,
  getApiUrl: () => "",
  custom: getSkillToOperationCustom,
};

const meta: Meta<typeof SkillToOperationDialog> = {
  title: "Components/SkillToOperationDialog",
  component: SkillToOperationDialog,
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <Refine dataProvider={skillToOperationDialogDataProvider}>
        <div className="relative min-h-[28rem] p-6">
          <Story />
        </div>
      </Refine>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SkillToOperationDialog>;

export const Default: Story = {
  args: {
    open: true,
    skillId: "skill-003",
  },
};

export const Loading: Story = {
  args: {
    open: true,
    skillId: "skill-003",
  },
  parameters: {
    mockData: {
      isLoading: true,
    },
  },
};

export const Closed: Story = {
  args: {
    open: false,
    skillId: null,
  },
};
