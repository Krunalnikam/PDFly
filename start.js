// Cloud Run and container entry point
// Ensures the server binds to 0.0.0.0 and listens on the assigned Cloud Run PORT
process.env.HOST = process.env.HOST || "0.0.0.0";

await import("./dist/server/index.mjs");
