import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => ({
    service: "agichat-mock-api",
    status: "ok",
  }))
  .listen(3000);

console.log(
  `AGIChat mock API listening at ${app.server?.hostname}:${app.server?.port}`
);
