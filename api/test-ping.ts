import { json } from "./lib/responses.js";

// Temporary diagnostic endpoint -- verifying whether pushing to main
// actually triggers Vercel's Git-integration auto-deploy again. Delete
// once confirmed either way (see CLAUDE.md/chat history for context).
export function GET(): Response {
  return json({ msg: "pong" });
}
