import { ZodError } from "zod";

export function jsonError(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

export function validationError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  return jsonError("Validation failed", 400);
}
