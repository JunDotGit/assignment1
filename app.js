require("dotenv").config(); // .envファイルの読み込み

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// MongoDBに接続
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connection failed to MongoDB"))
  .catch((err) => console.log("Connection failed to MongoDB:", err));

// EJSとpublic設定
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// セッションの設定
app.use(session({
  secret: process.env.NODE_SESSION_SECRET,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  saveUninitialized: false,
  resave: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1時間で期限切れ
}));

// 仮のルート（動作確認用）
app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const bcrypt = require("bcrypt");
const Joi = require("joi");

const usersCollection = mongoose.connection.collection("users");

// GET: 登録フォーム表示
app.get("/signup", (req, res) => {
  res.render("signup");
});

// POST: フォーム送信処理
app.post("/signup", async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.send("There is a typing error: " + error.details[0].message);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  await usersCollection.insertOne({
    name: req.body.name,
    email: req.body.email,
    password: hashedPassword,
  });

  req.session.loggedin = true;
  req.session.username = req.body.name;
  res.redirect("/members");
});

// GET: ログインフォーム表示
app.get("/login", (req, res) => {
  res.render("login");
});

// POST: ログイン処理
app.post("/login", async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.send("Typing Error: " + error.details[0].message);
  }

  const user = await usersCollection.findOne({ email: req.body.email });
  if (!user) {
    return res.send("Can not find the user.<a href='/login'>back</a>");
  }

  const passwordMatch = await bcrypt.compare(req.body.password, user.password);
  if (!passwordMatch) {
    return res.send("The given password is incorrect<a href='/login'>back</a>");
  }

  // ログイン成功 → セッションに情報保存
  req.session.loggedin = true;
  req.session.username = user.name;
  res.redirect("/members");
});

// GET: メンバー専用ページ
app.get("/members", (req, res) => {
  // セッションがなければリダイレクト
  if (!req.session.loggedin) {
    return res.redirect("/");
  }

  // ランダムに画像を選択
  const images = ["cat1.jpg", "cat2.jpg", "cat3.jpg"];
  const randomIndex = Math.floor(Math.random() * images.length);
  const selectedImage = images[randomIndex];

  // EJSに変数を渡して表示
  res.render("members", {
    username: req.session.username,
    image: selectedImage,
  });
});

// GET: ログアウト処理
app.get("/logout", (req, res) => {
  // セッションを破棄してホームに戻る
  req.session.destroy();
  res.redirect("/");
});

// 存在しないURL（どのルートにもマッチしなかったリクエスト）を処理する
app.use((req, res) => {
  res.status(404);
  res.render("404");
});
