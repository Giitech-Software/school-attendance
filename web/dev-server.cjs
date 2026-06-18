const path = require("node:path");
const process = require("node:process");

async function main() {
  const root = __dirname;
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;

  const server = await createServer({
    root,
    configFile: false,
    cacheDir: path.join(root, ".vite-cache"),
    plugins: [react()],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
    },
    clearScreen: false,
  });

  await server.listen();
  server.printUrls();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive even when launched without an interactive stdin.
  setInterval(() => {}, 60 * 60 * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
