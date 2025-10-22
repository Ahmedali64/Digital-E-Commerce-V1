export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatError(error: unknown): {
  message: string;
  stack?: string;
} {
  return {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
  };
}
