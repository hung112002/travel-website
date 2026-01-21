document.addEventListener("DOMContentLoaded", function() {
    const loader = document.getElementById('page-loader');
    
    function hideLoader() {
        if (loader) {
            loader.classList.add('hidden'); // Sử dụng class hidden đã định nghĩa ở CSS trên
        }
    }
    
    // Đợi 0.5 giây để Shimanekko nhảy rồi mới ẩn
    setTimeout(hideLoader, 500); 

    // Phần xử lý click vào link giữ nguyên như bạn đã viết là rất tốt
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            // Kiểm tra link nội bộ để hiện Shimanekko trước khi đi
            if (href && href.startsWith('/') && !href.startsWith('#') && this.target !== '_blank') {
                e.preventDefault(); 
                if (loader) loader.classList.remove('hidden'); 
                setTimeout(() => {
                    window.location.href = href;
                }, 400); // Đợi 0.4s để hiệu ứng hiện ra rồi mới chuyển trang
            }
        });
    });
});