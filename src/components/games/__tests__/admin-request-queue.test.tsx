import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRequestQueue } from "../admin-request-queue";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AdminRequestQueue", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("approves a pending request through the protected route", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ status: "approved" }));
    const user = userEvent.setup();

    render(
      <AdminRequestQueue
        requests={[
          {
            id: "70000000-0000-0000-0000-000000000701",
            action: "join",
            amount: 1000,
            displayName: "Alex",
            createdAt: "2026-09-08T14:00:00Z",
          },
        ]}
        unitName="chips"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Approve Alex" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/game-requests/70000000-0000-0000-0000-000000000701",
      expect.objectContaining({ method: "POST" }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("renders a calm empty queue", () => {
    render(<AdminRequestQueue requests={[]} unitName="chips" />);
    expect(screen.getByText("No pending member requests.")).toBeInTheDocument();
  });
});
