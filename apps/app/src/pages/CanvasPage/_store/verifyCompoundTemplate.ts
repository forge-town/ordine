import type { CompoundNodeData } from "@repo/schemas";
import type { PipelineEdge, PipelineNode } from "./canvasSlice";

const VERIFY_NODE_SIZE = { height: 120, width: 240 } as const;
const VERIFY_TEMPLATE_SIZE = { height: 420, width: 920 } as const;

const makeOperationData = (label: string, notes: string) =>
  ({
    label,
    nodeType: "operation",
    operationId: "",
    operationName: label,
    status: "idle",
    config: {},
    notes,
  }) as const;

const makeVerifyEdge = (
  id: string,
  source: string,
  target: string,
  label: string,
  condition?: string,
): PipelineEdge => ({
  id,
  source,
  target,
  type: "semantic",
  animated: true,
  data: {
    label,
    ...(condition ? { condition: { expression: condition } } : {}),
  },
});

export const makeVerifyCompoundTemplate = (
  compoundId: string,
  criteria: string,
): {
  childEdges: PipelineEdge[];
  childNodes: PipelineNode[];
  style: typeof VERIFY_TEMPLATE_SIZE;
} => {
  const inputId = `${compoundId}-input-port`;
  const generatorId = `${compoundId}-generator`;
  const verifierId = `${compoundId}-verifier`;
  const gateId = `${compoundId}-quality-gate`;
  const outputId = `${compoundId}-output-port`;

  const childNodes: PipelineNode[] = [
    {
      id: inputId,
      type: "prompt",
      parentId: compoundId,
      extent: "parent",
      position: { x: 40, y: 150 },
      data: {
        label: "Input Port",
        nodeType: "prompt",
        prompt: "{{input}}",
        description: "External input entering the Verify loop.",
      },
      style: VERIFY_NODE_SIZE,
    },
    {
      id: generatorId,
      type: "operation",
      parentId: compoundId,
      extent: "parent",
      position: { x: 320, y: 60 },
      data: makeOperationData("Generator", "Produce or revise the candidate answer."),
      style: VERIFY_NODE_SIZE,
    },
    {
      id: verifierId,
      type: "operation",
      parentId: compoundId,
      extent: "parent",
      position: { x: 600, y: 60 },
      data: makeOperationData("Verifier", "Check the candidate against the configured criteria."),
      style: VERIFY_NODE_SIZE,
    },
    {
      id: gateId,
      type: "operation",
      parentId: compoundId,
      extent: "parent",
      position: { x: 600, y: 250 },
      data: {
        ...makeOperationData("Quality Gate", "Route passed work to output or failed work back."),
        loopEnabled: true,
        maxLoopCount: 3,
        loopConditionPrompt: criteria,
      },
      style: VERIFY_NODE_SIZE,
    },
    {
      id: outputId,
      type: "output-project-path",
      parentId: compoundId,
      extent: "parent",
      position: { x: 320, y: 250 },
      data: {
        label: "Output Port",
        nodeType: "output-project-path",
        path: "",
        description: "Verified result and report leaving the compound.",
      },
      style: VERIFY_NODE_SIZE,
    },
  ];

  return {
    childNodes,
    childEdges: [
      makeVerifyEdge(`${compoundId}-edge-input-generator`, inputId, generatorId, "input"),
      makeVerifyEdge(`${compoundId}-edge-generator-verifier`, generatorId, verifierId, "candidate"),
      makeVerifyEdge(`${compoundId}-edge-verifier-gate`, verifierId, gateId, "feedback"),
      makeVerifyEdge(
        `${compoundId}-edge-gate-generator`,
        gateId,
        generatorId,
        "revise",
        "verdict !== 'pass'",
      ),
      makeVerifyEdge(`${compoundId}-edge-gate-output`, gateId, outputId, "verified"),
    ],
    style: VERIFY_TEMPLATE_SIZE,
  };
};

export const applyVerifyCompoundTemplate = (
  compoundNode: PipelineNode,
): { compoundNode: PipelineNode; childNodes: PipelineNode[] } => {
  const compoundData = compoundNode.data as CompoundNodeData;
  const criteria = compoundData.verifyConfig?.criteria ?? "";
  const template = makeVerifyCompoundTemplate(compoundNode.id, criteria);

  return {
    compoundNode: {
      ...compoundNode,
      style: {
        ...compoundNode.style,
        ...template.style,
      },
      data: {
        ...compoundData,
        childNodeIds: template.childNodes.map((node) => node.id),
        childEdges: template.childEdges,
      },
    },
    childNodes: template.childNodes,
  };
};
