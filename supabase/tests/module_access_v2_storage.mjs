import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = ["LOCAL_SUPABASE_URL", "LOCAL_SUPABASE_ANON_KEY", "LOCAL_SUPABASE_JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(sub) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated",
    exp: now + 600,
    iat: now,
    iss: "supabase-demo",
    role: "authenticated",
    sub,
  })}`;
  const signature = createHmac("sha256", process.env.LOCAL_SUPABASE_JWT_SECRET)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

function clientFor(sub) {
  return createClient(process.env.LOCAL_SUPABASE_URL, process.env.LOCAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token(sub)}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const agent = clientFor("51000000-0000-0000-0000-000000000003");
const client = clientFor("51000000-0000-0000-0000-000000000002");
const ticketId = "53000000-0000-0000-0000-000000000001";
const path = `tickets/${ticketId}/comments/internal-api.png`;

const upload = await agent.storage
  .from("ticket-attachments")
  .upload(path, new Blob(["local-storage-isolation"], { type: "image/png" }), {
    contentType: "image/png",
    upsert: false,
  });
assert(!upload.error, `agent upload failed: ${upload.error?.message}`);

const comment = await agent.rpc("create_ticket_comment_with_attachments", {
  target_ticket_id: ticketId,
  comment_body: "internal Storage API isolation fixture",
  comment_visibility: "internal",
  attachment_rows: [{
    storage_path: path,
    file_name: "internal-api.png",
    size_bytes: 23,
    mime_type: "image/png",
  }],
});
assert(!comment.error, `metadata registration failed: ${comment.error?.message}`);

const clientDownload = await client.storage.from("ticket-attachments").download(path);
assert(clientDownload.error, "client downloaded an internal attachment");

const clientDelete = await client.storage.from("ticket-attachments").remove([path]);
const agentDownload = await agent.storage.from("ticket-attachments").download(path);
assert(
  !agentDownload.error && agentDownload.data,
  `client delete had an effect or agent download failed: ${agentDownload.error?.message}`,
);

const agentDelete = await agent.storage.from("ticket-attachments").remove([path]);
assert(!agentDelete.error, `agent owner delete failed: ${agentDelete.error?.message}`);

const afterDelete = await agent.storage.from("ticket-attachments").download(path);
assert(afterDelete.error, "attachment still exists after owner delete");

console.log(JSON.stringify({
  upload: "PASS",
  internalClientDownload: "DENIED",
  internalClientDelete: clientDelete.error ? "DENIED" : "NO_EFFECT",
  internalAgentDownload: "PASS",
  ownerDelete: "PASS",
  deletedObjectRead: "DENIED",
}));
