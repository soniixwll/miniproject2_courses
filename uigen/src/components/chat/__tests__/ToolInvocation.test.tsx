import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocation, getToolInvocationLabel } from "../ToolInvocation";

afterEach(() => {
  cleanup();
});

// ---------- getToolInvocationLabel (pure) ----------

test("str_replace_editor create: present tense while in progress", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "create", path: "/App.jsx" },
      "call"
    )
  ).toBe("Creating App.jsx");
});

test("str_replace_editor create: past tense when result returned", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "create", path: "/App.jsx" },
      "result"
    )
  ).toBe("Created App.jsx");
});

test("str_replace_editor str_replace maps to 'Editing'", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "str_replace", path: "/App.jsx" },
      "call"
    )
  ).toBe("Editing App.jsx");
});

test("str_replace_editor insert also maps to 'Editing'", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "insert", path: "/foo.jsx" },
      "call"
    )
  ).toBe("Editing foo.jsx");
});

test("str_replace_editor view maps to 'Reading'", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "view", path: "/App.jsx" },
      "call"
    )
  ).toBe("Reading App.jsx");
});

test("str_replace_editor undo_edit maps to 'Reverting'", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "undo_edit", path: "/App.jsx" },
      "call"
    )
  ).toBe("Reverting App.jsx");
});

test("nested paths keep the directory portion", () => {
  expect(
    getToolInvocationLabel(
      "str_replace_editor",
      { command: "create", path: "/components/Card.jsx" },
      "call"
    )
  ).toBe("Creating components/Card.jsx");
});

test("file_manager rename shows source and destination", () => {
  expect(
    getToolInvocationLabel(
      "file_manager",
      { command: "rename", path: "/old.jsx", new_path: "/new.jsx" },
      "call"
    )
  ).toBe("Renaming old.jsx to new.jsx");
});

test("file_manager rename uses past tense when complete", () => {
  expect(
    getToolInvocationLabel(
      "file_manager",
      { command: "rename", path: "/old.jsx", new_path: "/new.jsx" },
      "result"
    )
  ).toBe("Renamed old.jsx to new.jsx");
});

test("file_manager rename without new_path falls back to single-path form", () => {
  expect(
    getToolInvocationLabel(
      "file_manager",
      { command: "rename", path: "/old.jsx" },
      "call"
    )
  ).toBe("Renaming old.jsx");
});

test("file_manager delete", () => {
  expect(
    getToolInvocationLabel(
      "file_manager",
      { command: "delete", path: "/App.jsx" },
      "call"
    )
  ).toBe("Deleting App.jsx");
});

test("missing path falls back to a generic noun", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", { command: "create" }, "call")
  ).toBe("Creating file");
});

test("missing args object does not throw", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", undefined, "call")
  ).toBe("Editing file");
});

test("unknown tool name falls back to 'Running <toolName>'", () => {
  expect(
    getToolInvocationLabel("future_tool", { path: "/x" }, "call")
  ).toBe("Running future_tool");
});

test("unknown tool name uses past tense when complete", () => {
  expect(
    getToolInvocationLabel("future_tool", {}, "result")
  ).toBe("Ran future_tool");
});

// ---------- <ToolInvocation /> rendering ----------

test("renders friendly label and not the raw tool name", () => {
  render(
    <ToolInvocation
      toolInvocation={{
        toolName: "str_replace_editor",
        state: "result",
        result: "Success",
        args: { command: "create", path: "/App.jsx" },
      }}
    />
  );

  expect(screen.getByText("Created App.jsx")).toBeDefined();
  expect(screen.queryByText("str_replace_editor")).toBeNull();
});

test("shows spinner when in progress (no result)", () => {
  const { container } = render(
    <ToolInvocation
      toolInvocation={{
        toolName: "str_replace_editor",
        state: "call",
        args: { command: "create", path: "/App.jsx" },
      }}
    />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows green completion dot when state is result and result is truthy", () => {
  const { container } = render(
    <ToolInvocation
      toolInvocation={{
        toolName: "str_replace_editor",
        state: "result",
        result: "ok",
        args: { command: "str_replace", path: "/App.jsx" },
      }}
    />
  );

  expect(screen.getByText("Edited App.jsx")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("treats result state without a result value as still in progress", () => {
  // Mirrors original chip behavior: green dot only when result is truthy.
  const { container } = render(
    <ToolInvocation
      toolInvocation={{
        toolName: "str_replace_editor",
        state: "result",
        args: { command: "create", path: "/App.jsx" },
      }}
    />
  );

  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("describes file_manager rename in the chip", () => {
  render(
    <ToolInvocation
      toolInvocation={{
        toolName: "file_manager",
        state: "result",
        result: { success: true },
        args: { command: "rename", path: "/old.jsx", new_path: "/new.jsx" },
      }}
    />
  );

  expect(screen.getByText("Renamed old.jsx to new.jsx")).toBeDefined();
});

test("describes file_manager delete in the chip", () => {
  render(
    <ToolInvocation
      toolInvocation={{
        toolName: "file_manager",
        state: "call",
        args: { command: "delete", path: "/App.jsx" },
      }}
    />
  );

  expect(screen.getByText("Deleting App.jsx")).toBeDefined();
});

test("does not crash when args have not yet streamed in", () => {
  render(
    <ToolInvocation
      toolInvocation={{
        toolName: "str_replace_editor",
        state: "partial-call",
      }}
    />
  );

  expect(screen.getByText("Editing file")).toBeDefined();
});
