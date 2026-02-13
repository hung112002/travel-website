require('dotenv').config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const bcrypt = require('bcrypt');
const multer = require('multer');
const nodemailer = require('nodemailer');
const saltRounds = 10;
const app = express();
const port = process.env.PORT || 3000;

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
// ===============================================================
// 1) CONNECT DB + INIT TABLES + SEED USERS
// ===============================================================
const db = new sqlite3.Database("./travel.db", (err) => {
  if (err) return console.error("DB connect error:", err.message);
  console.log("✅ Connected to travel.db");

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        avatar TEXT DEFAULT '/images/default-avatar.png',
        reset_token TEXT
      )
    `);

    // Lệnh nâng cấp bảng nếu đã có DB cũ
    db.run("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '/images/default-avatar.png'", (err) => {
        if (err) { /* Cột đã tồn tại */ }
        else console.log("✅ Đã nâng cấp bảng users: Thêm cột avatar.");
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS destinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        location TEXT,
        description TEXT,
        imageUrl TEXT,
        has_beach INTEGER DEFAULT 0,
        has_rest_stop INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 0,
        isOnsen INTEGER DEFAULT 0,
        isMountain INTEGER DEFAULT 0,
        isHistory INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER,
        destination_id INTEGER,
        PRIMARY KEY (user_id, destination_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // SEED USERS (Bcrypt Hashing)
        const seedInitialUsers = async () => {
            const hashedPass = await bcrypt.hash('123', saltRounds);
            db.run("UPDATE users SET password = ? WHERE email = ?", [hashedPass, 'admin@gmail.com']);
            db.run("UPDATE users SET password = ? WHERE email = ?", [hashedPass, 'user@gmail.com']);
        };
        seedInitialUsers();
    });
});

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services like 'Outlook365', 'SendGrid', etc.
                     // Or direct SMTP configuration: { host: 'smtp.example.com', port: 587, secure: false, auth: { user, pass } }
    auth: {
        user: process.env.EMAIL_USER || 'your_email@gmail.com', // ⚠️ REPLACE with your actual email address
        pass: process.env.EMAIL_PASS || 'your_email_password'  // ⚠️ REPLACE with your actual email password or app-specific password
                                                            // For Gmail, you might need an App Password: https://support.google.com/accounts/answer/185833
    }
});

// ===============================================================
// 2) APP CONFIG
// ===============================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "my-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // enable on HTTPS
    },
  })
);

// Always provide user to EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ===============================================================
// 3) AUTH MIDDLEWARE (API-aware)
// ===============================================================
function isApiRequest(req) {
  const accept = req.headers.accept || "";
  // toggle-favorite is API for sure
  if (req.path === "/toggle-favorite") return true;
  // if client expects json
  if (accept.includes("application/json")) return true;
  return false;
}

function checkAuth(req, res, next) {
  if (req.session?.isLoggedIn && req.session?.user) return next();

  // If API -> return JSON (avoid returning HTML that breaks response.json())
  if (isApiRequest(req)) return res.status(401).json({ error: "ログインしていません。" });

  // Normal pages -> redirect
  return res.redirect("/login");
}

function checkAdmin(req, res, next) {
    // Kiểm tra xem đã đăng nhập chưa VÀ role có phải admin không
    if (req.session.isLoggedIn && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    // Nếu không phải admin, trả về lỗi hoặc về trang chủ
    res.status(403).send("管理者権限がありません!");
}

// Áp dụng cho route admin
app.get('/admin', checkAdmin, (req, res) => {
    // 1. Lấy từ khóa tìm kiếm từ URL (ví dụ: /admin?search=Izumo)
    const searchQuery = req.query.search || '';
    
    let sql = "SELECT * FROM destinations";
    let params = [];

    // 2. Nếu có từ khóa, thêm điều kiện WHERE vào câu lệnh SQL
    if (searchQuery) {
        sql += " WHERE name LIKE ? OR location LIKE ?";
        // Dấu % giúp tìm kiếm tương đối (chứa từ khóa là được)
        params = [`%${searchQuery}%`, `%${searchQuery}%`];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Lỗi tìm kiếm:", err.message);
            return res.render('admin_PopShelfList', { travels: [] });
        }

        // 3. Gửi danh sách đã lọc và từ khóa tìm kiếm quay lại giao diện
        res.render('admin_PopShelfList', { 
            travels: rows || [], 
            search: searchQuery // Gửi lại để ô input không bị mất chữ khi load trang
        });
    });
});

// ===============================================================
// 4) PUBLIC ROUTES
// ===============================================================
app.get("/", (req, res) => {
  const keyword = req.query.search || "";

  let sql = "SELECT * FROM destinations WHERE is_featured = 1";
  const params = [];

  if (keyword) {
    sql += " AND (name LIKE ? OR location LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  sql += " ORDER BY name LIMIT 3";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.render("PopShelfList", { title: 'Shimane Travel', travels: rows || [], keyword });
  });
});

app.get("/all-destinations", (req, res) => {
  console.log("\n[DEBUG] Entered /all-destinations route");
  // 1. Nhận đầy đủ tham số từ URL, bao gồm cả 'location' mới
  const { search, location, sea, rest, onsen, mountain, history } = req.query;
  console.log("[DEBUG] Query params received:", req.query);


  let sql = "SELECT * FROM destinations WHERE 1=1";
  const params = [];

  // 2. Lọc theo từ khóa (Search)
  if (search) {
    sql += " AND (name LIKE ? OR location LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  // 3. THÊM MỚI: Lọc theo khu vực (Dropdown)
  if (location && location !== 'all') {
    const locationParam = location.trim();
    const shortLocation = locationParam.replace(/^島根県/, "");
    const compactLocation = locationParam.replace(/[ 　]/g, "");
    const compactShortLocation = shortLocation.replace(/[ 　]/g, "");
    const cityMatch = shortLocation.match(/.+?[市町村]/);
    const cityToken = cityMatch ? cityMatch[0] : "";
    // Dùng LIKE để khớp các địa chỉ đầy đủ trong DB + xử lý khoảng trắng/địa chỉ không chuẩn
    sql += " AND (location LIKE ? OR location LIKE ? OR REPLACE(REPLACE(location,' ',''),'　','') LIKE ? OR REPLACE(REPLACE(location,' ',''),'　','') LIKE ?";
    params.push(
      `%${locationParam}%`,
      `%${shortLocation}%`,
      `%${compactLocation}%`,
      `%${compactShortLocation}%`
    );
    if (cityToken) {
      sql += " OR location LIKE ?";
      params.push(`%${cityToken}%`);
    }
    sql += ")";
  }

  // 4. Giữ nguyên các bộ lọc đặc trưng cũ của bạn
  if (sea === "1") sql += " AND has_beach = 1";
  if (rest === "1") sql += " AND has_rest_stop = 1";
  if (onsen === "1") sql += " AND isOnsen = 1";
  if (mountain === "1") sql += " AND isMountain = 1";
  if (history === "1") sql += " AND isHistory = 1";

  sql += " ORDER BY name";

  console.log("[DEBUG] Executing SQL:", sql);
  console.log("[DEBUG] With params:", params);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("[DEBUG] SQL Error:", err.message);
      return res.status(500).send(err.message);
    }
    
    console.log(`[DEBUG] DB query successful. Found ${rows ? rows.length : 0} rows.`);
    console.log("[DEBUG] Preparing to render 'all-destinations.ejs'");
    
    // 5. Render lại giao diện với đầy đủ các biến để file EJS không bị lỗi "not defined"
    try {
      res.render("all-destinations", {
        title: '全ての観光地',
        travels: rows || [],
        keyword: search || "",
        location: location || "all", // Biến mới để giữ trạng thái Dropdown
        sea,
        rest,
        onsen,
        mountain,
        history,
      });
      console.log("[DEBUG] res.render() called successfully.");
    } catch (renderError) {
      console.error("[DEBUG] EJS Render Error:", renderError);
      res.status(500).send("A server error occurred during page rendering.");
    }
  });
});

app.get("/travel/:id", (req, res) => {
  db.get("SELECT * FROM destinations WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).send("Không tìm thấy địa điểm");
    
    // Lấy ảnh phụ từ bảng destination_images
    db.all("SELECT * FROM destination_images WHERE destination_id = ?", [req.params.id], (err2, images) => {
      if (err2) images = [];
      res.render("PopShelfDetail", { travel: row, images: images || [] });
    });
  });
});

app.get("/cuisine", (req, res) => res.render("cuisine", { title: "グルメ" }));
app.get("/people", (req, res) => res.render("people", { title: "匠・人物" }));
app.get("/shimane-history", (req, res) => res.render("shimane-history", { title: "歴史" }));

app.get("/gourmet-souvenirs", (req, res) => {
  res.render("gourmet-souvenirs", { title: "グルメ・お土産" });
});

app.get("/access", (req, res) => {
  res.render("access", { title: "アクセス" });
});

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'お問い合わせ', sent: false, error: null });
});
app.post("/contact", (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !subject || !message) {
    return res.render("contact", { sent: false, error: "Vui lòng điền đầy đủ thông tin." });
  }
  
  db.run(
    "INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)",
    [name, email, subject, message],
    (err) => {
      if (err) {
        console.error("Lỗi lưu tin nhắn vào DB:", err.message);
        return res.render("contact", { sent: false, error: "Lỗi khi lưu tin nhắn, vui lòng thử lại." });
      }

      // --- Gửi 2 email song song ---

      // 1. Email cho quản trị viên (bạn)
      const adminMailOptions = {
          from: `"${name}" <${process.env.EMAIL_USER}>`,
          to: process.env.RECIPIENT_EMAIL,
          replyTo: email,
          subject: `[Liên hệ] ${subject}`,
          html: `<p>Bạn có tin nhắn mới từ trang liên hệ Shimane Travel:</p>
                 <ul>
                    <li><strong>Tên:</strong> ${name}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Chủ đề:</strong> ${subject}</li>
                 </ul>
                 <h3>Nội dung:</h3>
                 <p>${message}</p>`
      };

      // 2. Email xác nhận cho người dùng
      const userMailOptions = {
          from: `"Shimane Travel" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Cảm ơn bạn đã liên hệ với Shimane Travel',
          html: `
            <p>Xin chào ${name},</p>
            <p>Cảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi trong thời gian sớm nhất.</p>
            <br>
            <p><strong>Nội dung bạn đã gửi:</strong></p>
            <p><strong>Chủ đề:</strong> ${subject}</p>
            <p><strong>Nội dung:</strong></p>
            <p>${message}</p>
            <hr>
            <p>Trân trọng,<br>Đội ngũ Shimane Travel</p>
          `
      };

      // Gửi mail cho admin
      transporter.sendMail(adminMailOptions, (error, info) => {
          if (error) {
              console.error("Lỗi gửi email cho admin:", error);
              // Vẫn báo thành công cho người dùng nếu tin nhắn đã vào DB
              return res.render("contact", { sent: true, emailError: "Gửi email cho quản trị viên thất bại, nhưng tin nhắn của bạn đã được lưu." });
          }
          console.log('Email cho admin đã gửi: ' + info.response);
          // Gửi mail xác nhận cho người dùng (không cần đợi)
          transporter.sendMail(userMailOptions, (userError, userInfo) => {
              if (userError) {
                  console.error("Lỗi gửi email xác nhận cho người dùng:", userError);
              } else {
                  console.log('Email xác nhận cho người dùng đã gửi: ' + userInfo.response);
              }
          });
          
          res.render("contact", { sent: true });
      });
    }
  );
});

// ===============================================================
// 5) AUTH ROUTES
// ===============================================================
app.post("/check-email", (req, res) => {
  const { email } = req.body;
  db.get("SELECT email FROM users WHERE email = ?", [email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json({ exists: !!row });
  });
});

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        // 1. Xử lý lỗi từ database
        if (err) {
            console.error(err.message);
            return res.render('login', { error: 'Đã xảy ra lỗi hệ thống!' });
        }

        if (user) {
            // 2. So sánh mật khẩu
            const match = await bcrypt.compare(password, user.password);
            
            if (match) {
                // 3. Thiết lập Session
                req.session.isLoggedIn = true; 
                req.session.user = user;

                req.session.save((err) => {
                    if (err) return next(err);
                    res.redirect('/profile'); 
                });
                
            } else {
                res.render('login', { error: 'パスワードが正しくありません！' });
            }
        } else {
            res.render('login', { error: 'アカウントが存在しません！' });
        }
    });
});

app.get("/register", (req, res) => res.render("register", { error: null }));

app.post('/register', async (req, res) => {
    const { email, username, password } = req.body;
    try {
        // Mã hóa mật khẩu với độ phức tạp saltRounds = 10
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const sql = "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, 'user')";
        db.run(sql, [email, username, hashedPassword], (err) => {
            if (err) return res.render('register', { error: 'メールは既に存在しています！' });
            res.redirect('/login?registered=true');
        });
    } catch (err) {
        res.render('register', { error: 'システムエラーが発生しました。もう一度お試しください。' });
    }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user.id;
    // データベースからお気に入りの場所のリストを取得するクエリ
    const sql = `
        SELECT destinations.* FROM destinations 
        JOIN favorites ON destinations.id = favorites.destination_id 
        WHERE favorites.user_id = ?`;

    db.all(sql, [userId], (err, favoritePlaces) => {
        if (err) {
            console.error(err.message);
            return res.render('profile', { user: req.session.user, favorites: [] });
        }
        // QUAN TRỌNG: Phải gửi cả user và favorites sang EJS
        res.render('profile', { 
            user: req.session.user, 
            favorites: favoritePlaces || [] 
        });
    });
});

// 2. Route cập nhật thông tin cơ bản
app.post('/profile/update', checkAuth, (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { username, email } = req.body;
    const userId = req.session.user.id;

    db.run("UPDATE users SET username = ?, email = ? WHERE id = ?", [username, email, userId], (err) => {
        if (err) return res.json({ success: false });
        // Cập nhật lại session
        req.session.user.username = username;
        req.session.user.email = email;
        res.json({ success: true });
    });
});

// Route: Đổi mật khẩu ngay tại trang Profile
app.post('/profile/change-password', async (req, res) => {
    if (!req.session.user) return res.json({ success: false });
    
    const { newPassword } = req.body;
    const userId = req.session.user.id;

    try {
        // MÃ HÓA mật khẩu mới trước khi lưu
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId], (err) => {
            if (err) return res.json({ success: false });
            
            // Cập nhật lại mật khẩu đã mã hóa trong session
            req.session.user.password = hashedPassword;
            res.json({ success: true });
        });
    } catch (err) {
        res.json({ success: false });
    }
});
// ===============================================================
// 6) PASSWORD RESET ROUTES
// ===============================================================

app.get("/forgot-password", (req, res) => res.render("forgot-password", { msg: null }));

app.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    // Để tránh dò email, luôn hiển thị thông báo thành công chung.
    if (err || !user) {
      console.log(`Yêu cầu reset mật khẩu cho email (có thể không tồn tại): ${email}`);
      return res.render("forgot-password", { msg: "Nếu email của bạn có trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi đến." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    db.run("UPDATE users SET reset_token = ? WHERE email = ?", [token, email], (err2) => {
      if (err2) {
        console.error("Lỗi cập nhật reset token:", err2.message);
        return res.render("forgot-password", { msg: "Đã xảy ra lỗi. Vui lòng thử lại." });
      }

      // 2. Tạo nội dung và gửi email
      const resetLink = `http://${req.headers.host}/reset/${token}`;
      const mailOptions = {
          from: `"Shimane Travel" <${process.env.EMAIL_USER}>`,
          to: email, // Gửi đến người dùng đã yêu cầu
          subject: 'Yêu cầu đặt lại mật khẩu của bạn',
          html: `
            <p>Xin chào,</p>
            <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại Shimane Travel.</p>
            <p>Vui lòng nhấp vào liên kết bên dưới để tạo mật khẩu mới:</p>
            <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a></p>
            <p>Liên kết sẽ hết hạn sau một khoảng thời gian ngắn. Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.</p>
            <p>Trân trọng,<br>Đội ngũ Shimane Travel</p>
          `
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error("Lỗi gửi email reset mật khẩu:", error);
          } else {
              console.log('Email reset mật khẩu đã gửi: ' + info.response);
          }
          // Luôn hiển thị thông báo chung cho người dùng
          res.render("forgot-password", { msg: "Nếu email của bạn có trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi đến." });
      });
    });
  });
});

app.get("/reset/:token", (req, res) => {
  const { token } = req.params;

  db.get("SELECT * FROM users WHERE reset_token = ?", [token], (err, user) => {
    if (err) return res.status(500).send(err.message);
    if (!user) return res.send("リンクが無効、または有効期限が切れています。");
    res.render("reset-password", { token });
  });
});

// Route: Xử lý đặt lại mật khẩu mới
app.post('/reset/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body; // Mật khẩu mới người dùng nhập

    try {
        // 1. Mã hóa mật khẩu mới bằng Bcrypt
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const sql = "UPDATE users SET password = ?, reset_token = NULL WHERE reset_token = ?";
        db.run(sql, [hashedPassword, token], function(err) {
            if (this.changes === 0) {
                return res.send("Link hết hạn hoặc không hợp lệ.");
            }
            res.redirect('/login?reset=success');
        });
    } catch (err) {
        res.send("パスワードのハッシュ化中にエラーが発生しました。");
    }
});

// ===============================================================
// 7) FAVORITES API (ALWAYS JSON)
// ===============================================================
app.post('/toggle-favorite', (req, res) => {
    // Nếu session không tồn tại, trả về lỗi 401
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { destinationId } = req.body;
    const userId = req.session.user.id;

    // Kiểm tra xem đã có trong danh sách chưa
    db.get("SELECT * FROM favorites WHERE user_id = ? AND destination_id = ?", [userId, destinationId], (err, row) => {
        if (row) {
            // Đã có -> Xóa (Unlike)
            db.run("DELETE FROM favorites WHERE user_id = ? AND destination_id = ?", [userId, destinationId]);
            res.json({ status: 'unliked' });
        } else {
            // Chưa có -> Thêm (Like)
            db.run("INSERT INTO favorites (user_id, destination_id) VALUES (?, ?)", [userId, destinationId]);
            res.json({ status: 'liked' });
        }
    });
});

// ===============================================================
// 8) ADMIN
// ===============================================================
app.get("/admin", checkAuth, checkAdmin, (req, res) => {
  const keyword = req.query.search || "";
  db.all("SELECT * FROM destinations WHERE name LIKE ?", [`%${keyword}%`], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.render("admin_PopShelfList", { travels: rows || [], keyword });
  });
});

app.get("/admin/add", checkAuth, checkAdmin, (req, res) => {
  res.render("admin_PopShelfEdit", { travel: null });
});

app.post("/admin/add", checkAuth, checkAdmin, (req, res) => {
  const {
    name,
    location,
    description,
    imageUrl,
    is_featured,
    has_beach,
    has_rest_stop,
    isOnsen,
    isMountain,
    isHistory,
    opening_hours,
    closed_days,
    phone,
    access,
    website_url,
    map_iframe,
    notice_text,
    best_season,
    news_update,
    gallery_urls
  } = req.body;

  const sql = `
    INSERT INTO destinations
    (name, location, description, imageUrl, has_beach, has_rest_stop, is_featured, isOnsen, isMountain, isHistory,
     opening_hours, closed_days, phone, access, website_url, map_iframe, notice_text, best_season, news_update)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.run(
    sql,
    [
      name,
      location,
      description,
      imageUrl,
      has_beach ? 1 : 0,
      has_rest_stop ? 1 : 0,
      is_featured ? 1 : 0,
      isOnsen ? 1 : 0,
      isMountain ? 1 : 0,
      isHistory ? 1 : 0,
      opening_hours || '',
      closed_days || '',
      phone || '',
      access || '',
      website_url || '',
      map_iframe || '',
      notice_text || '',
      best_season || '',
      news_update || ''
    ],
    function(err) {
      if (err) return res.status(500).send(err.message);
      
      // Lấy ID của địa điểm vừa được tạo
      const newId = this.lastID;
      
      // Xử lý gallery_urls nếu có
      if (gallery_urls) {
        const urlList = gallery_urls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== "");
        const gallerySql = "INSERT INTO destination_images (destination_id, image_url) VALUES (?, ?)";
        urlList.forEach(url => {
          db.run(gallerySql, [newId, url]);
        });
      }
      
      res.redirect("/admin");
    }
  );
});

app.get("/admin/edit/:id", checkAuth, checkAdmin, (req, res) => {
  db.get("SELECT * FROM destinations WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    
    // Lấy danh sách ảnh gallery cũ
    db.all("SELECT image_url FROM destination_images WHERE destination_id = ?", [req.params.id], (err2, images) => {
      const current_gallery = (images || []).map(img => img.image_url).join('\n');
      res.render("admin_PopShelfEdit", { travel: row, current_gallery });
    });
  });
});

// Route xử lý cập nhật địa điểm dùng URL ảnh
app.post("/admin/edit/:id", checkAuth, checkAdmin, (req, res) => {
    const id = req.params.id;
    
    // DEBUG: In toàn bộ dữ liệu nhận được
    console.log("DEBUG: Form data received:", req.body);
    
    // 1. Lấy toàn bộ dữ liệu từ Form (bao gồm cả các URL ảnh)
    let { 
        name, location, description, 
        imageUrl, // URL ảnh chính của địa điểm
        gallery_urls, // Danh sách các URL ảnh thư viện (cách nhau bằng dấu phẩy hoặc xuống dòng)
        has_beach, has_rest_stop, is_featured, isOnsen, isMountain, isHistory,
        opening_hours, closed_days, phone, access, website_url,
        map_iframe, // Maps URL hoặc iframe tag
        notice_text, best_season, news_update 
    } = req.body;
    
    // XỬ LÝ: Nếu map_iframe là iframe tag HTML, extract URL từ src
    if (map_iframe && map_iframe.includes('<iframe')) {
        const srcMatch = map_iframe.match(/src="([^"]+)"/);
        if (srcMatch) {
            map_iframe = srcMatch[1];
        }
    }
    
    console.log("DEBUG: Extracted values:", { opening_hours, closed_days, phone, access, website_url, notice_text, best_season, news_update, map_iframe });

    // 2. Câu lệnh SQL Update cho 19 cột thông tin
    const sqlUpdate = `
        UPDATE destinations SET 
            name = ?, location = ?, description = ?, imageUrl = ?,
            has_beach = ?, has_rest_stop = ?, is_featured = ?, 
            isOnsen = ?, isMountain = ?, isHistory = ?,
            opening_hours = ?, closed_days = ?, phone = ?, 
            access = ?, website_url = ?, map_iframe = ?,
            notice_text = ?, best_season = ?, news_update = ?
        WHERE id = ?
    `;

    const params = [
        name, location, description, imageUrl,
        has_beach === "1" ? 1 : 0, has_rest_stop === "1" ? 1 : 0, is_featured === "1" ? 1 : 0,
        isOnsen === "1" ? 1 : 0, isMountain === "1" ? 1 : 0, isHistory === "1" ? 1 : 0,
        opening_hours || '', closed_days || '', phone || '', access || '', website_url || '', map_iframe || '',
        notice_text || '', best_season || '', news_update || '', id
    ];

    db.run(sqlUpdate, params, function(err) {
        if (err) {
            console.error("❌ Lỗi Update Destination:", err.message);
            return res.status(500).send("Lỗi cập nhật dữ liệu: " + err.message);
        }

        // 3. Xử lý Thư viện ảnh (Gallery) từ danh sách URL
        if (gallery_urls) {
            // Tách các URL bằng dấu phẩy hoặc xuống dòng
            const urlList = gallery_urls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== "");
            
            // Xóa ảnh cũ của địa điểm này trước khi thêm mới (tùy chọn)
            db.run("DELETE FROM destination_images WHERE destination_id = ?", [id], () => {
                const gallerySql = "INSERT INTO destination_images (destination_id, image_url) VALUES (?, ?)";
                urlList.forEach(url => {
                    db.run(gallerySql, [id, url]);
                });
            });
        }

        console.log(`✅ Đã cập nhật thành công địa điểm ID: ${id}`);
        res.redirect("/admin");
    });
});

app.post("/admin/delete/:id", checkAuth, checkAdmin, (req, res) => {
  db.run("DELETE FROM destinations WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/admin");
  });
});

// ===============================================================
// 9) ERROR HANDLER
// ===============================================================
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(port, () => console.log(`🚀 Server running: http://localhost:${port}`));
module.exports = app;