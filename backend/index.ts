import express from "express";
import app from "./src/app.js";

// Vercel's Express preset discovers this root-level entrypoint.
void express;

export default app;
