import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutputItemRow } from "./OutputItemRow";

const mockOperation = {
  id: "op_plan",
  name: "Plan",
  description: "",
  config: {
    inputs: [],
    outputs: [
      {
        name: "result",
        contentType: "markdown",
        description: "输出结果",
        templateIds: [],
      },
      {
        name: "out",
        contentType: "markdown",
        description: "输出文件夹",
        templateIds: [],
      },
    ],
  },
  acceptedObjectTypes: ["file"],
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

vi.mock("@/routes/_layout/pipelines.operations.$operationId.index", () => ({
  Route: {
    useParams: () => ({ operationId: "op_plan" }),
  },
}));

vi.mock("@refinedev/core", () => ({
  useOne: () => ({ result: mockOperation, isLoading: false }),
}));

describe("OutputItemRow", () => {
  it("renders item name at index 0", () => {
    render(<OutputItemRow itemIndex={0} />);
    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.getByText("markdown")).toBeInTheDocument();
  });

  it("renders description at index 1", () => {
    render(<OutputItemRow itemIndex={1} />);
    expect(screen.getByText("输出文件夹")).toBeInTheDocument();
  });
});
