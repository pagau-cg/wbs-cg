// Retourne le rôle "authenticated" pour tout utilisateur connecté
// via le tenant constructiongauthier.com
module.exports = async function (context, req) {
  const body = req.body;
  const userId = body?.userId;
  const userDetails = body?.userDetails;

  context.log(`getRolesForUsers: ${userDetails}`);

  // Tout utilisateur du tenant constructiongauthier.com reçoit le rôle authenticated
  if (userDetails && userDetails.includes("constructiongauthier.com")) {
    context.res = {
      status: 200,
      body: { roles: ["authenticated"] }
    };
  } else {
    context.res = {
      status: 200,
      body: { roles: [] }
    };
  }
};
