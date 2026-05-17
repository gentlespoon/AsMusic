import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { AppThemeProvider, HostProvider, App } from "@asmusic/ui";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("AsMusic: missing #root element");
}

createRoot(rootEl).render(
  // <StrictMode>
  <AppThemeProvider>
    <HostProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HostProvider>
  </AppThemeProvider>,
  // </StrictMode>
);
