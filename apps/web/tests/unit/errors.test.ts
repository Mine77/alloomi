import { describe, it, expect, vi } from "vitest";
import { AppError, getMessageByErrorCode } from "@alloomi/shared/errors";

describe("errors", () => {
  it("builds message with cause for api bad request", () => {
    const error = new AppError("bad_request:api", "invalid input");
    expect(error.message).toContain("invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.surface).toBe("api");
  });

  it("maps database errors to generic message in response", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new AppError("bad_request:database");

    const response = error.toResponse();
    const payload = await response.json();

    expect(payload).toEqual({
      code: "",
      message: "Something went wrong. Please try again later.",
    });
    expect(response.status).toBe(400);
    expect(spy).toHaveBeenCalledWith({
      code: "bad_request:database",
      message: "An error occurred while executing a database query.",
      cause: undefined,
    });
    spy.mockRestore();
  });

  it("returns response payload with code for visible surfaces", async () => {
    const error = new AppError("not_found:chat");
    const response = error.toResponse();
    const payload = await response.json();

    expect(payload.code).toBe("not_found:chat");
    expect(payload.message).toContain("chat was not found");
    expect(response.status).toBe(404);
  });

  it("falls back to default message when no mapping found", () => {
    expect(getMessageByErrorCode("bad_request:feedback", "oops")).toBe("oops");
  });
});
