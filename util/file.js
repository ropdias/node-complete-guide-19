const { unlink } = require("fs/promises");

exports.deleteFile = (filePath) => {
  return unlink(filePath);
};
