document.addEventListener('DOMContentLoaded', () => {
    console.log('TEST APP LOADED');
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            screens.forEach(s => s.classList.remove('active'));
            screens[index].classList.add('active');
        });
    });
});
