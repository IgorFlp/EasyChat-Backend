// server.js ou socket.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // ajuste em produção
  },
});

io.on("connection", (socket) => {
  console.log("Cliente conectado ao socket:", socket.id);
});

export { io, httpServer, app };
