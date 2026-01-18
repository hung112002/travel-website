const path = require('path');
const express = require('express');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./travel.db', (err) => {
    if (err) {
        return console.error("Lỗi kết nối database:", err.message);
    }
    console.log("Đã kết nối tới database travel.db.");
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 
// --- ROUTE CHO TRANG PUBLIC (NGƯỜI DÙNG) ---

// list route
app.get('/', (req, res) => {
const sql = "SELECT * FROM destinations ORDER BY name";
    db.all(sql, [], (err, rows) => {
  if (err) {
            return console.error(err.message);
        }
    // Render file 'views/PopShelfList.ejs'
    res.render('PopShelfList', { destinations: rows }); 
    });
});

app.get('/PopShelfDetail/:id', (req, res) => {
    const sql = "SELECT * FROM destinations WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            return console.error(err.message); 
        }
        res.render('PopShelfDetail', { travel: row });
    });
});


// --- ROUTE CHO TRANG ADMIN ---

// Route để hiển thị trang danh sách admin (READ + Search)
app.get('/admin', (req, res) => {
    const keyword = req.query.search || ''; // Lấy từ khóa tìm kiếm
    const sql = `SELECT * FROM destinations WHERE name LIKE ? OR location LIKE ?`;
    const params = [`%${keyword}%`, `%${keyword}%`];

    db.all(sql, params, (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        res.render('admin_PopShelfList', { destinations: rows, keyword: keyword });
    });
});

// Route để hiển thị form thêm mới
app.get('/admin/add', (req, res) => {
    res.render('admin_PopShelfEdit', { travel: null }); 
});

// (CREATE)
app.post('/admin/add', (req, res) => {
    const { name, location, description, imageUrl } = req.body;
    const sql = `INSERT INTO destinations (name, location, description, imageUrl) VALUES (?, ?, ?, ?)`;
    db.run(sql, [name, location, description, imageUrl], function(err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/admin'); 
    });
});

// Route để hiển thị form chỉnh sửa (truyền dữ liệu cũ vào)
app.get('/admin/edit/:id', (req, res) => {
    const sql = "SELECT * FROM destinations WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        res.render('admin_PopShelfEdit', { travel: row });
    });
});

// Route để xử lý việc cập nhật (UPDATE)
app.post('/admin/edit/:id', (req, res) => {
    const { name, location, description, imageUrl } = req.body;
    const sql = `UPDATE destinations SET name = ?, location = ?, description = ?, imageUrl = ? WHERE id = ?`;
    db.run(sql, [name, location, description, imageUrl, req.params.id], function(err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/admin');
    });
});

//  (DELETE)
app.post('/admin/delete/:id', (req, res) => {
    const sql = 'DELETE FROM destinations WHERE id = ?';
    db.run(sql, [req.params.id], function(err) {
        if (err) {
          return console.error(err.message);
        }
        res.redirect('/admin');
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});