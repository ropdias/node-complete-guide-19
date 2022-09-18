const express = require("express");
const { body } = require("express-validator");

const adminController = require("../controllers/admin");
// We can add this middleware before every route that needs protection against a user not logged in:
const isAuth = require("../middleware/is-auth");
// We can add as many as we want in the router.get() function, they are called from left to right

const router = express.Router();

// Middlewares "isAuth" and "adminController.getAddProduct" are called from left to right here
// /admin/add-product => GET
router.get("/add-product", isAuth, adminController.getAddProduct);

// /admin/products => GET
router.get("/products", isAuth, adminController.getProducts);

// /admin/add-product => POST
router.post(
  "/add-product",
  isAuth,
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

router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);

// Remember when using post requests you don't need to pass dynamic segment
// and the data can be enclosed in the request body we are sending
router.post(
  "/edit-product",
  isAuth,
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
router.delete("/product/:productId", isAuth, adminController.deleteProduct);

module.exports = router;
