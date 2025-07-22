import { DsqlSigner } from "@aws-sdk/dsql-signer";
import postgres from "postgres";
import assert from "node:assert";
import "./loadEnv.js";

const ADMIN = "admin";
const PUBLIC = "public";
const SCHEMA = "EasyChat";

export async function getConnection() {
  
  const clusterEndpoint = process.env.CLUSTER_ENDPOINT;
  assert(clusterEndpoint);
  const user = process.env.CLUSTER_USER;
  assert(user);
  const region = process.env.CLUSTER_REGION;
  assert(region);

  let client = postgres({
    host: clusterEndpoint,
    user: user,
    password: async () => await getPasswordToken(clusterEndpoint, user, region),
    database: "postgres",
    port: 5432,
    idle_timeout: 2,
    ssl: {
      rejectUnauthorized: true,
    },
    // max: 1, // Optionally set maximum connection pool size
  });

  return client;
}

async function getPasswordToken(clusterEndpoint, user, region) {
  const signer = new DsqlSigner({
    hostname: clusterEndpoint,
    region,
  });
  if (user === ADMIN) {
    return await signer.getDbConnectAdminAuthToken();
  } else {
    signer.user = user;
    return await signer.getDbConnectAuthToken();
  }
}
