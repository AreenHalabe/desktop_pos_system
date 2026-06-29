import { navigateTo } from "./navigate/navigateTo.js";



function ChangeContent(page, element) {
    const content = document.getElementById('sub_content');
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    element.classList.add('active');
    navigateTo(page , content);
    
}

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            ChangeContent(page, this);
        });
    });
});




