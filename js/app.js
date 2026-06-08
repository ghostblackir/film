import { db, collection, getDocs, query, orderBy } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// کانفیگ پجینیشن (مثلاً هر صفحه حداکثر ۸ فیلم نشان دهد)
const ITEMS_PER_PAGE = 8;
let currentPage = 1;

let allMovies = [];        // منبع کل فیلم‌های دیتابیس
let filteredMovies = [];   // فیلم‌های فیلتر شده بر اساس سرچ یا هشتگ

async function initApp() {
    setupScrollTop();
    await fetchMovies();
    setupSearch();
}

// دریافت دیتای فیلم‌ها از فایربیس
async function fetchMovies() {
    const moviesColl = collection(db, 'movies');
    
    try {
        // دریافت کل فیلم‌ها برای اعمال منطق پجینیشن داینامیک فرانت‌اند
        const q = query(moviesColl, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        allMovies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filteredMovies = allMovies.filter(movie => movie.access !== 'vip');
        
        // در ابتدا فیلم‌های فیلتر شده همان کل فیلم‌ها هستند
        filteredMovies = [...allMovies];

        // ۱. رندر گرید اصلی (با پجینیشن)
        renderPaginatedGrid();

        // ۲. رندر گرید محبوب‌ترین‌ها (بدون پجینیشن، ثابت حداکثر ۶ تا)
        const popularMovies = [...allMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
        renderMoviesGrid(popularMovies, 'popularMoviesGrid');
        
        // ۳. ساخت منوی هشتگ‌ها
        renderTagsFilter(allMovies);
        
    } catch (error) {
        console.error("خطا در دریافت اطلاعات: ", error);
    }
}

// محاسبه و رندر صفحه جاری گرید اصلی
function renderPaginatedGrid() {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const moviesToDisplay = filteredMovies.slice(startIndex, endIndex);

    renderMoviesGrid(moviesToDisplay, 'latestMoviesGrid');
    renderPaginationControls();
}

// تولید دکمه‌های پجینیشن عددی
function renderPaginationControls() {
    const paginationBox = document.getElementById('paginationBox');
    if (!paginationBox) return;
    paginationBox.innerHTML = '';

    const totalPages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return; // اگر کل فیلم‌ها کمتر از یک صفحه بود دکمه‌ای نشان نده

    // دکمه صفحه قبل
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="bi bi-chevron-right"></i>'; // راست به چپ
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { currentPage--; renderPaginatedGrid(); window.scrollTo({top: 400, behavior: 'smooth'}); });
    paginationBox.appendChild(prevBtn);

    // دکمه‌های عددی صفحات
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderPaginatedGrid();
            window.scrollTo({top: 400, behavior: 'smooth'}); // اسکرول نرم به ابتدای گرید فیلم‌ها
        });
        paginationBox.appendChild(pageBtn);
    }

    // دکمه صفحه بعد
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { currentPage++; renderPaginatedGrid(); window.scrollTo({top: 400, behavior: 'smooth'}); });
    paginationBox.appendChild(nextBtn);
}

// تابع رندر گرید فیلم‌ها در فایل js/app.js (نسخه فوق پیشرفته و هوشمند)
function renderMoviesGrid(moviesList, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (moviesList.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 40px;">هیچ فیلمی یافت نشد.</p>`;
        return;
    }

    moviesList.forEach(movie => {
        const card = document.createElement('a');
        
        // شرط جادویی: اگر فیلم VIP بود، کاربر هدایت می‌شود به صفحه ثبت‌نام/وی‌آی‌پی
        if (movie.access === 'vip') {
            card.href = 'vip.html';
            card.className = 'movie-card vip-locked-card'; // کلاس مخصوص برای استایل سفارشی
        } else {
            card.href = `movie.html?id=${movie.id}`;
            card.className = 'movie-card';
        }
        
        // اگر فیلم VIP بود، تگ بَجِ تاج طلایی به بالای کاور تزریق می‌شود
        const vipBadgeHTML = movie.access === 'vip' ? `<div class="vip-badge-tag"><i class="bi bi-crown-fill"></i> VIP</div>` : '';

        card.innerHTML = `
            <div class="card-img-wrapper">
                ${vipBadgeHTML}
                <img data-src="${movie.thumbnail}" alt="${movie.title}" class="lazy-img">
                <span class="card-duration">${movie.duration}</span>
            </div>
            <div class="card-info">
                <h4 class="card-title">${movie.title}</h4>
                <div class="card-meta">
                    <span><i class="bi bi-eye-fill" style="color:var(--purple-primary); margin-left:4px;"></i>${movie.views || 0} بازدید</span>
                    ${movie.access === 'vip' ? '<span style="color:#ffd700; font-size:0.8rem; font-weight:bold; margin-right:auto;"><i class="bi bi-lock-fill"></i> ویژه</span>' : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    handleLazyLoading();
}

// مدیریت و فیلتر هشتگ‌ها
function renderTagsFilter(movies) {
    const tagsSlider = document.getElementById('tagsSlider');
    if (!tagsSlider) return;

    const tagsSet = new Set();
    movies.forEach(movie => {
        if (Array.isArray(movie.tags)) {
            movie.tags.forEach(tag => tagsSet.add(tag.trim()));
        }
    });

    tagsSet.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag-badge';
        span.setAttribute('data-tag', tag);
        span.textContent = `# ${tag}`;
        tagsSlider.appendChild(span);
    });

    const badges = tagsSlider.querySelectorAll('.tag-badge');
    badges.forEach(badge => {
        badge.addEventListener('click', (e) => {
            badges.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const selectedTag = e.currentTarget.getAttribute('data-tag');
            currentPage = 1; // ریست صفحه به ۱ پس از تغییر فیلتر

            if (selectedTag === 'all') {
                filteredMovies = [...allMovies];
            } else {
                filteredMovies = allMovies.filter(m => m.tags && m.tags.includes(selectedTag));
            }
            renderPaginatedGrid();
        });
    });
}

// سیستم جستجوی زنده و پیشرفته
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    const performSearch = () => {
        const queryText = searchInput.value.toLowerCase().trim();
        currentPage = 1; // بازگشت به صفحه اول هنگام سرچ جدید

        // غیرفعال کردن اکتیو هشتگ‌ها موقع سرچ آزاد
        const badges = document.querySelectorAll('.tag-badge');
        badges.forEach(b => b.classList.remove('active'));
        if(badges[0]) badges[0].classList.add('active');

        if (queryText === '') {
            filteredMovies = [...allMovies];
            renderPaginatedGrid();
            return;
        }

        filteredMovies = allMovies.filter(movie => {
            const titleMatch = movie.title?.toLowerCase().includes(queryText);
            const descMatch = movie.description?.toLowerCase().includes(queryText);
            const tagMatch = movie.tags?.some(tag => tag.toLowerCase().includes(queryText));
            return titleMatch || descMatch || tagMatch;
        });

        renderPaginatedGrid();
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(); });
}

// Lazy Loading تصاویر
function handleLazyLoading() {
    const lazyImages = document.querySelectorAll('.lazy-img');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.getAttribute('data-src');
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => observer.observe(img));
    } else {
        lazyImages.forEach(img => { img.src = img.getAttribute('data-src'); img.classList.add('loaded'); });
    }
}

// دکمه اسکرول به بالا
function setupScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) { btn.style.display = 'block'; } 
        else { btn.style.display = 'none'; }
    });
    btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
}
