type ApiEnvelope<T> = {
  success?: boolean;
  data?: T | null;
  error?: string | null;
};

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === "object" && value !== null && "data" in value;
}

export function unwrapApiData<T>(value: T | ApiEnvelope<T> | null | undefined): T | undefined {
  if (isApiEnvelope<T>(value)) {
    return value.data ?? undefined;
  }
  return value ?? undefined;
}
