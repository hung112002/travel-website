
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./travel.db', (err) => {
    if (err) return console.error(err.message);
    console.log('Đã kết nối tới travel.db.');
});

db.serialize(() => {
    console.log("Đang nâng cấp bảng destinations...");

    // Thêm cột 'has_beach' (có biển)
    // INTEGER DEFAULT 0 có nghĩa là: 0 = false (không), 1 = true (có)
    db.run("ALTER TABLE destinations ADD COLUMN has_beach INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error("Lỗi thêm cột has_beach:", err.message);
        } else {
            console.log("Cột 'has_beach' đã tồn tại hoặc đã được thêm.");
        }
    });

    // Thêm cột 'has_rest_stop' (có chỗ nghỉ)
    db.run("ALTER TABLE destinations ADD COLUMN has_rest_stop INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error("Lỗi thêm cột has_rest_stop:", err.message);
        } else {
            console.log("Cột 'has_rest_stop' đã tồn tại hoặc đã được thêm.");
        }
    });
    

    console.log("Nâng cấp database hoàn tất.");
});
db.serialize(() => {
    console.log(" nâng cấp bảng destinations...");
    db.run("ALTER TABLE destinations ADD COLUMN is_featured INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error("Lỗi thêm cột is_featured:", err.message);
        } else {
            console.log("Cột 'is_featured' đã tồn tại hoặc đã được thêm.");
        }
    });
});

db.close();