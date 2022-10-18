const express = require("express");
const csrf = require("csurf");
const bodyParser = require("body-parser");

const shopController = require("../controllers/shop");
// We can add this middleware before every route that needs protection against a user not logged in:
const isAuth = require("../middleware/is-auth");
// We can add as many as we want in the router.get() function, they are called from left to right

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

router.get("/", csrfProtection, shopController.getIndex);

router.get("/products", csrfProtection, shopController.getProducts);

router.get("/products/:productId", csrfProtection, shopController.getProduct);

router.get("/cart", isAuth, csrfProtection, shopController.getCart);

router.post(
  "/cart",
  isAuth,
  urlencodedParser,
  csrfProtection,
  shopController.postCart
);

router.post(
  "/cart-delete-item",
  isAuth,
  urlencodedParser,
  csrfProtection,
  shopController.postCartDeleteProduct
);

router.get("/checkout", isAuth, csrfProtection, shopController.getCheckout);

router.post(
  "/checkout",
  isAuth,
  urlencodedParser,
  csrfProtection,
  shopController.postCheckout
);

router.get(
  "/checkout/success",
  isAuth,
  csrfProtection,
  shopController.getCheckoutSuccess
);

router.get(
  "/checkout/cancel",
  isAuth,
  csrfProtection,
  shopController.getCheckout
);

// router.post("/create-order", isAuth, shopController.postOrder);

router.get("/orders", isAuth, csrfProtection, shopController.getOrders);

router.get(
  "/orders/:orderId",
  isAuth,
  csrfProtection,
  shopController.getInvoice
);

module.exports = router;
