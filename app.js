const path = require("path");
const fs = require("fs");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const flash = require("connect-flash");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const errorControler = require("./controllers/error");
const User = require("./models/user");

const app = express();
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI, // We could use a different database but for this example we are fine using the same one
  collection: "sessions", // You define here the collections you will use to store the sessions, we can use any name here
  // expires: ... // We could add a expires attribute to set when it should expire and mongodb will clean automatically
});

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" }
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        "font-src": ["'self'", "fonts.gstatic.com"],
        "script-src-attr": ["'self'", "'unsafe-inline'"],
        "form-action": ["'self'", "checkout.stripe.com"],
      },
    },
  })
);

app.use(compression());
app.use(morgan("combined", { stream: accessLogStream })); // Good article about logging: https://blog.risingstack.com/node-js-logging-tutorial/

app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
// We can use res.locals here to add "isAuthenticated" and "csrfToken" to every view.
// We will initialize with null for now so every view can have even if we have an error:
app.use((req, res, next) => {
  res.locals.isAuthenticated = null;
  res.locals.csrfToken = null;
  next();
});

//'secret' is used for signing the hash which secretly stores our ID in the cookie. (In production this should be a long string value)
//'resave' means that the session will not be saved on every request that is done, but only if something changed in the session. (this improves performance)
//'saveUninitialized' this will ensure that no session gets saved for a request where it doesn't need to be saved because nothing was changed about it.
//'cookie' you can configure a cookie where you pass an object with properties like "maxAge" or "expires" or you can go with the default settings.
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store, // This attribute sets where we want to store the sessions
  })
);
// Changing res.locals.isAuthenticated:
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  next();
});
app.use(flash());

// You need this middleware to get the full mongoose model so we can call all methods directly on that user for this request:
app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      // If you throw an Error here you will not reach the express error handling middleware
      // Because this is ASYNC code and you need to use next(new Error(err)) instead.
      // Throwing an error will only reach the express error handling middleware in SYNC code
      // throw new Error(err);
      next(new Error(err));
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorControler.get500);

app.use(errorControler.get404);

// Normally this middleware wouldn't be reached because we have or "catch all middleware" errorControler.get404
// But there is the special type of middleware called "error handling middleware" with 4 arguments that Express will
// move right away to it when you can next() with an Error inside:
app.use((error, req, res, next) => {
  // res.redirect("/500"); // This can lead to infinite loop if you thrown an Error in SYNC code
  // We can also render a page here or return some JSON data here
  // res.status(error.httpStatusCode).render(...);
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
  });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then((result) => {
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log(err);
  });
