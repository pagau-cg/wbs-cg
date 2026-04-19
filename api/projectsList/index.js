// GET /api/projectsList — liste tous les projets partagés
const { getContainer } = require("../shared/storageHelper");

module.exports = async function (context, req) {
  try {
    const container = await getContainer();
    const projects = {};

    // Lister tous les meta.json
    for await (const blob of container.listBlobsFlat({ prefix: "projects/", includeMetadata: true })) {
      const parts = blob.name.split("/");
      const dossierId = parts[1];
      if (!dossierId) continue;

      if (parts[2] === "meta.json") {
        if (!projects[dossierId]) projects[dossierId] = { dossierId, revisions: [] };
        try {
          const dl = await container.getBlockBlobClient(blob.name).downloadToBuffer();
          const meta = JSON.parse(dl.toString("utf8"));
          projects[dossierId] = { ...projects[dossierId], ...meta };
        } catch {}
      }

      if (parts[2] === "revisions") {
        const revId = (parts[3] || "").replace(/\.json$/, "");
        if (revId && revId !== "autosave") {
          if (!projects[dossierId]) projects[dossierId] = { dossierId, revisions: [] };
          if (!projects[dossierId].revisions) projects[dossierId].revisions = [];
          projects[dossierId].revisions.push({
            revId,
            savedAt: blob.metadata?.savedat || blob.properties.lastModified,
            savedBy: blob.metadata?.savedby || "",
            note: blob.metadata?.note || "",
            projName: blob.metadata?.projname || "",
          });
        }
      }
    }

    // Trier révisions par date décroissante dans chaque projet
    const list = Object.values(projects).map(p => {
      p.revisions = (p.revisions || []).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return p;
    });

    // Trier projets par date de dernière révision
    list.sort((a, b) => {
      const da = a.revisions?.[0]?.savedAt || a.updatedAt || "0";
      const db = b.revisions?.[0]?.savedAt || b.updatedAt || "0";
      return new Date(db) - new Date(da);
    });

    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: list };
  } catch (err) {
    context.log.error("projectsList:", err.message);
    context.res = { status: 500, body: err.message };
  }
};
