import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { AuthGate } from "./AuthGate.tsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      {(user, signOut) => <App user={user} onSignOut={signOut} />}
    </AuthGate>
  </React.StrictMode>,
);
