const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./travel.db');

const destinations = [
    // VÙNG ĐÔNG (IZUMO - MATSUE)
    {
        name: "宍道湖 (Hồ Shinji)",
        location: "島根県松江市",
        description: "Hồ lớn thứ 7 ở Nhật Bản, nổi tiếng với cảnh hoàng hôn tuyệt đẹp và đặc sản hến Shijimi.",
        imageUrl: "/images/shinji-lake.jpg",
        is_featured: 1, isOnsen: 0, isMountain: 0, isHistory: 0
    },
    {
        name: "日本庭園 由志園 (Vườn Yuushien)",
        location: "島根県松江市八束町",
        description: "Khu vườn Nhật Bản nổi tiếng với hoa mẫu đơn nở quanh năm và lễ hội ánh sáng rực rỡ.",
        imageUrl: "/images/yuushien.jpg",
        is_featured: 1, isOnsen: 0, isMountain: 0, isHistory: 0
    },
    {
        name: "日御碕神社 (Đền Hinomisaki)",
        location: "島根県出雲市大社町",
        description: "Ngôi đền đỏ rực rỡ bên bờ biển, nơi thờ thần Mặt trời và thần Biển cả.",
        imageUrl: "/images/hinomisaki.jpg",
        is_featured: 1, isOnsen: 0, isMountain: 0, isHistory: 1
    },
    {
        name: "玉造温泉 (Tamatsukuri Onsen)",
        location: "島根県松江市玉湯町",
        description: "Một trong những khu suối nước nóng cổ nhất Nhật Bản, giúp làm đẹp da và cầu may mắn.",
        imageUrl: "/images/tamatsukuri.jpg",
        is_featured: 0, isOnsen: 1, isMountain: 0, isHistory: 0
    },
    {
        name: "奥出雲たたらと刀剣館",
        location: "島根県奥出雲町",
        description: "Bảo tàng về kỹ thuật luyện sắt truyền thống Tatara dùng để rèn kiếm Katana.",
        imageUrl: "/images/tatara.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 0, isHistory: 1
    },
    {
        name: "安来 清水寺 (Chùa Kiyomizu)",
        location: "島根県安来市清水町",
        description: "Ngôi chùa cổ nằm giữa rừng thông, nổi tiếng với tháp 3 tầng và món ăn chay.",
        imageUrl: "/images/kiyomizu.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 1, isHistory: 1
    },

    // VÙNG TÂY (IWAMI)
    {
        name: "仁摩サンドミュージアム (Bảo tàng Cát)",
        location: "島根県大田市",
        description: "Nơi có chiếc đồng hồ cát lớn nhất thế giới chảy trong vòng một năm.",
        imageUrl: "/images/nima-sand.jpg",
        is_featured: 1, isOnsen: 0, isMountain: 0, isHistory: 0
    },
    {
        name: "太皷谷稲成神社 (Đền Taikodani)",
        location: "島根県津和野町",
        description: "Đường hầm với 1.000 cổng Torii đỏ rực dẫn lên đỉnh đồi ngắm toàn cảnh thị trấn.",
        imageUrl: "/images/taikodani.jpg",
        is_featured: 1, isOnsen: 0, isMountain: 1, isHistory: 1
    },
    {
        name: "稲佐の浜 (Bãi biển Inasa)",
        location: "島根県出雲市",
        description: "Bãi biển linh thiêng nơi các vị thần tụ họp về Shimane vào tháng 10 âm lịch.",
        imageUrl: "/images/inasa-beach.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 0, isHistory: 1
    },
    {
        name: "石見海浜公園 (Iwami Seaside)",
        location: "島根県浜田市",
        description: "Bãi biển cát trắng nước trong xanh, là nơi lý tưởng để cắm trại và tắm biển.",
        imageUrl: "/images/iwami-sea.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 0, isHistory: 0
    },
    {
        name: "グラントワ (Grand Toit)",
        location: "島根県益田市",
        description: "Trung tâm văn hóa nghệ thuật với kiến trúc ngói đỏ Sekishu đặc trưng của vùng Iwami.",
        imageUrl: "/images/grand-toit.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 0, isHistory: 0
    },

    // VÙNG ĐẢO OKI
    {
        name: "国賀海岸 (Bờ biển Kuniga)",
        location: "島根県隠岐郡西ノ島町",
        description: "Vách đá Matengai hùng vĩ cao 257m và những đàn bò, ngựa gặm cỏ tự do.",
        imageUrl: "/images/kuniga.jpg",
        is_featured: 1, isOnsen: 0, isMountain: 1, isHistory: 0
    },
    {
        name: "壇鏡の滝 (Thác Dangyo)",
        location: "島根県隠岐の島町",
        description: "Thác nước linh thiêng chảy qua mái đền, tạo nên khung cảnh huyền bí.",
        imageUrl: "/images/dangyo.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 1, isHistory: 1
    },
    {
        name: "岩倉の乳房杉 (Tuyết tùng Chichi-sugi)",
        location: "島根県隠岐の島町",
        description: "Cây tuyết tùng 800 năm tuổi với hình dáng kỳ lạ giống như bầu sữa mẹ.",
        imageUrl: "/images/chichi-sugi.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 1, isHistory: 0
    },
    {
        name: "隠岐神社 (Đền Oki)",
        location: "島根県海士町",
        description: "Ngôi đền lịch sử thờ Thiên hoàng Go-Toba với con đường hoa anh đào tuyệt đẹp.",
        imageUrl: "/images/oki-shrine.jpg",
        is_featured: 0, isOnsen: 0, isMountain: 0, isHistory: 1
    }
];

db.serialize(() => {
    const stmt = db.prepare(`INSERT INTO destinations 
        (name, location, description, imageUrl, is_featured, isOnsen, isMountain, isHistory) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    destinations.forEach((dest) => {
        stmt.run(dest.name, dest.location, dest.description, dest.imageUrl, dest.is_featured, dest.isOnsen, dest.isMountain, dest.isHistory);
    });

    stmt.finalize();
    console.log("🎉 Đã nạp thành công 15 địa điểm vào Database!");
});

db.close();
