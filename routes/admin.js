const express = require("express");
const { body } = require("express-validator");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const csrf = require("csurf");
const bodyParser = require("body-parser");

const adminController = require("../controllers/admin");
// We can add this middleware before every route that needs protection against a user not logged in:
const isAuth = require("../middleware/is-auth");
// We can add as many as we want in the router.get() function, they are called from left to right

const router = express.Router();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images"); // it means NO ERROR (null) and we will save in the folder named 'images'
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + "-" + file.originalname); // it means NO ERROR (null) and we will use the filename using a UUID + the original name
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true); // it means NO ERROR (null) and TRUE we are accepting that file
  } else {
    cb(null, false); // it means NO ERROR (null) and FALSE we are not accepting that file
  }
};

// We are setting a file parser here that will look for a <form> with enctype="multipart/form-data"
const upload = multer({ storage: fileStorage, fileFilter: fileFilter });

// bodyParser.urlencoded() will do all the request body parsing we had to do manually (with req.on("data", (chunk) => {}) e req.on("end", () => {}))
// It won't parse all kind of bodys (like JSON and files) but will parse bodies sent through a form with enctype="application/x-www-form-urlencoded" (default)
const urlencodedParser = bodyParser.urlencoded({ extended: false });

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

// Middlewares "isAuth" and "adminController.getAddProduct" are called from left to right here
// /admin/add-product => GET
router.get(
  "/add-product",
  isAuth,
  csrfProtection,
  adminController.getAddProduct
);

// /admin/products => GET
router.get("/products", isAuth, csrfProtection, adminController.getProducts);

// /admin/add-product => POST
router.post(
  "/add-product",
  isAuth,
  upload.single("image"), // We will extract the body and a single file (single()) stored in some field named "image" in the incoming requests
  csrfProtection, // We need to use the csrf middleware AFTER we initialize the session, because it use it
  [
    body("title", "Invalid Title. (Should be a string and length > 3)")
      .trim()
      .isString()
      .isLength({ min: 3 }),
    body("price", "Invalid price. (Should be a currency number)").isCurrency(),
    body("description", "Invalid description (Should have length > 3 and < 400")
      .trim()
      .isLength({ min: 3, max: 400 }),
  ],
  adminController.postAddProduct
);

router.get(
  "/edit-product/:productId",
  isAuth,
  csrfProtection,
  adminController.getEditProduct
);

// Remember when using post requests you don't need to pass dynamic segment
// and the data can be enclosed in the request body we are sending
router.post(
  "/edit-product",
  isAuth,
  upload.single("image"), // We will extract the body and a single file (single()) stored in some field named "image" in the incoming requests
  csrfProtection, // We need to use the csrf middleware AFTER we initialize the session, because it use it
  [
    body("title", "Invalid Title. (Should be a string and length > 3)")
      .trim()
      .isString()
      .isLength({ min: 3 }),
    body("price", "Invalid price. (Should be a currency number)").isCurrency(),
    body("description", "Invalid description (Should have length > 3 and < 400")
      .trim()
      .isLength({ min: 3, max: 400 }),
  ],
  adminController.postEditProduct
);

// Important note: In this example we are not sending any JSON data with the request because it is a DELETE request without a post body.
// If it were a POST request with a body then I would have to parse JSON data in my backend.
// Right now we only have two parsers:
// 1) One for the URL encoded data which we don't have when we send JSON data:
// app.use(bodyParser.urlencoded({ extended: false }));
// 2) One for the multipart data which we also don't have there in our example:
//app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single("image"));
// We would have to add a new body parser that is able to handle JSON data and extract that from incoming requests.
router.delete(
  "/product/:productId",
  isAuth,
  csrfProtection,
  adminController.deleteProduct
);

module.exports = router;
