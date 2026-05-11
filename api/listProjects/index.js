const { getContainer } = require("../shared/storageHelper");

module.exports = async function (context, req) {
  try {
    const container = await getContainer();
    context.res = { status: 200, body: { ok: true, container: container.containerName } };
  } catch (err) {
    context.res = { status: 200, body: { error: err.message, type: err.constructor.name } };
  }
};
