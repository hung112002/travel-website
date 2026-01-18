
document.addEventListener("DOMContentLoaded", function() {
    const loader = document.getElementById('page-loader');
    function hideLoader() {
        if (loader) {
            loader.classList.add('hidden');
        }
    }
    setTimeout(hideLoader, 300);

    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('/') && !href.startsWith('#') && this.target !== '_blank') {
                e.preventDefault(); 
                if (loader) loader.classList.remove('hidden'); 
                setTimeout(() => {
                    window.location.href = href;
                }, 400);
            }
        });
    });
});
window.addEventListener('pageshow', function(event) {
    const loader = document.getElementById('page-loader');
    if (loader) {
        if (event.persisted) {
            loader.classList.add('hidden');
        }
    }
});