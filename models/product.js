const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const productSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
});

module.exports = mongoose.model('Product', productSchema);

// const mongodb = require("mongodb");
// const getDb = require("../util/database").getDb;

// const ObjectId = mongodb.ObjectId;

// class Product {
//   // I removed userId since there is no point in having that information here
//   constructor(title, price, description, imageUrl, id) {
//     this.title = title;
//     this.price = price;
//     this.description = description;
//     this.imageUrl = imageUrl;
//     this._id = id ? new ObjectId(id) : null;
//   }

//   save() {
//     const db = getDb();
//     if (this._id) {
//       // Update the product
//       return db
//         .collection("products")
//         .updateOne({ _id: this._id }, { $set: this });
//       // dbOp = db.collection('products').updateOne({_id: new mongodb.ObjectId(this._id)}, {$set: {title: this.title}});
//     } else {
//       // Create a new product
//       return db.collection("products").insertOne(this);
//     }
//   }

//   static fetchAll() {
//     const db = getDb();
//     // .find() returns a cursor
//     // .toArray() transforms everything into a JavaScript array and returns a promise
//     return db.collection("products").find().toArray();
//   }

//   static findById(prodId) {
//     const db = getDb();
//     return db
//       .collection("products")
//       .find({ _id: new ObjectId(prodId) })
//       .next();
//   }

//   static deleteById(prodId) {
//     const db = getDb();
//     return db
//       .collection("products")
//       .deleteOne({ _id: new ObjectId(prodId) })
//       .then(() => {
//         // We are also removing that product from every cart from every user
//         return db
//           .collection("users")
//           .updateMany(
//             {},
//             { $pull: { "cart.items": { productId: new ObjectId(prodId) } } }
//           );
//       })
//       .catch((err) => console.log(err));
//   }
// }

// module.exports = Product;
