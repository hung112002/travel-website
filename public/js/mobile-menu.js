// Mobile Menu Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navLinks = document.getElementById('nav-links');

    if (!hamburgerMenu || !navLinks) return;

    // Toggle menu on hamburger click
    hamburgerMenu.addEventListener('click', function() {
        hamburgerMenu.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking on a link
    const navItems = navLinks.querySelectorAll('a, button');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            hamburgerMenu.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        const isClickInsideMenu = navLinks.contains(event.target);
        const isClickOnHamburger = hamburgerMenu.contains(event.target);

        if (!isClickInsideMenu && !isClickOnHamburger) {
            hamburgerMenu.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });

    // Close menu on window resize if screen is larger than 768px
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            hamburgerMenu.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
});
