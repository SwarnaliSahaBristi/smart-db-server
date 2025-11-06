// encode.js
const fs = require("fs");
const key = fs.readFileSync("./smart-deals-16691-firebase-adminsdk-fbsvc-880432f55f.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);