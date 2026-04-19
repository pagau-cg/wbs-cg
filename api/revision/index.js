// GET/PUT/DELETE /api/revision/{dossierId}/{revId}
const { getContainer, getUserId, metaBlob, revisionBlob, safeDossier } = require("../shared/storageHelper");

module.exports = async function (context, req) {
  const { dossierId, revId } = context.bindingData;
  if (!dossierId || !revId) { context.res = { status: 400, body: "dossierId et revId requis" }; return; }

  const userId = getUserId(req);
  const container = await getContainer();
  const blobPath = revisionBlob(dossierId, revId);
  const blob = container.getBlockBlobClient(blobPath);

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      if (!await blob.exists()) { context.res = { status: 404, body: "Révision introuvable" }; return; }
      const dl = await blob.downloadToBuffer();
      context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: JSON.parse(dl.toString("utf8")) };
      return;
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (req.method === "PUT") {
      const body = req.body;
      if (!body) { context.res = { status: 400, body: "Payload requis" }; return; }

      const note = body._meta?.note || "";
      const projName = body.projName || "";
      const cp = body.cp || "";

      const enriched = {
        ...body,
        _meta: {
          revId,
          dossierId,
          savedAt: new Date().toISOString(),
          savedBy: userId,
          note,
        }
      };

      const buf = Buffer.from(JSON.stringify(enriched), "utf8");
      await blob.uploadData(buf, {
        blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
        metadata: {
          revid: revId,
          dossierid: dossierId,
          projname: projName.slice(0, 200),
          cp: cp.slice(0, 100),
          savedby: userId.slice(0, 100),
          note: note.slice(0, 200),
          savedat: new Date().toISOString(),
        }
      });

      // Mettre à jour meta.json du projet
      const metaBlobClient = container.getBlockBlobClient(metaBlob(dossierId));
      const metaData = {
        dossierId,
        projName,
        cp,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      };
      if (!await metaBlobClient.exists()) metaData.createdAt = new Date().toISOString();
      await metaBlobClient.uploadData(Buffer.from(JSON.stringify(metaData), "utf8"), {
        blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
        metadata: { dossierid: dossierId, projname: projName.slice(0, 200), cp: cp.slice(0, 100) }
      });

      context.res = { status: 200, body: { ok: true, savedAt: enriched._meta.savedAt, revId } };
      return;
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      if (!await blob.exists()) { context.res = { status: 404, body: "Révision introuvable" }; return; }
      await blob.delete();
      context.res = { status: 200, body: { ok: true } };
      return;
    }

    context.res = { status: 405, body: "Méthode non supportée" };
  } catch (err) {
    context.log.error("revision:", err.message);
    context.res = { status: 500, body: err.message };
  }
};
