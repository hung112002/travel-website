document.addEventListener("DOMContentLoaded", function() {
    const loader = document.getElementById('page-loader');
    
    // This function adds the 'hidden' class to the loader, which is styled in CSS to fade out.
    function hideLoader() {
        if (loader) {
            loader.classList.add('hidden');
        }
    }
    
    // Wait for a short moment before hiding the loader to ensure a smooth experience.
    setTimeout(hideLoader, 500); 
});