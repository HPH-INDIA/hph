import Clarity from "@microsoft/clarity";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import { store } from "@/app/store";

import App from "./App";
import "./styles/index.css";

// Initialize once at browser startup, outside React StrictMode.
Clarity.init("ypp4712tmh");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
