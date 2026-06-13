import { db, collection, query, orderBy, onSnapshot } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

const ITEMS_PER_PAGE = 8;
let currentPage = 1;

let allMovies = [];        
let filteredMovies = [];   
let hasInitializedTags = false; // جلوگیری از رندرهای تکراری و آزاردهنده هشتگ‌ها در حالت زنده

async function initApp() {
    setupScrollTop();
    initLiveMovies(); // راه‌اندازی شنود زنده
    setupSearch();
}

// گوش دادن زنده و بدون رفرش به تغییرات فایربیس
function initLiveMovies() {
    const moviesColl = collection(db, 'movies');
    const q = query(moviesColl, orderBy('createdAt', 'desc'));
    
    // باز کردن تونل زنده با دیتابیس فایربیس
    onSnapshot(q, (snapshot) => {
        // واکشی کل اطلاعات موجود در لحظه
        allMovies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // فیلتر فیلم‌های مجاز برای صفحه اصلی (حذف شورت ویدیوها از گرید اصلی)
        const homeMovies = allMovies.filter(movie => movie.access !== 'shorts');

        // آپدیت آرایه فیلترها بر اساس دیتای جدید زنده
        const activeTag = document.querySelector('.tag-badge.active')?.getAttribute('data-tag') || 'all';
        if (activeTag === 'all') {
            filteredMovies = [...homeMovies];
        } else {
            filteredMovies = homeMovies.filter(m => m.tags && m.tags.includes(activeTag));
        }

        // ۱. رندر خودکار و زنده گرید اصلی (با پجینیشن)
        renderPaginatedGrid();

        // ۲. رندر خودکار و زنده گرید محبوب‌ترین‌ها (حداکثر ۶ تا)
        const popularMovies = [...homeMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
        renderMoviesGrid(popularMovies, 'popularMoviesGrid');
        
        // ۳. ساخت یا به‌روزرسانی منوی هشتگ‌ها (فقط برای بار اول یا تغییرات کلی تا منو نپرد)
        if (!hasInitializedTags && allMovies.length > 0) {
            renderTagsFilter(homeMovies);
            hasInitializedTags = true;
        }
        
    }, (error) => {
        console.error("خطا در سیستم دریافت زنده دیتابیس: ", error);
        // اگر در لود اولیه خطایی خورد، کادرها را پاک کند
        const latestGrid = document.getElementById('latestMoviesGrid');
        if (latestGrid) latestGrid.innerHTML = `<p style="color:red; text-align:center; grid-column:1/-1;">خطا در اتصال به سرور فایربیس.</p>`;
    });
}

function renderPaginatedGrid() {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const moviesToDisplay = filteredMovies.slice(startIndex, endIndex);

    renderMoviesGrid(moviesToDisplay, 'latestMoviesGrid');
    renderPaginationControls();
}

function renderPaginationControls() {
    const paginationBox = document.getElementById('paginationBox');
    if (!paginationBox) return;
    paginationBox.innerHTML = '';

    const totalPages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { currentPage--; renderPaginatedGrid(); window.scrollTo({top: 400, behavior: 'smooth'}); });
    paginationBox.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderPaginatedGrid();
            window.scrollTo({top: 400, behavior: 'smooth'});
        });
        paginationBox.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { currentPage++; renderPaginatedGrid(); window.scrollTo({top: 400, behavior: 'smooth'}); });
    paginationBox.appendChild(nextBtn);
}

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
        
        if (movie.access === 'vip') {
            card.href = 'vip.html';
            card.className = 'movie-card vip-locked-card';
        } else {
            card.href = `movie.html?id=${movie.id}`;
            card.className = 'movie-card';
        }
        
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

    // پاک کردن تگ‌های قدیمی به جز تگ "همه فیلم‌ها"
    const allBadge = tagsSlider.querySelector('[data-tag="all"]');
    tagsSlider.innerHTML = '';
    if(allBadge) tagsSlider.appendChild(allBadge);

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
            currentPage = 1;

            // فیلتر کردن فقط روی فیلم‌های غیر از شورت ویدیو
            const homeMovies = allMovies.filter(movie => movie.access !== 'shorts');

            if (selectedTag === 'all') {
                filteredMovies = [...homeMovies];
            } else {
                filteredMovies = homeMovies.filter(m => m.tags && m.tags.includes(selectedTag));
            }
            renderPaginatedGrid();
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    const performSearch = () => {
        const queryText = searchInput.value.toLowerCase().trim();
        currentPage = 1;

        const badges = document.querySelectorAll('.tag-badge');
        badges.forEach(b => b.classList.remove('active'));
        if(badges[0]) badges[0].classList.add('active');

        const homeMovies = allMovies.filter(movie => movie.access !== 'shorts');

        if (queryText === '') {
            filteredMovies = [...homeMovies];
            renderPaginatedGrid();
            return;
        }

        filteredMovies = homeMovies.filter(movie => {
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

function setupScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    if(!btn) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) { btn.style.display = 'block'; } 
        else { btn.style.display = 'none'; }
    });
    btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

document.addEventListener("DOMContentLoaded", () => {
    const preloader = document.getElementById("cyber-preloader");
    const percentText = document.getElementById("load-percentage");
    const terminal = document.querySelector(".loading-terminal");
    const radarCircles = document.querySelectorAll(".radar-circle");
    const scanner = document.querySelector(".cyber-scanner");
    const ageGateBox = document.getElementById("ageGateBox");
    
    const btnAccept = document.getElementById("btnAcceptAge");
    const btnReject = document.getElementById("btnRejectAge");
    
    if (!preloader || !percentText) return;

    let count = 0;
    
    // ۱. تایمر ماتریکسی همیشه و هر دفعه اجرا می‌شود
    const counterInterval = setInterval(() => {
        let increment = Math.floor(Math.random() * 3) + 1;
        
        if ((count > 30 && count < 35) || (count > 68 && count < 74)) {
            increment = Math.random() > 0.7 ? 1 : 0; 
        }

        count += increment;

        if (count >= 100) {
            count = 100;
            clearInterval(counterInterval);
            
            // چک کردن حافظه مرورگر: آیا قبلاً تأیید سن انجام شده؟
            const isAlreadyVerified = localStorage.getItem("ghostMovies_ageVerified") === "true";

            if (isAlreadyVerified) {
                // ⚡ حالت اول: کاربر قبلاً تأیید کرده -> متن سبز می‌شود و مستقیم وارد سایت می‌شود
                const statusText = document.querySelector(".status-text");
                if(statusText) {
                    statusText.innerText = "ACCESS GRANTED. DECRYPTING...";
                    statusText.style.color = "#00ffcc";
                    statusText.style.textShadow = "0 0 10px rgba(0, 255, 204, 0.6)";
                }
                
                setTimeout(() => {
                    preloader.classList.add("preloader-hidden");
                }, 800);

            } else {
                // ⚠️ حالت دوم: بار اول کاربر است -> کادر تأیید سن باز می‌شود
                const statusText = document.querySelector(".status-text");
                if(statusText) {
                    statusText.innerText = "SECURITY GATE TRIGGERED...";
                    statusText.style.color = "#ffd700";
                    statusText.style.textShadow = "0 0 10px rgba(255, 215, 0, 0.5)";
                }
                
                setTimeout(() => {
                    if(terminal) terminal.style.opacity = "0";
                    if(scanner) scanner.style.opacity = "0";
                    radarCircles.forEach(circle => circle.style.opacity = "0.1"); 
                    
                    if(ageGateBox) ageGateBox.classList.add("show-gate");
                }, 800);
            }
        }
        
        percentText.innerText = count < 10 ? '0' + count : count;
    }, 45);

    // ۲. مدیریت کلیک روی دکمه ورود (فقط برای بار اول)
    if(btnAccept) {
        btnAccept.addEventListener("click", () => {
            // ذخیره در حافظه مرورگر
            localStorage.setItem("ghostMovies_ageVerified", "true");
            // محو شدن لودر
            preloader.classList.add("preloader-hidden");
        });
    }

    // ۳. مدیریت دکمه خروج
    if(btnReject) {
        btnReject.addEventListener("click", () => {
            alert("جهت ورود به پلتفرم باید سن شما بالای ۱۸ سال باشد.");
            window.location.href = "https://www.google.com"; 
        });
    }
});