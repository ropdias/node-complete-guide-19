// We are creating a middleware here to add before every route that needs protection against a user not logged in:
module.exports = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    // return res.status(401).redirect("/login");
    // The 401 status CODE will be overwritten with 300 code, so we just use:
    return res.redirect("/login");
  }
  next();
}