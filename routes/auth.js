const express = require("express");
const { check, body } = require("express-validator");
const csrf = require("csurf");
const bodyParser = require("body-parser");

const authController = require("../controllers/auth");
const User = require("../models/user");

const router = express.Router();

// We can pass an object to csrf({}) to configure some stuff like "cookie" [not recommended] (to store the secret in a cookie instead of a session (default))
// csurf is deprecated (25/09/2022): https://snyk.io/blog/explaining-the-csurf-vulnerability-csrf-attacks-on-all-versions/
// Since we are using session cookie already it's okay for now.
const csrfProtection = [
  csrf(),
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken(); // we are getting this method that is provided from the csrf middleware
    next();
  },
];

// bodyParser.urlencoded() will do all the request body parsing we had to do manually (with req.on("data", (chunk) => {}) e req.on("end", () => {}))
// It won't parse all kind of bodys (like JSON and files) but will parse bodies sent through a form with enctype="application/x-www-form-urlencoded" (default)
const urlencodedParser = bodyParser.urlencoded({ extended: false });

router.get("/login", csrfProtection, authController.getLogin);

router.get("/signup", csrfProtection, authController.getSignup);

router.post(
  "/login",
  urlencodedParser,
  csrfProtection,
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid e-mail.")
      .normalizeEmail(), // Sanitizer to normalize e-mail addresses
    body("password", "Password has to be valid.")
      .trim() // Sanitizer to remove spaces
      .isLength({ min: 5 })
      .isAlphanumeric(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  urlencodedParser,
  csrfProtection,
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid e-mail.")
      .custom((value, { req }) => {
        // if (value === "test@test.com") {
        //   throw new Error("This email address is forbidden.");
        // }
        // return true;
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject(
              "E-mail exists already, please pick a different one."
            );
          }
        });
      })
      .normalizeEmail(), // Sanitizer to normalize e-mail addresses
    // we will use the body here just to show that we can use a specific function
    // that look inside a specific place instead of a genereic check
    // You can also pass a second argument to replace the default error message and make it generic
    // instead of repeating it after every validator:
    body(
      "password",
      "Please enter a password with only numbers and text and at least 5 characters"
    )
      .trim() // Sanitizer to remove spaces
      .isLength({ min: 5 }) // This is just a demonstration, in production it should have more characters
      // .withMessage(
      //   "Please enter a password with only numbers and text and at least 5 characters"
      // )
      .isAlphanumeric(), // This is just a demonstration, in production we should allow special characters

    // .withMessage(
    //   "Please enter a password with only numbers and text and at least 5 characters"
    // ),
    body("confirmPassword")
      .trim() // Sanitizer to remove spaces
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords have to match!");
        }
        return true;
      }),
  ],
  authController.postSignup
);

router.post(
  "/logout",
  urlencodedParser,
  csrfProtection,
  authController.postLogout
);

router.get("/reset", csrfProtection, authController.getReset);

router.post(
  "/reset",
  urlencodedParser,
  csrfProtection,
  authController.postReset
);

// We are adding a dynamic parameter "token" here:
router.get("/reset/:token", csrfProtection, authController.getNewPassword);

router.post(
  "/new-password",
  urlencodedParser,
  csrfProtection,
  authController.postNewPassword
);

module.exports = router;
