import { db, collection, query, orderBy, onSnapshot } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

const ITEMS_PER_PAGE = 12;
let currentPage = 1;

let allMovies = [];        
let filteredMovies = [];   
let hasInitializedTags = false; // جلوگیری از رندرهای تکراری و آزاردهنده هشتگ‌ها در حالت زنده

async function initApp() {
    setupScrollTop();
    initLiveMovies(); // راه‌اندازی شنود زنده
    setupSearch();
    // متدهای اضافه شده برای آمار فیک و بازی
    initFakeMembersOscillator();
    setupCyberGame()
}

// گوش دادن زنده و بدون رفرش به تغییرات فایربیس (نسخه اصلاح شده فوق امن)
function initLiveMovies() {
    const moviesColl = collection(db, 'movies');
    const seriesColl = collection(db, 'series'); 
    
    const qMovies = query(moviesColl, orderBy('createdAt', 'desc'));
    const qSeries = query(seriesColl, orderBy('createdAt', 'desc'));
    
    onSnapshot(qMovies, (movieSnapshot) => {
        allMovies = movieSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        onSnapshot(qSeries, (seriesSnapshot) => {
            const allSeries = seriesSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                isSeries: true, // 🌟 پرچم شناسایی سریال اصلی
                thumbnail: doc.data().coverUrl || '', // ست کردن کاور اصلی سریال
                title: doc.data().title || 'بدون عنوان',
                views: doc.data().views || 0,
                likes: doc.data().likes || 0,
                createdAt: doc.data().createdAt
            }));

            // ۱. حذف پارت‌های فرعی بدون کاور (series_part_X) از گرید اصلی
            const cleanMovies = allMovies.filter(movie => !movie.id.startsWith('series_'));

            // اعمال فیلتر آفتاب‌پرست
            const filteredCleanMovies = cleanMovies.filter(movie => 
                movie.access !== 'shorts' && (movie.mMode || 1) === (window.chameleonMode || 1)
            );
            const filteredCleanSeries = allSeries.filter(series => 
                (series.mMode || 1) === (window.chameleonMode || 1)
            );

            // ترکیب نهایی فیلم‌ها و سریال‌های اصلی دیتابیس برای نمایش در خانه
            const homeMovies = [...filteredCleanMovies, ...filteredCleanSeries].sort((a, b) => {
                const dateA = a.createdAt?.seconds || new Date(a.createdAt).getTime() || 0;
                const dateB = b.createdAt?.seconds || new Date(b.createdAt).getTime() || 0;
                return dateB - dateA;
            });

            const activeTag = document.querySelector('.tag-badge.active')?.getAttribute('data-tag') || 'all';
            if (activeTag === 'all') {
                filteredMovies = [...homeMovies];
            } else {
                filteredMovies = homeMovies.filter(m => m.tags && m.tags.includes(activeTag));
            }

            // رندر کردن گریدها
            renderPaginatedGrid();

            // پردازش آمار کل سایت (کدهای اصلی خودت)
            const totalMovies = allMovies.length;
            let totalViews = 0;
            let totalLikes = 0;
            allMovies.forEach(movie => {
                totalViews += (movie.views || 0);
                totalLikes += (movie.likes || 0); 
            });
            if(totalLikes === 0) totalLikes = Math.floor(totalViews * 0.12); 

            const elMoviesCount = document.getElementById('totalMoviesCount');
            const elViewsCount = document.getElementById('totalViewsCount');
            const elLikesCount = document.getElementById('totalLikesCount');
            if(elMoviesCount) elMoviesCount.innerText = totalMovies;
            if(elViewsCount) elViewsCount.innerText = totalViews.toLocaleString('fa-IR');
            if(elLikesCount) elLikesCount.innerText = totalLikes.toLocaleString('fa-IR');

            const popularMovies = [...homeMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
            renderMoviesGrid(popularMovies, 'popularMoviesGrid');
            
            if (!hasInitializedTags && homeMovies.length > 0) {
                const tagsContainer = document.getElementById('tagsContainer') || document.querySelector('.tags-filter-wrapper') || document.querySelector('.tags-container');
                if (tagsContainer) tagsContainer.innerHTML = ''; 
                renderTagsFilter(homeMovies); 
                hasInitializedTags = true;
            }
        });
    }, (error) => {
        console.error("خطا در سیستم دریافت زنده دیتابیس: ", error);
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

    // --- تابع کمکی برای ساخت دکمه‌ها ---
    const createBtn = (text, pageNumber, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = text;
        btn.disabled = isDisabled;
        btn.addEventListener('click', () => {
            currentPage = pageNumber;
            renderPaginatedGrid();
            renderPaginationControls();
            window.scrollTo({ top: 400, behavior: 'smooth' });
        });
        return btn;
    };

    // 1. دکمه رفتن به اول (<<)
    paginationBox.appendChild(createBtn('«', 1, false, currentPage === 1));

    // 2. دکمه قبلی (<)
    paginationBox.appendChild(createBtn('<', currentPage - 1, false, currentPage === 1));

    // --- منطق پنجره لغزان ---
    let startPage = Math.max(1, currentPage - 2); // 2 صفحه قبل از جاری
    let endPage = Math.min(totalPages, currentPage + 2); // 2 صفحه بعد از جاری

    // اگر اول مسیر هستیم، بازه رو بیشتر به راست بکش
    if (currentPage <= 3) endPage = Math.min(totalPages, 5);
    // اگر آخر مسیر هستیم، بازه رو بیشتر به چپ بکش
    if (currentPage >= totalPages - 2) startPage = Math.max(1, totalPages - 4);

    // رندر کردن اعداد
    for (let i = 1; i <= totalPages; i++) {
        // فقط اعدادی که در بازه هستند یا اولی و آخری هستند را نمایش بده
        if (i === 1 || i === totalPages || (i >= startPage && i <= endPage)) {
            paginationBox.appendChild(createBtn(i, i, currentPage === i));
        } else if (i === startPage - 1 || i === endPage + 1) {
            // نمایش سه نقطه برای فاصله
            const span = document.createElement('span');
            span.textContent = '...';
            span.className = 'pagination-dots';
            paginationBox.appendChild(span);
        }
    }

    // 3. دکمه بعدی (>)
    paginationBox.appendChild(createBtn('>', currentPage + 1, false, currentPage === totalPages));

    // 4. دکمه رفتن به آخر (>>)
    paginationBox.appendChild(createBtn('»', totalPages, false, currentPage === totalPages));
}

function renderMoviesGrid(moviesList, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (moviesList.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 40px;">هیچ فیلم یا سریالی یافت نشد.</p>`;
        return;
    }

    const now = new Date().getTime();

    moviesList.forEach(movie => {
        // ⚡ تشخیص هوشمند: آیا این کارت مربوط به یک سریال اصلی است؟
        const isSeries = movie.isSeries === true;

        // بررسی هوشمند وضعیت VIP فیلم‌ها (برای سریال‌ها نیازی نیست چون خودش سیستم قفل داخلی دارد)
        let currentAccess = movie.access;
        if (!isSeries && currentAccess === 'free' && movie.freeUntil) {
            const targetTime = new Date(movie.freeUntil).getTime();
            if (targetTime <= now) {
                currentAccess = 'vip'; 
            }
        }

        const card = document.createElement('a');
        
        // ⚡🔒 مدیریت و تنظیم هوشمند آدرس لینک و کلاس‌ها (حل مشکل مسیریابی و ارور)
        if (isSeries) {
            // اگر سریال بود، مستقیم هدایت میشه به فرکانس صفحه سریال‌ها
            card.href = 'series.html';
            card.className = 'movie-card series-main-card';
        } else if (currentAccess === 'vip') {
            card.href = 'vip.html';
            card.className = 'movie-card vip-locked-card';
        } else {
            card.href = `movie.html?id=${movie.id}`;
            card.className = 'movie-card';
        }
        
        // تگ‌های وضعیت (VIP یا سریال)
        let badgeHTML = '';
        if (isSeries) {
            // لیبل بنفش سایبربانکی برای مشخص کردن سریال‌ها در صفحه اصلی
            badgeHTML = `<div class="vip-badge-tag" style="background: #8b5cf6 !important; box-shadow: 0 0 10px #8b5cf6;"><i class="bi bi-collection-play-fill"></i> سریال</div>`;
        } else if (currentAccess === 'vip') {
            badgeHTML = `<div class="vip-badge-tag"><i class="bi bi-crown-fill"></i> VIP</div>`;
        }

        // ⏳ بررسی وضعیت نمایش تایمر زنده (فقط برای فیلم‌های معمولی رایگان و زمان‌دار)
        let timerHTML = '';
        if (!isSeries && currentAccess === 'free' && movie.freeUntil) {
            timerHTML = `
                <div class="card-timer-badge" data-countdown="${movie.freeUntil}">
                    <i class="bi bi-clock-history"></i>
                    <span class="countdown-text">--:--:--</span>
                </div>
            `;
        }

        // حل مشکل ۴۰۴ تصویر: اگر سریال بود و فیلد thumbnail خالی بود، از تصویر پشتیبان استفاده کنه
        const fallbackCover = 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=400';
        const finalThumbnail = movie.thumbnail || fallbackCover;
        const finalDuration = movie.duration || 'مجموعه';

        card.innerHTML = `
            <div class="card-img-wrapper">
                ${badgeHTML}
                ${timerHTML}
                <img data-src="${finalThumbnail}" alt="${movie.title}" class="lazy-img">
                <span class="card-duration">${finalDuration}</span>
            </div>
            <div class="card-info">
                <h4 class="card-title">${movie.title}</h4>
                <div class="card-meta">
                    <span><i class="bi bi-eye-fill" style="color:var(--purple-primary); margin-left:4px;"></i>${movie.views || 0} بازدید</span>
                    
                    <span class="vip-status-area" style="${(currentAccess === 'vip' || isSeries) ? '' : 'display:none;'} color:${isSeries ? '#8b5cf6' : '#ffd700'}; font-size:0.8rem; font-weight:bold; margin-right:auto;">
                        <i class="bi ${isSeries ? 'bi-folder-fill' : 'bi-lock-fill'}"></i> ${isSeries ? 'کالکشن' : 'ویژه'}
                    </span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // فعال کردن لود تنبل تصاویر خودت
    if (typeof handleLazyLoading === 'function') {
        handleLazyLoading();
    }
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

// موتور بررسی خودکار تایمرها و انقضای فیلم‌های رایگان
setInterval(() => {
    const activeCountdowns = document.querySelectorAll('[data-countdown]');
    const now = new Date().getTime();
    let needReRender = false;

    activeCountdowns.forEach(badge => {
        const targetDateStr = badge.getAttribute('data-countdown');
        const targetTime = new Date(targetDateStr).getTime();
        const timeLeft = targetTime - now;

        const textElement = badge.querySelector('.countdown-text');

        if (timeLeft <= 0) {
            needReRender = true;
        } else {
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            const pad = (num) => String(num).padStart(2, '0');

            if (days > 0) {
                if (textElement) textElement.innerText = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            } else {
                if (textElement) textElement.innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            }
        }
    });

    // اگر زمان فیلمی صفر شد، گریدها رو با فیلتر دقیق آفتاب‌پرست مجدداً رندر کن
    if (needReRender && typeof allMovies !== 'undefined' && allMovies.length > 0) {
        
        // 🌟 فیلتر فوق‌العاده سبک، سریع و کاملاً بدون ارور بر اساس فرکانس فعال سیستم
        const homeMovies = allMovies.filter(movie => 
            movie.access !== 'shorts' && 
            (movie.mMode || 1) === (window.chameleonMode || 1)
        );
         
        // رندر مجدد سکشن‌های اصلی سایت با وضعیت جدید قفل‌ها (کدهای اصلی خودت)
        if (document.getElementById('latestMoviesGrid')) {
            renderMoviesGrid(homeMovies.slice(0, ITEMS_PER_PAGE), 'latestMoviesGrid');
        }
        if (document.getElementById('popularMoviesGrid')) {
            const popular = [...homeMovies].sort((a, b) => (b.views || 0) - (a.views || 0));
            renderMoviesGrid(popular.slice(0, 4), 'popularMoviesGrid');
        }
    }
}, 1000);

// موتور هوشمند نوسان اعضای آنلاین (فیک و طبیعی)
function initFakeMembersOscillator() {
    const elMembers = document.getElementById('fakeMembersCount');
    if (!elMembers) return;

    let baseMembers = Math.floor(Math.random() * 300) + 1200; // عدد پایه بین ۱۲۰۰ تا ۱۵۰۰

    setInterval(() => {
        // ایجاد یک نوسان رندوم بین -۷ تا +۸ کارشناسانه تا ضایه نباشد
        const fluctuation = Math.floor(Math.random() * 16) - 7;
        baseMembers += fluctuation;

        // مهار مرز بالا و پایین برای حفظ چارچوب آمار
        if (baseMembers < 1000) baseMembers = 1200;
        if (baseMembers > 2000) baseMembers = 1400;

        elMembers.innerText = baseMembers.toLocaleString('fa-IR');
    }, 3500); // هر ۳.۵ ثانیه سیگنال را تغییر دهد
}

// موتور پردازشی میکرو-گیم کلیکر
function setupCyberGame() {
    const coreBtn = document.getElementById('cyberCoreBtn');
    const scoreText = document.getElementById('gameScore');
    const energyText = document.getElementById('energyPercent');

    if (!coreBtn || !scoreText || !energyText) return;

    let score = 0;
    let energy = 84;

    coreBtn.addEventListener('click', () => {
        score += 10;
        if (energy < 100) energy += 1;

        scoreText.innerText = score;
        energyText.innerText = `${energy}%`;

        // تغییر رنگ موقتی دکمه برای پاسخ گرافیکی به کلیک
        coreBtn.style.borderColor = '#00ffcc';
        setTimeout(() => {
            coreBtn.style.borderColor = 'var(--purple-primary)';
        }, 150);
    });

    // کاهش تدریجی انرژی شبکه با گذر زمان برای به چالش کشیدن کاربر
    setInterval(() => {
        if (energy > 40) {
            energy -= 1;
            energyText.innerText = `${energy}%`;
        }
    }, 8000);
}

// =========================================================================
// کنترلر مرکزی آفتاب‌پرست (بچسبانید به انتهای فایل app.js - بدون تداخل و ارور)
// =========================================================================
window.chameleonMode = 1;
(async function initChameleonCore() {
    try {
        const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        onSnapshot(doc(db, 'settings', 'networkConfig'), (configSnapshot) => {
            if (configSnapshot.exists()) {
                const newMode = configSnapshot.data().currentMode || 1;
                
                if (window.chameleonMode !== newMode) {
                    window.chameleonMode = newMode;
                    
                    // 🌟 قفل هشتگ‌ها باز میشه تا کدهای بالا بتونن کل هشتگ‌های منو رو ریست و غیب کنن
                    hasInitializedTags = false; 
                    
                    if (typeof initLiveMovies === 'function') {
                        initLiveMovies();
                    }
                }
            }
        });
    } catch(e) { 
        console.log("خطا در بارگذاری زنده فرکانس آفتاب‌پرست:", e); 
    }
})();
// 🔒 پروتکل ضد Inspect و ضد کلیک راست ماتریکس GHOST
document.addEventListener('contextmenu', e => e.preventDefault()); // بستن کامل کلیک راست

document.addEventListener('keydown', e => {
    // بستن F12
    if (e.key === 'F12') {
        e.preventDefault();
        return false;
    }
    // بستن Ctrl+Shift+I (Inspect) و Ctrl+Shift+J (Console) و Ctrl+U (View Source)
    if (e.ctrlKey && (e.shiftKey && (e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'i') || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});