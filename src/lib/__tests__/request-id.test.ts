import { describe, expect, it } from "vitest";

import { getRequestId } from "../request-id";

describe("getRequestId", () => {
  it("preserves a valid incoming request ID", () => {
    expect(
      getRequestId(
        new Headers({
          "x-request-id": "123e4567-e89b-42d3-a456-426614174000",
        }),
      ),
    ).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("replaces malformed values", () => {
    const requestId = getRequestId(
      new Headers({ "x-request-id": "private data that must not be logged" }),
    );

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
