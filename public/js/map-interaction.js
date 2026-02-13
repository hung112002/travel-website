document.addEventListener('DOMContentLoaded', () => {
    const areaData = {
        '隠岐': { title: '隠岐エリア', description: '美しい自然と独自の文化が息づく島々。シーカヤックやハイキングが楽しめます。' },
        '松江': { title: '松江エリア', description: '国宝松江城や宍道湖の夕日で知られる城下町。武家屋敷や堀川めぐりも人気です。' },
        '出雲': { title: '出雲エリア', description: '縁結びの神様として名高い出雲大社が鎮座する神話の国。古代の歴史を感じられます。' },
        '安来': { title: '安来エリア', description: '足立美術館の美しい日本庭園や、どじょうすくいで知られる安来節で有名です。' },
        '雲南': { title: '雲南エリア', description: '日本のさくら名所100選に選ばれた斐伊川堤防桜並木や、たたら製鉄の歴史が残ります。' },
        '奥出雲町': { title: '奥出雲エリア', description: 'ヤマタノオロチ伝説の舞台。美しい棚田の風景や温泉が魅力です。' },
        '飯南町': { title: '飯南エリア', description: '琴引フォレストパークスキー場や、大しめ縄で知られる大しめ縄創作館があります。' },
        '大田': { title: '石見銀山エリア', description: '世界遺産「石見銀山遺跡とその文化的景観」の中心地。歴史的な町並みが保存されています。' },
        '川本町': { title: '川本町', description: '江の川（ごうのかわ）が町の中心を流れる、自然豊かな町です。' },
        '美郷町': { title: '美郷町', description: 'カヌーの里として知られ、江の川でのアウトドア活動が盛んです。' },
        '邑南町': { title: '邑南町', description: '「A級グルメのまち」を宣言し、石見和牛などの高品質な食材が楽しめます。' },
        '江津市': { title: '江津市', description: 'しまね海洋館アクアスがあり、シロイルカのパフォーマンスが人気です。' },
        '浜田': { title: '浜田エリア', description: '日本海に面した美しい海岸線が広がり、新鮮な海の幸が豊富です。' },
        '益田': { title: '益田エリア', description: '雪舟が築いた萬福寺と雪舟庭園、持石海岸の夕日などが有名です。' },
        '津和野': { title: '津和野エリア', description: '「山陰の小京都」と称される美しい城下町。鯉の泳ぐ掘割や森鴎外記念館があります。' },
        '吉賀町': { title: '吉賀町', description: '水源の森百選にも選ばれた水源郷など、清流とホタルの里として知られています。' }
    };

    const mapPaths = document.querySelectorAll('.map-section-full .map-svg-container a');
    const titleElement = document.getElementById('current-area-title');
    const descElement = document.getElementById('current-area-desc');
    
    const defaultTitle = '選択してください';
    const defaultDesc = '地図上のエリアをクリックして、詳細情報を確認してください。';

    mapPaths.forEach(pathLink => {
        const href = pathLink.getAttribute('href');
        if (!href) return;

        const urlParams = new URLSearchParams(href.split('?')[1]);
        const areaKey = urlParams.get('search');

        if (areaData[areaKey]) {
            pathLink.addEventListener('mouseover', () => {
                const data = areaData[areaKey];
                titleElement.textContent = data.title;
                descElement.textContent = data.description;
            });

            pathLink.addEventListener('mouseout', () => {
                titleElement.textContent = defaultTitle;
                descElement.textContent = defaultDesc;
            });
        }
    });
});
