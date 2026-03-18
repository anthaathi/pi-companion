export type BlockingExtensionUiMethod =
  | "select"
  | "confirm"
  | "input"
  | "editor";

interface PendingExtensionUiRequestBase {
  id: string;
  method: BlockingExtensionUiMethod;
  title?: string;
  message?: string;
  timeout?: number;
}

export interface PendingExtensionUiSelectRequest
  extends PendingExtensionUiRequestBase {
  method: "select";
  options: string[];
}

export interface PendingExtensionUiConfirmRequest
  extends PendingExtensionUiRequestBase {
  method: "confirm";
}

export interface PendingExtensionUiInputRequest
  extends PendingExtensionUiRequestBase {
  method: "input";
  placeholder?: string;
  value?: string;
}

export interface PendingExtensionUiEditorRequest
  extends PendingExtensionUiRequestBase {
  method: "editor";
  prefill?: string;
}

export type PendingExtensionUiRequest =
  | PendingExtensionUiSelectRequest
  | PendingExtensionUiConfirmRequest
  | PendingExtensionUiInputRequest
  | PendingExtensionUiEditorRequest;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parsePendingExtensionUiRequest(
  value: unknown,
): PendingExtensionUiRequest | null {
  if (!isRecord(value)) return null;

  const id = optionalString(value.id);
  const method = optionalString(value.method);
  if (!id || !method) return null;

  const base = {
    id,
    title: optionalString(value.title),
    message: optionalString(value.message),
    timeout: optionalNumber(value.timeout),
  };

  switch (method) {
    case "select":
      return {
        ...base,
        method,
        options: stringArray(value.options),
      };

    case "confirm":
      return {
        ...base,
        method,
      };

    case "input":
      return {
        ...base,
        method,
        placeholder: optionalString(value.placeholder),
        value: optionalString(value.value),
      };

    case "editor":
      return {
        ...base,
        method,
        prefill: optionalString(value.prefill),
      };

    default:
      return null;
  }
}
