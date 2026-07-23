import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";
import React from "react";

const router = getRouter();

hydrateRoot(document.getElementById("root")!, React.createElement(StartClient, { router }));
