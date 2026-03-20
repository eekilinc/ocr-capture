import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import { TranslationProvider } from "./i18n/TranslationContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TranslationProvider>
        <App />
    </TranslationProvider>
  </React.StrictMode>,
);
