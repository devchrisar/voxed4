// import things..
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const firebase = require("./db/firebase");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const fireDate = require("@google-cloud/firestore");
const fs = require("fs");
const { json } = require("express");
const { type } = require("os");
const { FieldValue } = require("@google-cloud/firestore");
// set cors policy
app.use(cors());

app.use(bodyParser.json());


const storage = multer.diskStorage({
  //destination: "uploads",
  filename: function (req, file, cb) {
    const parts = file.mimetype.split("/");
    cb(null, `${file.fieldname}-${Date.now()}.${parts[1]}`)
  }



});
const upload = multer({
  storage,
  limits: { fileSize: 15000000 },
  fileFilter: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if(ext !== '.webm' &&  ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
      return cb(null, false)
  }
  cb(null, true)
  }
});

const middleware = (req, res, next) => {
  if (req.originalUrl == "/" || "/create" || "/session" || "/comment") {
    const cb = (err, data) => {
      const userIP = req.headers["x-forwarded-for"];
      let bool = false;
      if (err) {
        console.log(err);
        return false;
      } else {
        data = JSON.parse(data);
        data.ips.forEach((element) => {
          if (element == userIP) bool = true;
        });
      }
      if (bool) res.sendStatus(401);
      else next();
    };
    fs.readFile(pathBanList, "utf8", cb);
  } else {
    next();
  }
};

// path public..
app.use(middleware, express.static(path.join(__dirname, "../site/www")));
let pathBanList = __dirname + "/blacklist-historic.json";

// main endpoint..
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname));
});

function isAdmin(token) {
 firebase.admin.auth().verifyIdToken(token).then((decodedToken) => {
  const uid = decodedToken.uid;
  return true
}).catch((error) => {
  return false
});}

app.post("/session", async (req, res) => {
  if (res.status(200)) {
    const userIP = req.headers["x-forwarded-for"];
    //verificar que no exista en el baneo historico + el baneo diario

    const userID = uuidv4().slice(-6);

    const userData = { userIP, userID };
    await firebase.db.collection("users").add(userData);
    res.json(token);
  } else {
    console.log("Error de conexión");
  }
});



app.post("/create", upload.single("post-img-upload"), async (req, res) => {
  //
  if (res.status(200)) {
    const img = req.file;
    if (img == undefined) return res.sendStatus(400);
    const imgPath = req.file.path;
    const { category, title, body, opid } = req.body;

    const uploadedFile = await firebase.admin.storage().bucket().upload(imgPath, { public: true });
    const signedUrls = await uploadedFile[0].getSignedUrl({ action: 'read', expires: '01-01-4499' })
    const publicUrl = signedUrls[0];

    const postData = {
      category,
      imgPath: publicUrl,
      title,
      body,
      opid,
      createdAt: fireDate.Timestamp.now(),
    };

    await firebase.db.collection("posts").add(postData);
    return res.sendStatus(200);
  } else {
    console.log("Error de conexión");
  }
});

app.post("/comment",upload.single("post-img-upload"), async (req, res) => {
  // chequear archivo de baneos diarios

  // console.log(req.headers["x-forwarded-for"]);

  if (res.status(200)) {
    const userIP = req.headers["x-forwarded-for"];
    const imgPath = req.file.path;
    const { body, postId, userId } = req.body;
    const uploadedFile = await firebase.admin.storage().bucket().upload(imgPath, { public: true });
    const signedUrls = await uploadedFile[0].getSignedUrl({ action: 'read', expires: '01-01-4499' })
    const publicUrl = signedUrls[0];
    const commentData = {
      body,
      imgPath: publicUrl,
      postId,
      userId,
      createdAt: fireDate.Timestamp.now(),
    };
    await firebase.db.collection("comments").add(commentData);
    return res.status(200);
  } else {
    console.log("Error de conexión");
  }
});

app.post("/report", async (req, res) => {
  console.log(req.body.postID);
  await firebase.db
    .collection("posts")
    .doc(req.body.postID)
    .update({ reports: FieldValue.increment(1) });
  console.log("asdasd");
  res.sendStatus(200);
});

app.post("/delete", async (req, res)=>{
  //admin delete post
  console.log(req.body);
  if(req?.body?.token == null | undefined) {res.sendStatus(401); return};
  if(isAdmin(req.body.token)){

    await firebase.db.collection("posts").doc(req.body.postID).delete();
    console.log('post borrado por ADMIN');
    res.sendStatus(200);
  }
  else{ res.sendStatus(401);
    console.log("no funcionó borrar post");

  }
});


// aca

const server = http.createServer(app);
// heroku port access..
app.set("port", process.env.PORT || 3000);
// Opening port..
app.listen(app.get("port"), () => {
  console.log("Opening in port 3000");
});
