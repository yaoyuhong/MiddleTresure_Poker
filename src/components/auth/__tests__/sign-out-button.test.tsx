import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignOutButton } from "../sign-out-button";

describe("SignOutButton", () => {
  it("posts through the server-side sign-out route", () => {
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.closest("form")).toHaveAttribute("action", "/auth/signout");
    expect(button.closest("form")).toHaveAttribute("method", "post");
  });
});
