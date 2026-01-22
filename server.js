const path = require("path");
const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const bcrypt = require('bcrypt');
const multer = require('multer');
const saltRounds = 10;
const app = express();
const port = 3000;


const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
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
    // SỬA LỖI TẠI ĐÂY: Thêm dấu phẩy sau cột avatar
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

    // Seed users với Bcrypt
    const seedInitialUsers = async () => {
        const hashedPass = await bcrypt.hash('123', saltRounds);
        db.run("UPDATE users SET password = ? WHERE email = ?", [hashedPass, 'admin@gmail.com'], (err) => {
        if (!err) console.log("✅ Đã cập nhật mật khẩu Bcrypt cho Admin.");
    });
        db.run("UPDATE users SET password = ? WHERE email = ?", [hashedPass, 'user@gmail.com'], (err) => {
        if (!err) console.log("✅ Đã cập nhật mật khẩu Bcrypt cho User thường.");
    });
};
seedInitialUsers();
  });
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

  req.session.save((err) => {
    if (err) return next(err);
    res.redirect('/profile'); // Chỉ chuyển trang sau khi session đã lưu xong
});

  // Normal pages -> redirect
  return res.redirect("/login");
}

function checkAdmin(req, res, next) {
  if (req.session?.user?.role === "admin") return next();
  return res.status(403).send("管理者権限がありません。");
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
            travels: rows, 
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
    res.render("PopShelfList", { travels: rows || [], keyword });
  });
});

app.get("/all-destinations", (req, res) => {
  // 1. Nhận đầy đủ tham số từ URL, bao gồm cả 'location' mới
  const { search, location, sea, rest, onsen, mountain, history } = req.query;

  let sql = "SELECT * FROM destinations WHERE 1=1";
  const params = [];

  // 2. Lọc theo từ khóa (Search)
  if (search) {
    sql += " AND (name LIKE ? OR location LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  // 3. THÊM MỚI: Lọc theo khu vực (Dropdown)
  if (location && location !== 'all') {
    sql += " AND location = ?";
    params.push(location);
  }

  // 4. Giữ nguyên các bộ lọc đặc trưng cũ của bạn
  if (sea === "1") sql += " AND has_beach = 1";
  if (rest === "1") sql += " AND has_rest_stop = 1";
  if (onsen === "1") sql += " AND isOnsen = 1";
  if (mountain === "1") sql += " AND isMountain = 1";
  if (history === "1") sql += " AND isHistory = 1";

  sql += " ORDER BY name";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    
    // 5. Render lại giao diện với đầy đủ các biến để file EJS không bị lỗi "not defined"
    res.render("all-destinations", {
      travels: rows || [],
      keyword: search || "",
      location: location || "all", // Biến mới để giữ trạng thái Dropdown
      sea,
      rest,
      onsen,
      mountain,
      history,
    });
  });
});

app.get("/travel/:id", (req, res) => {
  db.get("SELECT * FROM destinations WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).send("Không tìm thấy địa điểm");
    res.render("PopShelfDetail", { travel: row });
  });
});

app.get("/cuisine", (req, res) => res.render("cuisine"));
app.get("/people", (req, res) => res.render("people"));

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
                res.render('login', { error: 'Mật khẩu không chính xác!' });
            }
        } else {
            res.render('login', { error: 'Tài khoản không tồn tại!' });
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
            if (err) return res.render('register', { error: 'Email đã tồn tại!' });
            res.redirect('/login?registered=true');
        });
    } catch (err) {
        res.render('register', { error: 'Lỗi hệ thống, vui lòng thử lại.' });
    }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user.id;
    // Truy vấn lấy danh sách địa điểm đã yêu thích từ database
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
    if (err) return res.status(500).send(err.message);
    if (!user) return res.render("forgot-password", { msg: "メールアドレスが存在しません。" });

    const token = crypto.randomBytes(20).toString("hex");
    db.run("UPDATE users SET reset_token = ? WHERE email = ?", [token, email], (err2) => {
      if (err2) return res.status(500).send(err2.message);

      console.log(`🔑 RESET LINK: http://localhost:${port}/reset/${token}`);
      res.render("forgot-password", { msg: "リセットリンクはコンソール（ターミナル）に表示されました。" });
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
        res.send("Có lỗi xảy ra trong quá trình mã hóa.");
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
  } = req.body;

  const sql = `
    INSERT INTO destinations
    (name, location, description, imageUrl, has_beach, has_rest_stop, is_featured, isOnsen, isMountain, isHistory)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `;

  db.run(
    sql,
    [
      name,
      location,
      description,
      imageUrl,
      has_beach || 0,
      has_rest_stop || 0,
      is_featured || 0,
      isOnsen || 0,
      isMountain || 0,
      isHistory || 0,
    ],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect("/admin");
    }
  );
});

app.get("/admin/edit/:id", checkAuth, checkAdmin, (req, res) => {
  db.get("SELECT * FROM destinations WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    res.render("admin_PopShelfEdit", { travel: row });
  });
});

app.post("/admin/edit/:id", checkAuth, checkAdmin, (req, res) => {
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
  } = req.body;

  const sql = `
    UPDATE destinations
    SET name=?, location=?, description=?, imageUrl=?,
        has_beach=?, has_rest_stop=?, is_featured=?, isOnsen=?, isMountain=?, isHistory=?
    WHERE id=?
  `;

  db.run(
    sql,
    [
      name,
      location,
      description,
      imageUrl,
      has_beach || 0,
      has_rest_stop || 0,
      is_featured || 0,
      isOnsen || 0,
      isMountain || 0,
      isHistory || 0,
      req.params.id,
    ],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect("/admin");
    }
  );
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
