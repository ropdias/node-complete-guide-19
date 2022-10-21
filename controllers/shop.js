const fs = require("fs");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const PDFDocument = require("pdfkit");

const Product = require("../models/product");
const Order = require("../models/order");
const User = require("../models/user");

const ITEMS_PER_PAGE = 2;

const stripeEndpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const createOrder = async (session) => {
  const user = await User.findById(session.client_reference_id).populate(
    "cart.items.productId"
  );

  const products = user.cart.items.map((i) => {
    // populate is bit of a magic here in the sense that it is a function in mongoose
    // which is used for populating the data inside the reference. So basically it just
    // references the documents from other collection hence the same does not get reflected
    // in the database. It's just for referencing so you can simply map it on your code by
    // referencing documents from different collections and getting them in the form you want
    // in your nodejs code. That's why here you need the ._doc attribute
    return { quantity: i.quantity, product: { ...i.productId._doc } };
  });
  const order = new Order({
    user: {
      email: user.email,
      userId: user._id,
    },
    products: products,
    stripeSession: session.id,
    status: "Awaiting Payment",
  });
  await order.save();
  await user.clearCart();
};

const fulfillOrder = async (session) => {
  await Order.updateOne(
    { stripeSession: session.id },
    { status: "Payment received" }
  );
};

const emailCustomerAboutFailedPayment = async (session) => {
  // TODO: fill me in
  console.log("Emailing customer", session);
};

exports.getProducts = (req, res, next) => {
  // Importante note:
  // countDocuments() does not retrieve all documents, it only counts them which is faster than retrieving them.
  // skip() and limit() are managed by MongoDB in a way that you only transfer the items over the wire which you
  // really need. It's not doing some server side filtering of the data, it really filters it on the database server already.
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  // Importante note:
  // countDocuments() does not retrieve all documents, it only counts them which is faster than retrieving them.
  // skip() and limit() are managed by MongoDB in a way that you only transfer the items over the wire which you
  // really need. It's not doing some server side filtering of the data, it really filters it on the database server already.
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId") // populate() now returns a promise and is now no longer chainable.
    .then((user) => {
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  // Extracting the productId from the request body:
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then(() => res.redirect("/cart"))
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(() => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;
  req.user
    .populate("cart.items.productId") // populate() now returns a promise and is now no longer chainable.
    .then((user) => {
      products = user.cart.items;

      if (products.length === 0) {
        return res.redirect(303, "/cart");
      }

      products.forEach((p) => {
        total += p.quantity * p.productId.price;
      });
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum: total,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCheckout = async (req, res, next) => {
  let user;
  try {
    user = await req.user.populate("cart.items.productId"); // populate() now returns a promise and is now no longer chainable.

    const products = user.cart.items;

    if (products.length === 0) {
      return res.redirect(303, "/cart");
    }

    if (user.stripeSession.id !== undefined) {
      try {
        // TODO: Think here that if the session has completed but the order wasnt filled in the server by any error we should
        // add the order in the server before trying to pay again or create some kind of verification, if we just delete the stripeSession
        // from the user we could lose the order somehow. Think about this.
        await stripe.checkout.sessions.expire(user.stripeSession.id); // Returns a Session object if the expiration succeeded.
      } catch (err) {
        // Returns an error if the Session has already expired or isn’t in an expireable state.
        user.stripeSession = undefined;
        user = await user.save();
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: products.map((p) => {
        return {
          price_data: {
            currency: "usd",
            unit_amount: p.productId.price * 100, // We need to specify this in cents
            product_data: {
              name: p.productId.title,
              description: p.productId.description,
            },
          },
          quantity: p.quantity,
        };
      }),
      customer_email: user.email,
      client_reference_id: user._id.toString(),
      // We will build the urls in case of success or cancel to be used in dev or production:
      success_url: req.protocol + "://" + req.get("host") + "/checkout/success", // => http://localhost:3000/checkout/success
      cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
    });

    user.stripeSession.cart.items = products;
    user.stripeSession.id = session.id;
    await user.save();

    // We don't need to back the session.id to the page and call stripe.redirectToCheckout()
    // We can redirect using session.url
    res.redirect(303, session.url);
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }
};

exports.getCheckoutSuccess = (req, res, next) => {
  res.redirect("/orders");
};

exports.stripeWebhookHandler = async (req, res, next) => {
  const payload = req.body;
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, stripeEndpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // You can save events in the database so you can check later if you missed any events by querying for missed events
  // using the Stripe API
  // https://stripe.com/docs/webhooks/best-practices

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Save an order in your database, marked as 'Awaiting Payment'
      try {
        await createOrder(session);
      } catch (err) {
        console.log(err);
        return res.status(500).send(`Server Error: ${err.message}`);
      }

      // Check if the order is paid (for example, from a card payment)
      //
      // A delayed notification payment will have an `unpaid` status, as
      // you're still waiting for funds to be transferred from the customer's
      // account.
      if (session.payment_status === "paid") {
        try {
          await fulfillOrder(session);
        } catch (err) {
          console.log(err);
          return res.status(500).send(`Server Error: ${err.message}`);
        }
      }

      break;
    }

    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;

      // Fulfill the purchase...
      try {
        await fulfillOrder(session);
      } catch (err) {
        return res.status(500).send(`Server Error: ${err.message}`);
      }

      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object;

      // Send an email to the customer asking them to retry their order
      try {
        await emailCustomerAboutFailedPayment(session);
      } catch (err) {
        return res.status(500).send(`Server Error: ${err.message}`);
      }

      break;
    }
  }

  res.status(200).json({ message: "Event handled" });
};

// exports.postOrder = (req, res, next) => {
//   req.user
//     .populate("cart.items.productId")
//     .then((user) => {
//       const products = user.cart.items.map((i) => {
//         // populate is bit of a magic here in the sense that it is a function in mongoose
//         // which is used for populating the data inside the reference. So basically it just
//         // references the documents from other collection hence the same does not get reflected
//         // in the database. It's just for referencing so you can simply map it on your code by
//         // referencing documents from different collections and getting them in the form you want
//         // in your nodejs code. That's why here you need the ._doc attribute
//         return { quantity: i.quantity, product: { ...i.productId._doc } };
//       });
//       const order = new Order({
//         user: {
//           email: req.user.email,
//           userId: req.user,
//         },
//         products: products,
//       });
//       return order.save();
//     })
//     .then(() => {
//       return req.user.clearCart();
//     })
//     .then(() => {
//       res.redirect("/orders");
//     })
//     .catch((err) => {
//       const error = new Error(err);
//       error.httpStatusCode = 500;
//       return next(error);
//     });
// };

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No order found."));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized"));
      }
      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoiceName + '"'
      );
      // Creating a new PDF File instead of sending from the server:
      const pdfDoc = new PDFDocument();
      pdfDoc.pipe(fs.createWriteStream(invoicePath)); // Here we pipe the output into a writable file stream and we will store it on the server
      pdfDoc.pipe(res); // Here we also pipe the output to the client in the response
      pdfDoc.fontSize(26).text("Invoice", {
        underline: true,
      });
      pdfDoc.text("------------------------");
      let totalPrice = 0;
      order.products.forEach((prod) => {
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc
          .fontSize(14)
          .text(
            `${prod.product.title} - ${prod.quantity} x $${prod.product.price}`
          );
      });
      pdfDoc.text("------------------------");
      pdfDoc.fontSize(20).text(`Total Price: $${totalPrice}`);
      pdfDoc.end(); // When we call end the writable streams will be closed so to say, or will know that you are done writing

      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      //   // Here we can set the 'Content-Type' header so the client can know what the extension of the file
      //   res.setHeader("Content-Type", "application/pdf");
      //   // We can also set another header, the 'Content-Disposition' that we can set how the content should be served to the client:
      //   res.setHeader(
      //     "Content-Disposition",
      //     'inline; filename="' + invoiceName + '"'
      //   );
      //   // You can change the behaviour to download the file by changing 'inline' with 'attachment'
      //   // res.setHeader('Content-Disposition', 'attachment; filename="' + invoiceName + '"');
      //   res.send(data);
      // });

      // The recommended way to get your file data is by using a STREAM (instead of downloading all the data in memory), especially for bigger files:
      // const file = fs.createReadStream(invoicePath);
      // res.setHeader("Content-Type", "application/pdf");
      // res.setHeader(
      //   "Content-Disposition",
      //   'attachment; filename="' + invoiceName + '"'
      // );
      // // You need to use the pipe() method from the file returned from fs.createReadStream() to forward what is read with
      // // that stream to the response (because the response object is a writable stream)
      // file.pipe(res);

      // https://stackoverflow.com/questions/37400024/nodejs-stream-vs-sendfile
      // Instead of using fs.createReadStream() we should use res.sendFile():
      // const options = {
      //   root: ".",
      //   headers: {
      //     "Content-Type": "application/pdf",
      //     "Content-Disposition": 'attachment; filename="' + invoiceName + '"',
      //   },
      // };
      // // The method invokes the callback function fn(err) when the transfer is complete or when an error occurs.
      // res.sendFile(invoicePath, options, (err) => {
      //   if (err) {
      //     return next(err);
      //   }
      // });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
