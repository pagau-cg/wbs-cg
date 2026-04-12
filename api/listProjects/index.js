const { getContainer, getUserId } = require("../shared/storageHelper");

module.exports = async function (context, req) {
  const userId = getUserId(req);
  if (userId === "anonymous") {
    context.res = { status: 401, body: "Non authentifié" };
    return;
  }

  try {
    const container = await getContainer();
    const prefix = `users/${userId}/projects/`;
    const projects = [];

    for await (const blob of container.listBlobsFlat({
      prefix,
      includeMetadata: true,
    })) {
      const projectId = blob.name
        .replace(prefix, "")
        .replace(/\.json$/, "");

      projects.push({
        projectId,
        projName: blob.metadata?.projname || projectId,
        savedAt: blob.metadata?.savedat || blob.properties.lastModified,
        size: blob.properties.contentLength,
      });
    }

    projects.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: projects,
    };
  } catch (err) {
    context.log.error("Erreur /api/listProjects:", err.message);
    context.res = { status: 500, body: "Erreur serveur : " + err.message };
  }
};
