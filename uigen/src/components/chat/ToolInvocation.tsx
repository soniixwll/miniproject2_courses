"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocationData {
  toolName: string;
  state: string;
  result?: unknown;
  args?: any;
}

interface ToolInvocationProps {
  toolInvocation: ToolInvocationData;
}

function basename(path?: string): string {
  if (!path) return "";
  return path.replace(/^\/+/, "");
}

export function getToolInvocationLabel(
  toolName: string,
  args: any,
  state: string
): string {
  const done = state === "result";
  const verb = (present: string, past: string) => (done ? past : present);
  const path = basename(args?.path);
  const newPath = basename(args?.new_path);

  if (toolName === "str_replace_editor") {
    switch (args?.command) {
      case "create":
        return `${verb("Creating", "Created")} ${path || "file"}`;
      case "view":
        return `${verb("Reading", "Read")} ${path || "file"}`;
      case "undo_edit":
        return `${verb("Reverting", "Reverted")} ${path || "edit"}`;
      default:
        return `${verb("Editing", "Edited")} ${path || "file"}`;
    }
  }

  if (toolName === "file_manager") {
    switch (args?.command) {
      case "rename":
        if (path && newPath) {
          return `${verb("Renaming", "Renamed")} ${path} to ${newPath}`;
        }
        return `${verb("Renaming", "Renamed")} ${path || "file"}`;
      case "delete":
        return `${verb("Deleting", "Deleted")} ${path || "file"}`;
      default:
        return `${verb("Updating", "Updated")} ${path || "files"}`;
    }
  }

  return `${verb("Running", "Ran")} ${toolName}`;
}

export function ToolInvocation({ toolInvocation }: ToolInvocationProps) {
  const isComplete =
    toolInvocation.state === "result" && Boolean(toolInvocation.result);
  const label = getToolInvocationLabel(
    toolInvocation.toolName,
    toolInvocation.args,
    toolInvocation.state
  );

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isComplete ? (
        <div
          aria-label="Completed"
          className="w-2 h-2 rounded-full bg-emerald-500"
        />
      ) : (
        <Loader2
          aria-label="In progress"
          className="w-3 h-3 animate-spin text-blue-600"
        />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
