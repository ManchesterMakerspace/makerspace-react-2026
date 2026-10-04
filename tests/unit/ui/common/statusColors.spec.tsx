import * as React from "react";
const { act } = React;
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import Box from "@mui/material/Box";
import { theme } from "app/theme";
import BaseStyles from "app/BaseStyles";
import { softTone, ROLE_BADGE_COLORS } from "ui/common/statusColors";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("status colors", () => {
  it("derives every tone from the theme", () => {
    expect(softTone("success")(theme).color).toBe(theme.palette.success.dark);
    expect(softTone("error")(theme).backgroundColor).toContain("rgba(");
    expect(ROLE_BADGE_COLORS.admin(theme)).toBe(theme.palette.error.main);
  });

  it("styles unclassed links and the body from the theme", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        <ThemeProvider theme={theme}>
          <BaseStyles />
          <Box><a href="/x">plain</a></Box>
        </ThemeProvider>
      );
    });
    const link = container.querySelector("a")!;
    expect(window.getComputedStyle(link).color).toBe("rgb(25, 118, 210)");
    expect(window.getComputedStyle(document.body).fontFamily).toContain("Roboto");
  });
});
