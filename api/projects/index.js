const { getContainer, getUserId, blobName } = require("../shared/storageHelper");

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

module.exports = async function (context, req) {
  const projectId = context.bindingData.projectId;

  if (!projectId || projectId === "undefined") {
    context.res = { status: 400, body: "projectId requis" };
    return;
  }

  const userId = getUserId(req);
  if (userId === "anonymous") {
    context.res = { status: 401, body: "Non authentifié" };
    return;
  }

  try {
    const container = await getContainer();
    const blob = container.getBlockBlobClient(blobName(userId, projectId));

    if (req.method === "GET") {
      const exists = await blob.exists();
      if (!exists) { context.res = { status: 404, body: "Projet introuvable" }; return; }
      const download = await blob.downloadToBuffer();
      context.res = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.parse(download.toString("utf8")),
      };
      return;
    }

    if (req.method === "PUT") {
      const body = req.body;
      if (!body || typeof body !== "object") {
        context.res = { status: 400, body: "Payload JSON requis" }; return;
      }
      const json = JSON.stringify(body);
      if (Buffer.byteLength(json, "utf8") > MAX_PAYLOAD_BYTES) {
        context.res = { status: 413, body: "Projet trop volumineux (max 5 MB)" }; return;
      }
      const enriched = {
        ...body,
        _meta: { savedAt: new Date().toISOString(), savedBy: userId, projectId },
      };
      const buf = Buffer.from(JSON.stringify(enriched), "utf8");
      await blob.uploadData(buf, {
        blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
        metadata: {
          userId,
          projectId,
          projName: (body.projName || "").slice(0, 256),
          savedAt: new Date().toISOString(),
        },
      });
      context.res = { status: 200, body: { ok: true, savedAt: enriched._meta.savedAt } };
      return;
    }

    if (req.method === "DELETE") {
      const exists = await blob.exists();
      if (!exists) { context.res = { status: 404, body: "Projet introuvable" }; return; }
      await blob.delete();
      context.res = { status: 200, body: { ok: true } };
      return;
    }

    context.res = { status: 405, body: "Méthode non supportée" };

  } catch (err) {
    context.log.error("Erreur /api/projects:", err.message);
    context.res = { status: 500, body: "Erreur serveur : " + err.message };
  }
};
