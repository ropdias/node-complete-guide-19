const mongoose = require("mongoose");
const fileHelper = require("../util/file");

const { validationResult } = require("express-validator");

const Product = require("../models/product");
const User = require("../models/user");

const ITEMS_PER_PAGE = 2;

exports.getAddProduct = (req, res, next) => {
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
    oldInput: {
      title: "",
      price: "",
      description: "",
    },
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file; // Here you get an object from multer with information from the file uploaded (or undefined if rejected)
  const price = req.body.price;
  const description = req.body.description;
  if (!image) {
    // if it's undefined multer declined the incoming file
    return res.status(422).render("admin/edit-product", {
      path: "/admin/add-product",
      pageTitle: "Add Product",
      editing: false,
      oldInput: {
        title: title,
        price: price,
        description: description,
      },
      errorMessage: "Attached file is not an image.",
      validationErrors: [],
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fileHelper
      .deleteFile(image.path)
      .then(() => {
        res.status(422).render("admin/edit-product", {
          path: "/admin/add-product",
          pageTitle: "Add Product",
          editing: false,
          oldInput: {
            title: title,
            price: price,
            description: description,
          },
          errorMessage: errors.array()[0].msg,
          validationErrors: errors.array(),
        });
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  }

  const imageUrl = image.path; // Getting the image path to store in the DB and fetch the image later

  const product = new Product({
    // _id: new mongoose.Types.ObjectId("630baa5715e38a1befaa4384"), // This is just to test the error in the catch() block
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl,
    // userId: req.user._id // You can get the ._id directly or:
    userId: req.user, // You can use the object directly and mongoose will get the ._id for you
  });

  product
    .save() // This will be provided by mongoose
    .then((result) => {
      // Technically we don't get a promise but mongoose still gives us a then method
      console.log(`Created Product: ${title} with id: ${result._id}`);
      res.redirect("/admin/products");
    })
    .catch((err) => {
      // And mongoose also gives us a catch method we can call

      // We could return a 500 response and render the page again with a error message:
      // return res.status(500).render("admin/edit-product", {
      //   path: "/admin/add-product",
      //   pageTitle: "Add Product",
      //   editing: false,
      //   oldInput: {
      //     title: title,
      //     imageUrl: imageUrl,
      //     price: price,
      //     description: description,
      //   },
      //   errorMessage: "Database operation failed, please try again.",
      //   validationErrors: [],
      // });

      // We could also redirect like this to a 500 page:
      // res.redirect("/500");

      // But we actually should create a new Error and pass it to next() to let Express know that
      // an error occurred and skip all other middlewares and move right away to an error handling middleware we can define:
      const error = new Error(err);
      error.httpStatusCode = 500; // You can add extra information with the error object so that you can use it in the central error middleware
      return next(error);
    });
};

exports.getEditProduct = (req, res, next) => {
  // We are already coming from a 'edit-product' route but this was added just to show
  // how to retrieve data from a query param:
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect("/");
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      // If we don't have a product and it's undefined:
      if (!product) {
        // We could retrieve a error page (better user experience) but for now we will just redirect:
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/add-product",
        editing: editMode,
        product: product,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  // Fetch information from the product
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (image) {
      return fileHelper
        .deleteFile(image.path)
        .then(() => {
          res.status(422).render("admin/edit-product", {
            path: "/admin/add-product",
            pageTitle: "Edit Product",
            editing: true,
            product: {
              title: updatedTitle,
              price: updatedPrice,
              description: updatedDesc,
              _id: prodId,
            },
            errorMessage: errors.array()[0].msg,
            validationErrors: errors.array(),
          });
        })
        .catch((err) => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);
        });
    } else {
      return res.status(422).render("admin/edit-product", {
        path: "/admin/add-product",
        pageTitle: "Edit Product",
        editing: true,
        product: {
          title: updatedTitle,
          price: updatedPrice,
          description: updatedDesc,
          _id: prodId,
        },
        errorMessage: errors.array()[0].msg,
        validationErrors: errors.array(),
      });
    }
  }

  Product.findById(prodId) // findById() returns a mongoose object where we can call .save()
    .then((product) => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect("/");
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      // We will check if a new file image was uploaded to update if we have a new image
      // Otherwise we will not update this field and we will remain with the old path
      if (image) {
        return fileHelper
          .deleteFile(product.imageUrl)
          .then(() => {
            product.imageUrl = image.path;
            return product.save(); // if we use the save() here it will not create a new one instead it will update behind the scenes
          })
          .then(() => {
            // We have this then() here and not in a chain because we have different returns for different situations
            console.log("UPDATED PRODUCT!");
            res.redirect("/admin/products");
          })
          .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
          }); // Here i'm firing this function and I'm not caring about the result
      } else {
        return product
          .save() // if we use the save() here it will not create a new one instead it will update behind the scenes
          .then(() => {
            // We have this then() here and not in a chain because we have different returns for different situations
            console.log("UPDATED PRODUCT!");
            res.redirect("/admin/products");
          })
          .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
          });
      }
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  // Importante note:
  // countDocuments() does not retrieve all documents, it only counts them which is faster than retrieving them.
  // skip() and limit() are managed by MongoDB in a way that you only transfer the items over the wire which you
  // really need. It's not doing some server side filtering of the data, it really filters it on the database server already.
  const page = +req.query.page || 1;
  let totalItems;

  Product.find({ userId: req.user._id })
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find({ userId: req.user._id })
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      // .select("title price -_id") // only the title and price, and explicit excluding the _id
      // .populate("userId", "name") // only the field "name" (the field _id will also be populated)
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
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

// https://stackoverflow.com/questions/41292316/how-do-i-await-multiple-promises-in-parallel-without-fail-fast-behavior
// https://v8.dev/features/promise-combinators#promise.allsettled
// https://stackoverflow.com/questions/5010288/how-to-make-a-function-wait-until-a-callback-has-been-called-using-node-js
// Basically the solution was to wrap the fileHelper.deleteFile() into a Promise
// And wait the two functions with Promise.allSettled()
exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        // return next(new Error("Product not found."));
        return res.status(500).json({ message: "Product not found." });
      }
      const promiseDeleteImage = fileHelper.deleteFile(product.imageUrl);
      const promiseDeleteProduct = Product.deleteOne({
        _id: prodId,
        userId: req.user._id,
      })
        .then((result) => {
          if (result.deletedCount > 0) {
            console.log(
              `Deleted product ! (Total deleted: ${result.deletedCount})`
            );
          }
          return User.updateMany(
            {},
            { $pull: { "cart.items": { productId: prodId } } }
          );
        })
        .then((result) => {
          if (result.modifiedCount > 0) {
            console.log(
              `Removed product from every cart ! (Total modified: ${result.modifiedCount})`
            );
          }
        });
      return Promise.allSettled([
        promiseDeleteImage,
        promiseDeleteProduct,
      ]).then((results) => {
        if (
          results[0].status !== "fulfilled" &&
          results[1].status !== "fulfilled"
        ) {
          // next(new Error("promiseDeleteImage and promiseDeleteProduct failed !"));
          res
            .status(500)
            .json({ message: "Deleting image and the product failed." });
        } else if (results[0].status !== "fulfilled") {
          // next(new Error("promiseDeleteImage failed !"));
          res.status(500).json({ message: "Deleting image failed." });
        } else if (results[1].status !== "fulfilled") {
          // next(new Error("promiseDeleteProduct failed !"));
          res.status(500).json({ message: "Deleting product failed." });
        } else {
          // res.redirect("/admin/products");
          res.status(200).json({ message: "Sucess!" });
        }
      });
    })
    .catch((err) => {
      res.status(500).json({ message: "Deleting product failed." });
    });
};
