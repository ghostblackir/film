import { db, collection, getDocs, query, orderBy, limit, where } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let allMovies = [];

async function initApp() {
    setupScrollTop();
    await fetchMovies();
    setupSearch();
}

// واکشی همه‌جانبه فیلم‌ها از Firestore
async function fetchMovies() {
    const moviesColl = collection(db, 'movies');
    
    try {
        // ۱. دریافت جدیدترین فیلم‌ها
        const latestQuery = query(moviesColl, orderBy('createdAt', 'desc'), limit(12));
        const latestSnapshot = await getDocs(latestQuery);
        allMovies = latestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // ۲. دریافت محبوب‌ترین فیلم‌ها
        const popularQuery = query(moviesColl, orderBy('views', 'desc'), limit(6));
        const popularSnapshot = await getDocs(popularQuery);
        const popularMovies = popularSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // رندر کردن داده‌ها روی رابط کاربری
        renderMoviesGrid(allMovies, 'latestMoviesGrid');
        renderMoviesGrid(popularMovies, 'popularMoviesGrid');
        
        // استخراج و رندر هشتگ‌ها
        renderTagsFilter(allMovies);
        
    } catch (error) {
        console.error("خطا در دریافت اطلاعات فیلم‌ها: ", error);
    }
}

// تولید کارت فیلم و رندر درون گرید همراه با Lazy Loading روی تصاویر
function renderMoviesGrid(moviesList, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (moviesList.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 20px;">هیچ فیلمی یافت نشد.</p>`;
        return;
    }

    moviesList.forEach(movie => {
        const card = document.createElement('a');
        card.href = `movie.html?id=${movie.id}`;
        card.className = 'movie-card';
        
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img data-src="${movie.thumbnail}" alt="${movie.title}" class="lazy-img">
                <span class="card-duration">${movie.duration}</span>
            </div>
            <div class="card-info">
                <h4 class="card-title">${movie.title}</h4>
                <div class="card-meta">
                <span><i class="bi bi-eye-fill"></i> ${movie.views || 0} بازدید</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    handleLazyLoading();
}

// ساخت فیلتر هشتگ‌ها به صورت پویا
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
        span.textContent = `#${tag}`;
        tagsSlider.appendChild(span);
    });

    // افزودن Event Listener کلیک به هشتگ‌ها
    const badges = tagsSlider.querySelectorAll('.tag-badge');
    badges.forEach(badge => {
        badge.addEventListener('click', (e) => {
            badges.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const selectedTag = e.target.getAttribute('data-tag');
            if (selectedTag === 'all') {
                renderMoviesGrid(allMovies, 'latestMoviesGrid');
            } else {
                const filtered = allMovies.filter(m => m.tags && m.tags.includes(selectedTag));
                renderMoviesGrid(filtered, 'latestMoviesGrid');
            }
        });
    });
}

// سیستم جستجو همزمان روی عنوان و توضیحات
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    const performSearch = () => {
        const queryText = searchInput.value.toLowerCase().trim();
        if (queryText === '') {
            renderMoviesGrid(allMovies, 'latestMoviesGrid');
            return;
        }

        const searchResults = allMovies.filter(movie => {
            const titleMatch = movie.title?.toLowerCase().includes(queryText);
            const descMatch = movie.description?.toLowerCase().includes(queryText);
            const tagMatch = movie.tags?.some(tag => tag.toLowerCase().includes(queryText));
            return titleMatch || descMatch || tagMatch;
        });

        renderMoviesGrid(searchResults, 'latestMoviesGrid');
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

// قابلیت پرفورمنسی Lazy Loading بومی مرورگر (Intersection Observer)
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
        // Fallback قدیمی در صورت عدم پشتیبانی مرورگر
        lazyImages.forEach(img => {
            img.src = img.getAttribute('data-src');
            img.classList.add('loaded');
        });
    }
}

// دکمه بازگشت به بالا چسبان
function setupScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}