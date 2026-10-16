import app from "./server";
import { mcpResourceUrl, port } from "./config";

if (process.env.NODE_ENV !== "test") {
  app.listen(port(), () => {
    console.log(`fitaily-mcp on :${port()} resource=${mcpResourceUrl()}`);
  });
}

export default app;
