// server.js ou socket.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import "./loadEnv.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,    
  },
});

io.on("connection", (socket) => {
  console.log("Cliente conectado ao socket:", socket.id);
});

export { io, httpServer, app };
