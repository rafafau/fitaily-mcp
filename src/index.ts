import app from "./server";
import { SERVER_VERSION, mcpResourceUrl, port } from "./config";

if (process.env.NODE_ENV !== "test") {
  if (!process.env.JWT_SECRET) {
    console.warn("JWT_SECRET is not set — every /mcp request will fail with 500.");
  }
  app.listen(port(), () => {
    console.log(`fitaily-mcp ${SERVER_VERSION} on :${port()} resource=${mcpResourceUrl()}`);
  });
}

export default app;
