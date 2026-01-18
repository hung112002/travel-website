const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./travel.db');

db.serialize(() => {
    // 1. Tạo bảng users
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )`, (err) => {
        if (err) {
            console.error("Lỗi tạo bảng:", err.message);
        } else {
            console.log("✅ Đã tạo bảng 'users' thành công!");
        }
    });
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', '123', 'admin')`, (err) => {
        if (err) {
            console.error("Lỗi tạo admin:", err.message);
        } else {
            console.log("✅ Đã tạo tài khoản admin (User: admin / Pass: 123)");
        }
    });
});

db.close(() => {
    console.log("--- Hoàn tất cài đặt Database ---");
});