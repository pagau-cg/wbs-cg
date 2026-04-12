// api/shared/storageHelper.js
const { BlobServiceClient } = require("@azure/storage-blob");

const CONTAINER = "wbs-cg";
const CONNECTION = process.env.AZURE_STORAGE_CONNECTION_STRING;

async function getContainer() {
  if (!CONNECTION) throw new Error("AZURE_STORAGE_CONNECTION_STRING non configurée");
  const client = BlobServiceClient.fromConnectionString(CONNECTION);
  const container = client.getContainerClient(CONTAINER);
  await container.createIfNotExists({ access: "private" });
  return container;
}

function getUserId(req) {
  try {
    const header = req.headers["x-ms-client-principal"];
    if (!header) return "anonymous";
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const principal = JSON.parse(decoded);
    return (principal.userDetails || principal.userId || "anonymous")
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, "_");
  } catch {
    return "anonymous";
  }
}

function blobName(userId, projectId) {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `users/${userId}/projects/${safeId}.json`;
}

module.exports = { getContainer, getUserId, blobName };
