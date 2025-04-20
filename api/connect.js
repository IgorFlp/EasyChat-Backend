import { MongoClient } from "mongodb";
import "./loadEnv.js";

const user = process.env.MONGO_USER;
const password = process.env.MONGO_PASSWORD;
const URI = `mongodb+srv://${user}:${password}@cluster0.shq1m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(URI);
export const db = client.db("EasyChat");
