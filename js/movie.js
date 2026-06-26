import { db, auth, doc, getDoc, updateDoc, increment, collection, getDocs, addDoc, query, where, limit, orderBy } from './firebase.js';

let activeReplyCommentId = null;
let allSimilarMovies = [];
let displayedSimilarCount = 5;

// ⚡ متغیرهای سراسری سیستم دانلود و ویدیو ⚡
let targetDownloadUrl = "";
let targetMovieTitle = "";
let isAdChecked = false; // بررسی اینکه آیا تبلیغ یکبار پخش شده یا نه
let movieDataGlobal = null; // ذخیره اطلاعات فیلم برای استفاده در زمان پلی

document.addEventListener('DOMContentLoaded', () => {
    loadMovieDetails();
    setupEmojiPicker();
    setupModalActions();
});

// 📌 کادر اختصاصی شیک برای جایگزینی آلرت‌ها
function showCustomAlert(title, message, isSuccess = false) {
    let alertOverlay = document.getElementById('customAlertOverlay');
    if (!alertOverlay) {
        alertOverlay = document.createElement('div');
        alertOverlay.id = 'customAlertOverlay';
        alertOverlay.innerHTML = `
            <div class="custom-alert-card">
                <div class="custom-alert-icon"></div>
                <h3 id="customAlertTitle"></h3>
                <p id="customAlertMessage"></p>
                <button id="customAlertCloseBtn">فهمیدم</button>
            </div>
        `;
        document.body.appendChild(alertOverlay);

        const style = document.createElement('style');
        style.innerHTML = `
            #customAlertOverlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
                display: flex; justify-content: center; align-items: center; z-index: 999999;
            }
            .custom-alert-card {
                background: #1a202c; border: 2px solid var(--purple-primary, #8b5cf6);
                width: 90%; max-width: 380px; padding: 25px; border-radius: 12px;
                text-align: center; color: #fff; box-shadow: 0 0 15px rgba(139, 92, 246, 0.3);
            }
            .custom-alert-icon { font-size: 2.5rem; margin-bottom: 10px; }
            .custom-alert-card h3 { font-size: 1.2rem; margin-bottom: 10px; font-weight: bold; }
            .custom-alert-card p { font-size: 0.95rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px; }
            #customAlertCloseBtn {
                background: var(--purple-primary, #8b5cf6); color: #fff; border: none;
                padding: 8px 25px; border-radius: 6px; cursor: pointer; font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('customAlertTitle').textContent = title;
    document.getElementById('customAlertMessage').textContent = message;

    const iconEl = alertOverlay.querySelector('.custom-alert-icon');
    iconEl.innerHTML = isSuccess ? '✅' : '⚠️';
    alertOverlay.style.display = 'flex';
    document.getElementById('customAlertCloseBtn').onclick = () => { alertOverlay.style.display = 'none'; };
}

async function loadMovieDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // ⚡ ۱. بررسی هوشمند برای پارت‌های سریال GHOST SERIES
    const isLiveSeries = urlParams.get('live');
    if (isLiveSeries === 'true') {
        const savedUrl = localStorage.getItem('targetDownloadUrl');
        const savedTitle = localStorage.getItem('targetMovieTitle');
        const customPartId = localStorage.getItem('targetPartId') || 'default_part_id'; // دریافت آیدی جادویی

        if (savedUrl) {
            document.title = `${savedTitle || "پخش سریال"} - GHOST MOVIES`;
            
            const loadingEl = document.getElementById('movieLoading');
            const contentEl = document.getElementById('movieContent');
            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');

            // 🎬 راه‌اندازی پلیر اختصاصی تو
            initCustomPlayer(savedUrl, '');

            // متادیتای متنی پارت سریال
            if (document.getElementById('movieTitle')) {
                document.getElementById('movieTitle').textContent = savedTitle || "پخش سریال GHOST";
            }
            if (document.getElementById('movieDescription')) {
                document.getElementById('movieDescription').textContent = "در حال استریم پارت انتخاب شده از شبکه ماتریکس GHOST SERIES.";
            }

            // تنظیم مقادیر سراسری دانلود
            targetDownloadUrl = savedUrl;
            targetMovieTitle = savedTitle || "Serial_Part";

            try {
                // 👁️ بخش بازدید زنده پارت سریال (دقیقاً مثل سیستم فیلم‌های خودت)
                const { doc, getDoc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const partDocRef = doc(db, 'movies', customPartId); // ذخیره آمار پارت‌ها در کالکشن movies با آیدی منحصربه‌فرد
                let partDoc = await getDoc(partDocRef);

                // ایجاد مستند موقت در دیتابیس اگر وجود نداشت تا لایک و بازدید کار کنه
                if (!partDoc.exists()) {
                    const { setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await setDoc(partDocRef, {
                        title: savedTitle,
                        video: savedUrl,
                        views: 0,
                        createdAt: serverTimestamp()
                    });
                    partDoc = await getDoc(partDocRef);
                }

                const partData = partDoc.data();
                movieDataGlobal = partData;

                // افزایش بازدید هوشمند یکبار مصرف برای هر پارت
                if (!sessionStorage.getItem(`viewed_${customPartId}`)) {
                    await updateDoc(partDocRef, { views: increment(1) });
                    sessionStorage.setItem(`viewed_${customPartId}`, 'true');
                    partData.views = (partData.views || 0) + 1;
                }

                // نمایش زمان و بازدید واقعی پارت سریال
                if (document.getElementById('movieViews')) {
                    document.getElementById('movieViews').innerHTML = `<i class="bi bi-eye-fill"></i> ${partData.views || 0} بازدید پارت`;
                }
                if (document.getElementById('movieDuration')) {
                    document.getElementById('movieDuration').innerHTML = `<i class="bi bi-clock-history"></i> استریم سریال`;
                }

                // ⚡ فعال‌سازی لایک‌ها و کامنت‌های اختصاصی همین پارت!
                setupLikes(customPartId, partDocRef, partData);
                setupComments(customPartId);

            } catch (err) {
                console.error("Error setting up series part stats:", err);
            }

            // پنهان کردن فیلم‌های مشابه چون نیازی نیست
            const similarMoviesSection = document.querySelector('.similar-movies');
            if (similarMoviesSection) similarMoviesSection.style.display = 'none';
            
            if (typeof setupCoinDownloadTrigger === 'function') {
                setupCoinDownloadTrigger();
            }

            return; // 🛑 خروج فوری
        }
    }

    // 🎬 ۲. روند اصلی و قبلی خودت برای فیلم‌های معمولی (بدون هیچ تغییری)
    const movieId = urlParams.get('id');

    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const movieDocRef = doc(db, 'movies', movieId);
        const movieDoc = await getDoc(movieDocRef);

        if (!movieDoc.exists()) {
            showCustomAlert('خطا', 'فیلم مورد نظر یافت نشد!');
            window.location.href = 'index.html';
            return;
        }

        const movieData = movieDoc.data();
        movieDataGlobal = movieData; 

        if (!sessionStorage.getItem(`viewed_${movieId}`)) {
            await updateDoc(movieDocRef, { views: increment(1) });
            sessionStorage.setItem(`viewed_${movieId}`, 'true');
            movieData.views = (movieData.views || 0) + 1;
        }

        document.title = `${movieData.title} - GHOST MOVIES`;
        document.getElementById('movieLoading').classList.add('hidden');
        document.getElementById('movieContent').classList.remove('hidden');

        initCustomPlayer(movieData.video, movieData.thumbnail);

        document.getElementById('movieTitle').textContent = movieData.title;
        document.getElementById('movieDescription').textContent = movieData.description;
        document.getElementById('movieViews').innerHTML = `<i class="bi bi-eye-fill"></i> ${movieData.views || 0} بازدید`;
        document.getElementById('movieDuration').innerHTML = `<i class="bi bi-clock-history"></i> ${movieData.duration || 'نامشخص'}`;

        const tagsContainer = document.getElementById('movieTags');
        tagsContainer.innerHTML = '';
        if (Array.isArray(movieData.tags)) {
            movieData.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'mini-tag';
                span.textContent = `#${tag.trim()}`;
                tagsContainer.appendChild(span);
            });
        }

        targetDownloadUrl = movieData.video;
        targetMovieTitle = movieData.title;
        setupCoinDownloadTrigger();

        setupLikes(movieId, movieDocRef, movieData);
        setupComments(movieId);
        fetchSimilarMovies(movieData.tags, movieId);

    } catch (error) {
        console.error(error);
        showCustomAlert('خطا', 'مشکلی در دریافت اطلاعات از سرور به وجود آمد.');
    }
}

/* ==========================================================================
   ۱. مدیریت سیستم تبلیغات هوشمند (فراخوانی بعد از کلیک روی پلی)
   ========================================================================== */
async function handleAdvertisement(onAdComplete) {
    if (isAdChecked) {
        onAdComplete(); // اگر قبلا تبلیغ دیده شده، مستقیم ویدیو پخش شود
        return;
    }

    try {
        const adDocRef = doc(db, 'settings', 'current_ad');
        const adSnap = await getDoc(adDocRef);

        if (!adSnap.exists()) {
            isAdChecked = true;
            onAdComplete();
            return;
        }

        const adData = adSnap.data();
        const adVideoSrc = adData.videoUrl;
        const adLinkHref = adData.targetUrl;

        if (!adVideoSrc || adVideoSrc === '') {
            isAdChecked = true;
            onAdComplete();
            return;
        }

        const adOverlay = document.getElementById('adOverlay');
        const adVideo = document.getElementById('adVideo');
        const adLinkBtn = document.getElementById('adLinkBtn');
        const adSkipBtn = document.getElementById('adSkipBtn');

        // فعال‌سازی لایه تبلیغ روی پلیر اصلی
        adOverlay.classList.remove('hidden');
        adVideo.src = adVideoSrc;
        adLinkBtn.href = adLinkHref || '#';
        adVideo.load();

        // الان چون کاربر خودش روی دکمه پلی کلیک کرده، مرورگر با صدا اجازه پخش خودکار تبلیغ رو میده!
        adVideo.play().catch(err => console.log("خطا در پخش تبلیغ:", err));

        let timeLeft = 10;
        adSkipBtn.disabled = true;
        adSkipBtn.style.cursor = 'not-allowed';
        adSkipBtn.style.opacity = '0.6';
        adSkipBtn.textContent = `منتظر بمانید (${timeLeft})...`;

        let countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                adSkipBtn.textContent = `منتظر بمانید (${timeLeft})...`;
            } else {
                clearInterval(countdownInterval);
                adSkipBtn.textContent = "رد کردن تبلیغ";
                adSkipBtn.removeAttribute('disabled');
                adSkipBtn.style.cursor = 'pointer';
                adSkipBtn.style.opacity = '1';
            }
        }, 1000);

        const closeAd = () => {
            clearInterval(countdownInterval);
            adVideo.pause();
            adOverlay.classList.add('hidden');
            isAdChecked = true; // ثبت وضعیت نمایش تبلیغ برای این سشن
            onAdComplete();
        };

        adSkipBtn.onclick = closeAd;
        adVideo.onended = closeAd;

    } catch (err) {
        console.error("خطا در واکشی تبلیغات: ", err);
        isAdChecked = true;
        onAdComplete();
    }
}

/* ==========================================================================
   ۲. کنترلر اختصاصی ویدیو پلیر (اصلاح شده برای دکمه پلی و مدیریت تبلیغات)
   ========================================================================== */
function initCustomPlayer(videoUrl, thumbnailUrl) {
    const player = document.getElementById('ghostPlayer');
    const recOverlay = document.getElementById('recommendationOverlay');
    let countdownInterval;
    const spinner = document.getElementById('videoSpinner');
    const source = document.getElementById('videoSource');
    const container = document.getElementById('customVideoPlayer');

    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const progressBar = document.getElementById('progressBar');
    const bufferedBar = document.getElementById('bufferedBar');
    const progressContainer = document.getElementById('progressContainer');
    const currentTimeEl = document.getElementById('currentTime');
    const totalDurationEl = document.getElementById('totalDuration');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // دسترسی به المان‌های تبلیغ برای چک کردن وضعیت تفکیک شده
    const adOverlay = document.getElementById('adOverlay');
    const adVideo = document.getElementById('adVideo');

    source.src = videoUrl;
    if (thumbnailUrl) player.poster = thumbnailUrl;
    player.load();

    // ۱. هندل کردن مستقیم خطا
    player.addEventListener('error', (e) => {
        handleVideoError();
    });

    // ۲. هندل کردن زمانی که ویدیو برای مدت طولانی متوقف می‌ماند
    player.addEventListener('stalled', () => {
        setTimeout(() => {
            if (player.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                handleVideoError();
            }
        }, 5000);
    });

    player.addEventListener('ended', () => {
        recOverlay.classList.remove('hidden');
        let timeLeft = 5;
        const countdownEl = document.getElementById('countdown');

        countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownEl) countdownEl.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                if (allSimilarMovies && allSimilarMovies.length > 0) {
                    const nextMovie = allSimilarMovies[0];
                    window.location.href = `movie.html?id=${nextMovie.id}`;
                }
            }
        }, 1000);
    });

    // مدیریت بافرینگ ویدیو اصلی
    player.addEventListener('waiting', () => { if (adOverlay.classList.contains('hidden')) spinner.classList.remove('hidden'); });
    player.addEventListener('playing', () => { spinner.classList.add('hidden'); });
    player.addEventListener('loadstart', () => { if (adOverlay.classList.contains('hidden')) spinner.classList.remove('hidden'); });
    player.addEventListener('canplay', () => { spinner.classList.add('hidden'); });

    // 🌟 رویداد کلیک روی خود ویدیوها (تشخیص خودکار تبلیغ یا ویدیو اصلی)
    player.onclick = handlePlayInteraction;
    adVideo.onclick = handlePlayInteraction;
    playPauseBtn.onclick = handlePlayInteraction;

    function handlePlayInteraction() {
        // الف) اگر تبلیغ در حال نمایش است، دکمه پلی/استپ تبلیغ را کنترل کند
        if (!adOverlay.classList.contains('hidden')) {
            if (adVideo.paused) {
                adVideo.play().then(() => {
                    playPauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                }).catch(err => console.log(err));
            } else {
                adVideo.pause();
                playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
            }
            return;
        }

        // ب) اگر هنوز تبلیغ اصلاً چک یا باز نشده، آن را لود و اجرا کن
        if (!isAdChecked) {
            handleAdvertisement(() => {
                executeActualPlay();
            });
        } else {
            executeActualPlay();
        }
    }

    function executeActualPlay() {
        if (player.paused) {
            const playPromise = player.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    playPauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                }).catch(error => {
                    console.log("پخش خودکار مسدود شد:", error);
                });
            }
        } else {
            player.pause();
            playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        }
    }

    // هماهنگ‌سازی آیکون دکمه پلی در صورتی که تبلیغ خودش تمام شد یا از جای دیگری Play شد
    adVideo.addEventListener('play', () => { playPauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>'; });
    adVideo.addEventListener('pause', () => { playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>'; });

    player.addEventListener('timeupdate', () => {
        const pct = (player.currentTime / player.duration) * 100;
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(player.currentTime);
    });

    player.addEventListener('loadedmetadata', () => {
        if (totalDurationEl) totalDurationEl.textContent = formatTime(player.duration);
    });

    player.addEventListener('progress', () => {
        if (player.buffered.length > 0 && player.duration > 0) {
            const bufferedEnd = player.buffered.end(player.buffered.length - 1);
            if (bufferedBar) bufferedBar.style.width = `${(bufferedEnd / player.duration) * 100}%`;
        }
    });

    if (progressContainer) {
        progressContainer.onclick = (e) => {
            // نوار پیشرفت فقط برای ویدیو اصلی کار کند و روی تبلیغ قفل باشد
            if (!adOverlay.classList.contains('hidden')) return;
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            player.currentTime = pos * player.duration;
        };
    }

    // 🌟 هوشمند کردن سیستم قطع و وصل کردن صدا (Mute) برای تبلیغ و ویدیو اصلی
    muteBtn.onclick = () => {
        if (!adOverlay.classList.contains('hidden')) {
            // کنترل صدای تبلیغ
            adVideo.muted = !adVideo.muted;
            player.muted = adVideo.muted; // برای هماهنگی هر دو
            muteBtn.innerHTML = adVideo.muted ? '<i class="bi bi-volume-mute-fill"></i>' : '<i class="bi bi-volume-up-fill"></i>';
            volumeSlider.value = adVideo.muted ? 0 : adVideo.volume;
        } else {
            // کنترل صدای ویدیو اصلی
            player.muted = !player.muted;
            muteBtn.innerHTML = player.muted ? '<i class="bi bi-volume-mute-fill"></i>' : '<i class="bi bi-volume-up-fill"></i>';
            volumeSlider.value = player.muted ? 0 : player.volume;
        }
    };

    // 🌟 هوشمند کردن تغییر اسلایدر صدا برای تبلیغ و ویدیو اصلی
    volumeSlider.oninput = (e) => {
        const val = e.target.value;
        if (!adOverlay.classList.contains('hidden')) {
            adVideo.volume = val;
            adVideo.muted = (val == 0);
            player.volume = val;
            player.muted = (val == 0);
        } else {
            player.volume = val;
            player.muted = (val == 0);
        }
        muteBtn.innerHTML = (val == 0) ? '<i class="bi bi-volume-mute-fill"></i>' : '<i class="bi bi-volume-up-fill"></i>';
    };

    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => showCustomAlert('خطا', err.message));
            fullscreenBtn.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
        } else {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i class="bi bi-fullscreen"></i>';
        }
    };

    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

/* ==========================================================================
   ۳. سیستم دانلود سکه‌ای واقعی و هوشمند متصل به اکانت سرور فایربیس
   ========================================================================== */
function getLoggedInUserId() {
    if (auth && auth.currentUser) return auth.currentUser.uid;
    const localUserId = localStorage.getItem('userId') || localStorage.getItem('user_id');
    if (localUserId) return localUserId;
    return "5YSwLatrhreJxwL6lvyfsRjyF5B2"; // UID پیش‌فرض اکانت شما
}

function setupCoinDownloadTrigger() {
    const downloadBtn = document.getElementById('downloadBtn');
    if (!downloadBtn) return;

    downloadBtn.onclick = async (e) => {
        e.preventDefault();
        const userId = getLoggedInUserId();
        const modal = document.getElementById('downloadCoinModal');
        const modalCoinsStatus = document.getElementById('modalUserCoins');

        modalCoinsStatus.textContent = "در حال ارتباط با سرور...";
        modal.style.display = "flex";

        try {
            const userDocRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                modalCoinsStatus.textContent = userSnap.data().coins !== undefined ? userSnap.data().coins : 0;
            } else {
                modalCoinsStatus.textContent = "0";
            }
        } catch (err) {
            modalCoinsStatus.textContent = "خطای ارتباط";
        }
    };
}

function setupModalActions() {
    const modal = document.getElementById('downloadCoinModal');
    const confirmBtn = document.getElementById('confirmDownloadBtn');
    const cancelBtn = document.getElementById('cancelDownloadBtn');

    if (!modal) return;

    cancelBtn.onclick = () => { modal.style.display = "none"; };

    confirmBtn.onclick = async () => {
        const userId = getLoggedInUserId();
        confirmBtn.disabled = true;
        confirmBtn.textContent = "در حال کسر سکه...";

        try {
            const userDocRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userDocRef);

            if (!userSnap.exists()) {
                modal.style.display = "none";
                showCustomAlert('خطا', '❌ اکانت کاربر یافت نشد!');
                return;
            }

            const currentCoins = userSnap.data().coins || 0;
            if (currentCoins < 50) {
                modal.style.display = "none";
                showCustomAlert('موجودی ناكافی', `❌ سکه شما کافی نیست! موجودی فعلی: ${currentCoins}`);
                return;
            }

            await updateDoc(userDocRef, { coins: increment(-50) });
            modal.style.display = "none";
            showCustomAlert('تراکنش موفق', `🎉 ۵۰ سکه کسر شد. دانلود آغاز شد.`, true);

            const tempLink = document.createElement('a');
            tempLink.href = targetDownloadUrl;
            tempLink.target = '_blank';
            tempLink.download = targetMovieTitle;
            tempLink.click();

        } catch (error) {
            showCustomAlert('خطای سرور', 'مشکلی در ارتباط با سرور پیش آمد.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "⚡ تایید و دانلود";
        }
    };
}

/* ==========================================================================
   ۴. فرم نظرات هوشمند و ایموجی پیکر بدون باگ Vanilla
   ========================================================================== */
function setupEmojiPicker() {
    const textarea = document.getElementById('commentText');
    const emojiBtn = document.getElementById('emojiToggleBtn');

    if (!textarea || !emojiBtn) return;

    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
        '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
        '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
        '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
        '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
        '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
        '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
        '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
        '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄',
        '💋', '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💖', '💗',
        '💓', '💞', '💕', '💟', '❣️', '💘', '💝', '💟', '🌟', '⭐', '✨', '⚡', '💥', '🔥', '🎉', '🎈'
    ];

    let pickerContainer = document.getElementById('ghostEmojiPicker');
    if (!pickerContainer) {
        pickerContainer = document.createElement('div');
        pickerContainer.id = 'ghostEmojiPicker';

        let emojiGridHtml = '';
        emojis.forEach(emoji => {
            emojiGridHtml += `<span class="ghost-emoji-item">${emoji}</span>`;
        });

        pickerContainer.innerHTML = `
            <div class="emoji-scroll-grid">
                ${emojiGridHtml}
            </div>
        `;

        Object.assign(pickerContainer.style, {
            position: 'fixed',
            width: '280px',
            background: '#151520',
            border: '2px solid #8b5cf6',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(139, 92, 246, 0.5)',
            zIndex: '999999',
            display: 'none',
            direction: 'rtl'
        });

        document.body.appendChild(pickerContainer);

        const style = document.createElement('style');
        style.innerHTML = `
            .emoji-scroll-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 8px;
                max-height: 200px;
                overflow-y: auto;
                padding: 12px;
                direction: rtl;
            }
            .ghost-emoji-item {
                font-size: 1.4rem;
                padding: 4px;
                cursor: pointer;
                text-align: center;
                transition: transform 0.1s ease;
                user-select: none;
            }
            .ghost-emoji-item:hover {
                transform: scale(1.3);
            }
            .emoji-scroll-grid::-webkit-scrollbar { width: 5px; }
            .emoji-scroll-grid::-webkit-scrollbar-thumb { background: #8b5cf6; border-radius: 10px; }
            .emoji-scroll-grid::-webkit-scrollbar-track { background: #0b0b0f; }
        `;
        document.head.appendChild(style);
    }

    function repositionPicker() {
        const rect = emojiBtn.getBoundingClientRect();
        // قرار دادن دقیق باکس در بالای دکمه با احتساب طول خود باکس (حدود ۲۳۰ پیکسل ارتفاع دارد)
        pickerContainer.style.top = `${rect.top - 235}px`;
        pickerContainer.style.left = `${rect.left}px`;
    }

    // 🌟 راهکار اصلی: استفاده از addEventListener و جلوگیری از انتشار کلیک (stopPropagation)
    emojiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // 👈 جلوی بسته شدن آنی باکس رو می‌گیره

        if (pickerContainer.style.display === 'none') {
            repositionPicker();
            pickerContainer.style.display = 'block';
        } else {
            pickerContainer.style.display = 'none';
        }
    });

    window.addEventListener('resize', () => {
        if (pickerContainer.style.display === 'block') repositionPicker();
    });

    // ثبت رویداد کلیک روی خود ایموجی‌ها به صورت امن
    pickerContainer.querySelectorAll('.ghost-emoji-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation(); // جلوگیری از بسته شدن باکس موقع کلیک روی خود ایموجی
            textarea.value += item.textContent;
            textarea.focus();
        };
    });

    document.addEventListener('click', (e) => {
        if (!pickerContainer.contains(e.target) && e.target !== emojiBtn && !emojiBtn.contains(e.target)) {
            pickerContainer.style.display = 'none';
        }
    });
}

function setupComments(movieId) {
    const commentForm = document.getElementById('commentForm');
    const commentsList = document.getElementById('commentsList');
    const commentsCount = document.getElementById('commentsCount');
    const replyIndicator = document.getElementById('replyIndicator');
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');

    const commentsCollectionRef = collection(db, 'movies', movieId, 'comments');

    cancelReplyBtn.onclick = () => {
        activeReplyCommentId = null;
        replyIndicator.classList.add('hidden');
    };

    const loadComments = async () => {
        try {
            const q = query(commentsCollectionRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            commentsList.innerHTML = '';
            commentsCount.textContent = snapshot.size;

            if (snapshot.empty) {
                commentsList.innerHTML = `<p style="color: var(--text-muted); font-size:0.9rem;">هنوز دیدگاهی ثبت نشده است. اولین نظر را شما بنویسید!</p>`;
                return;
            }

            snapshot.forEach(docSnap => {
                const comment = docSnap.data();
                const commentId = docSnap.id;
                const dateStr = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleDateString('fa-IR') : 'به‌تازگی';

                const item = document.createElement('div');
                item.className = comment.parentId ? 'comment-item-pro comment-reply-item' : 'comment-item-pro';

                item.innerHTML = `
                    <div class="comment-avatar"><i class="bi bi-person-circle"></i></div>
                    <div class="comment-body">
                        <div class="comment-meta">
                            <span class="comment-user">${comment.name} ${comment.parentId ? '<span class="reply-badge">پاسخ</span>' : ''}</span>
                            <span class="comment-date">${dateStr}</span>
                        </div>
                        <p class="comment-text">${comment.text}</p>
                        <div class="comment-actions-bar">
                            <button class="comment-heart-btn" data-id="${commentId}">
                                <i class="bi bi-heart-fill"></i> <span class="heart-count">${comment.hearts || 0}</span>
                            </button>
                            <button class="comment-reply-btn" data-id="${commentId}" data-user="${comment.name}">
                                <i class="bi bi-reply-fill"></i> پاسخ
                            </button>
                        </div>
                    </div>
                `;
                commentsList.appendChild(item);
            });

            document.querySelectorAll('.comment-heart-btn').forEach(btn => {
                btn.onclick = async () => {
                    const cId = btn.getAttribute('data-id');
                    const countEl = btn.querySelector('.heart-count');
                    btn.classList.toggle('hearted');
                    let inc = btn.classList.contains('hearted') ? 1 : -1;
                    countEl.textContent = parseInt(countEl.textContent) + inc;
                    await updateDoc(doc(db, 'movies', movieId, 'comments', cId), { hearts: increment(inc) });
                };
            });

            document.querySelectorAll('.comment-reply-btn').forEach(btn => {
                btn.onclick = () => {
                    activeReplyCommentId = btn.getAttribute('data-id');
                    replyIndicator.querySelector('span').textContent = `در حال پاسخ به نظر ${btn.getAttribute('data-user')}:`;
                    replyIndicator.classList.remove('hidden');
                    document.getElementById('commentText').focus();
                };
            });

        } catch (error) { console.error(error); }
    };

    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('commenterName');
        const emailInput = document.getElementById('commenterEmail');
        const textInput = document.getElementById('commentText');

        try {
            await addDoc(commentsCollectionRef, {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                text: textInput.value.trim(),
                createdAt: new Date(),
                parentId: activeReplyCommentId,
                hearts: 0
            });

            textInput.value = '';
            activeReplyCommentId = null;
            replyIndicator.classList.add('hidden');
            showCustomAlert('سپاس', 'دیدگاه شما ثبت شد.', true);
            loadComments();
        } catch (error) { console.error(error); }
    };

    loadComments();
}

/* ==========================================================================
   ۵. سیستم فیلم‌های مشابه
   ========================================================================== */
function fetchSimilarMovies(tags, currentId) {
    const grid = document.getElementById('similarMoviesGrid');
    const loadMoreBtn = document.getElementById('loadMoreSimilarBtn');

    if (!tags || tags.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">فیلم مشابهی یافت نشد.</p>';
        return;
    }

    try {
        const q = query(collection(db, 'movies'), where('tags', 'array-contains', tags[0]), limit(15));
        getDocs(q).then(snapshot => {
            allSimilarMovies = [];
            snapshot.forEach(doc => {
                if (doc.id !== currentId) allSimilarMovies.push({ id: doc.id, ...doc.data() });
            });

            if (allSimilarMovies.length >= 2) {
                showRecommendations(allSimilarMovies);
            }

            if (allSimilarMovies.length === 0) {
                grid.innerHTML = '<p style="color:var(--text-muted)">فیلم مشابهی یافت نشد.</p>';
                return;
            }

            renderSimilarGrid();
            if (allSimilarMovies.length > displayedSimilarCount) loadMoreBtn.classList.remove('hidden');

            loadMoreBtn.onclick = () => {
                displayedSimilarCount += 10;
                renderSimilarGrid();
                if (displayedSimilarCount >= allSimilarMovies.length) loadMoreBtn.classList.add('hidden');
            };
        });
    } catch (error) { console.error(error); }
}

function renderSimilarGrid() {
    const grid = document.getElementById('similarMoviesGrid');
    grid.innerHTML = '';
    allSimilarMovies.slice(0, displayedSimilarCount).forEach(movie => {
        const card = document.createElement('a');
        card.href = `movie.html?id=${movie.id}`;
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${movie.thumbnail}" alt="${movie.title}" style="opacity:1;">
                <span class="card-duration">${movie.duration || ''}</span>
            </div>
            <div class="card-info"><h4 class="card-title">${movie.title}</h4></div>
        `;
        grid.appendChild(card);
    });
}

/* ==========================================================================
   ۶. سیستم لایک و دیس‌لایک یکبار مصرف و هوشمند مرورگر
   ========================================================================== */
function setupLikes(movieId, movieDocRef, movieData) {
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    const likeCount = document.getElementById('likeCount');
    const dislikeCount = document.getElementById('dislikeCount');

    likeCount.textContent = movieData.likes || 0;
    dislikeCount.textContent = movieData.dislikes || 0;

    let userVote = localStorage.getItem(`vote_${movieId}`);

    if (userVote === 'like') likeBtn.classList.add('active');
    if (userVote === 'dislike') dislikeBtn.classList.add('active');

    likeBtn.onclick = async () => {
        if (likeBtn.classList.contains('active')) {
            showCustomAlert('رأی ثبت شده', 'شما قبلاً این فیلم را لایک کرده‌اید!');
            return;
        }

        if (userVote === 'dislike') {
            dislikeBtn.classList.remove('active');
            dislikeCount.textContent = Math.max(0, parseInt(dislikeCount.textContent) - 1);
            likeBtn.classList.add('active');
            likeCount.textContent = parseInt(likeCount.textContent) + 1;
            localStorage.setItem(`vote_${movieId}`, 'like');
            userVote = 'like';
            await updateDoc(movieDocRef, { likes: increment(1), dislikes: increment(-1) });
        } else {
            likeBtn.classList.add('active');
            likeCount.textContent = parseInt(likeCount.textContent) + 1;
            localStorage.setItem(`vote_${movieId}`, 'like');
            userVote = 'like';
            await updateDoc(movieDocRef, { likes: increment(1) });
        }
    };

    dislikeBtn.onclick = async () => {
        if (dislikeBtn.classList.contains('active')) {
            showCustomAlert('رأی ثبت شده', 'شما قبلاً این فیلم را دیس‌لایک کرده‌اید!');
            return;
        }

        if (userVote === 'like') {
            likeBtn.classList.remove('active');
            likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
            dislikeBtn.classList.add('active');
            dislikeCount.textContent = parseInt(dislikeCount.textContent) + 1;
            localStorage.setItem(`vote_${movieId}`, 'dislike');
            userVote = 'dislike';
            await updateDoc(movieDocRef, { dislikes: increment(1), likes: increment(-1) });
        } else {
            dislikeBtn.classList.add('active');
            dislikeCount.textContent = parseInt(dislikeCount.textContent) + 1;
            localStorage.setItem(`vote_${movieId}`, 'dislike');
            userVote = 'dislike';
            await updateDoc(movieDocRef, { dislikes: increment(1) });
        }
    };
}
function showRecommendations(similarMovies) {
    const rec1 = document.getElementById('rec1');
    const rec2 = document.getElementById('rec2');

    if (similarMovies && similarMovies.length >= 2) {
        rec1.querySelector('img').src = similarMovies[0].thumbnail;
        rec2.querySelector('img').src = similarMovies[1].thumbnail;

        rec1.onclick = () => {
            clearInterval(countdownInterval);
            window.location.href = `movie.html?id=${similarMovies[0].id}`;
        };
        rec2.onclick = () => {
            clearInterval(countdownInterval);
            window.location.href = `movie.html?id=${similarMovies[0].id}`;
        };
    }
}

// تابع مرکزی برای نمایش پیام
function handleVideoError() {
    if (spinner) spinner.classList.add('hidden'); // مخفی کردن لودینگ

    // جلوگیری از نمایش چندباره پیام
    if (document.getElementById('customAlertOverlay')) return;

    showCustomAlert(
        'اوخ! یک مشکلی پیش اومد',
        'مشکلی پیش اومد دادا، یه فیلم دیگه ببین شاید خوشت اومد، اینم بگم تقصیر تو نی تقصیر روزگاره!'
    );

    // تغییر دکمه برای هدایت به صفحه اصلی
    const closeBtn = document.getElementById('customAlertCloseBtn');
    if (closeBtn) {
        closeBtn.innerText = "برو به لیست فیلم‌ها";
        closeBtn.onclick = () => {
            window.location.href = 'index.html';
        };
    }
}

// =========================================================================
// لایه ریدایرکت اضطراری آفتاب‌پرست (اضافه شده به انتهای فایل movie.js)
// =========================================================================
(async function initChameleonMovieGuard() {
    // ایجاد یک تاخیر کوچک برای اطمینان از لود شدن متغیر movieDataGlobal کدهای شما
    setTimeout(async () => {
        try {
            // ۱. ایمپورت زنده ابزارهای فایربیس
            const { doc, onSnapshot, collection, query, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

            let initialModeChecked = false;
            let currentActiveMode = 1;

            // ۲. شنود زنده وضعیت کلید سراسری سایت
            onSnapshot(doc(db, 'settings', 'networkConfig'), async (configSnapshot) => {
                if (!configSnapshot.exists()) return;

                const serverMode = configSnapshot.data().currentMode || 1;

                // اگر بار اول است که پیج لود شده، فقط وضعیت فعلی سرور را ذخیره کن و کاری نکن
                if (!initialModeChecked) {
                    currentActiveMode = serverMode;
                    initialModeChecked = true;
                    return;
                }

                // ۳. جادوی اصلی: اگر وسط تماشا، شما فرکانس سرور را تغییر دادی!
                if (currentActiveMode !== serverMode) {
                    currentActiveMode = serverMode;

                    // متوقف کردن پلیر فیلم فعلی شما برای قطع صدا و تصویر
                    const videoPlayer = document.getElementById('ghostPlayer');
                    if (videoPlayer) {
                        videoPlayer.pause();
                    }

                    // ۴. قفل کردن صفحه و نمایش پیغام باحال و گنگ شما وسط صفحه
                    showChameleonEmergencyOverlay();

                    // ۵. گرفتن تمام فیلم‌های فرکانس جدید از دیتابیس برای انتخاب رندوم
                    try {
                        const moviesSnap = await getDocs(query(collection(db, 'movies')));
                        const validMovies = [];

                        moviesSnap.forEach(doc => {
                            const data = doc.data();
                            const mMode = data.mMode || 1;
                            // تفکیک فیلم‌ها بر اساس فرکانس فعال جدید سرور (حذف شورت ویدیوها)
                            if (mMode === serverMode && data.access !== 'shorts') {
                                validMovies.push({ id: doc.id, ...data });
                            }
                        });

                        // ۶. تغییر اساسی برای جلوگیری از بازگشت کاربر
                        setTimeout(() => {
                            if (validMovies.length > 0) {
                                const randomMovie = validMovies[Math.floor(Math.random() * validMovies.length)];
                                const newUrl = `movie.html?id=${randomMovie.id}`;

                                // جایگزین کردن تاریخچه (به جای اضافه کردن)
                                // اینجوری دیگه دکمه بک، کاربر رو به فیلم سیاه برنمی‌گردونه!
                                window.location.replace(newUrl);
                            } else {
                                window.location.replace('index.html');
                            }
                        }, 3500);

                    } catch (err) {
                        window.location.href = 'index.html';
                    }
                }
            });
        } catch (e) { console.log(e); }
    }, 2000);
    // جلوگیری از بازگشت به عقب در صورت تغییر مود
    window.addEventListener('popstate', function (event) {
        // اگر کاربر در مود ۲ (سفید) هست، اجازه نده به عقب (فیلم سیاه) برگرده
        if (currentActiveMode === 2) {
            window.location.href = 'index.html';
        }
    });
})();

// 🎨 تابع ساخت باکس شیک سایبرپونکی برای پیغام اختصاصی شما
function showChameleonEmergencyOverlay() {
    // اگر از قبل کادر ساخته شده بود پاکش کن
    const oldOverlay = document.getElementById('chameleonEmergencyAlert');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'chameleonEmergencyAlert';
    overlay.innerHTML = `
        <div class="emergency-card" style="
            background: #11111b;
            border: 2px solid #ff0055;
            box-shadow: 0 0 30px #ff0055;
            padding: 30px;
            border-radius: 12px;
            max-width: 450px;
            width: 90%;
            text-align: center;
            direction: rtl;
            animation: glitchPop 0.3s ease-out;
        ">
            <div style="font-size: 50px; color: #ff0055; margin-bottom: 15px; animation: pulseGlow 1s infinite alternate;">
                ⚠️
            </div>
            <h3 style="color: #fff; margin-bottom: 15px; font-weight: bold; font-size: 18px;">اتصال موقت شبکه</h3>
            <p style="color: #ffd700; line-height: 1.8; font-size: 15px; margin-bottom: 20px; font-weight: 500;">
                دادا سرور شورشو در اورده میگه تا پولمو ندی منم اذیت میکنم.... شرمنده همین که اومد رو ببین تا پولشو بدیم
            </p>
            <div style="color: #666; font-size: 12px; font-family: monospace;">
                CONNECTING TO NEW FREQUENCY...
            </div>
        </div>
    `;

    // استایل‌های کلی پوشش کل صفحه
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 5, 10, 0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '999999',
        backdropFilter: 'blur(8px)'
    });

    // انیمیشن تزریقی سریع برای جذابیت بیشتر
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        @keyframes glitchPop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes pulseGlow { from { transform: scale(1); filter: drop-shadow(0 0 2px #ff0055); } to { transform: scale(1.1); filter: drop-shadow(0 0 15px #ff0055); } }
    `;
    document.head.appendChild(styleTag);
    document.body.appendChild(overlay);
}
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