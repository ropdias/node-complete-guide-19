const express = require("express");
const { check, body } = require("express-validator");

const authController = require("../controllers/auth");
const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
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

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

// We are adding a dynamic parameter "token" here:
router.get("/reset/:token", authController.getNewPassword);

router.post("/new-password", authController.postNewPassword);

module.exports = router;
