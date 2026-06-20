// 1. اول از همه تابع الرت رو اورراید می‌کنیم تا کل فایل بشناسدش
window.alert = function (message) {
    const alertBox = document.createElement('div');
    alertBox.style.position = 'fixed';
    alertBox.style.top = '20px';
    alertBox.style.left = '50%';
    alertBox.style.transform = 'translateX(-50%)';
    alertBox.style.backgroundColor = '#1e1e2f';
    alertBox.style.color = '#fff';
    alertBox.style.padding = '15px 25px';
    alertBox.style.borderRadius = '8px';
    alertBox.style.border = '2px solid #ff2a74';
    alertBox.style.boxShadow = '0 0 15px rgba(255, 42, 116, 0.4)';
    alertBox.style.zIndex = '99999';
    alertBox.style.fontFamily = 'Vazir, Tahoma, sans-serif';
    alertBox.style.direction = 'rtl';
    alertBox.style.display = 'flex';
    alertBox.style.alignItems = 'center';
    alertBox.style.justifyContent = 'space-between';
    alertBox.style.gap = '20px';

    const textSpan = document.createElement('span');
    textSpan.innerText = message;
    alertBox.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#ff2a74';
    closeBtn.style.fontSize = '22px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.lineHeight = '1';

    closeBtn.onclick = function () { alertBox.remove(); };
    alertBox.appendChild(closeBtn);

    document.body.appendChild(alertBox);
    setTimeout(() => { if (alertBox.parentNode) alertBox.remove(); }, 5000);
};
import { db, auth, onSnapshot, doc, updateDoc, increment, collection, addDoc, query, orderBy, limit, setDoc, deleteDoc, getDoc } from "./firebase.js";

// المان‌های عمومی
const streamTitle = document.getElementById('stream-title');
const streamDescription = document.getElementById('stream-description');
const liveStatus = document.getElementById('live-status');
const likeCount = document.getElementById('like-count');
const likeBtn = document.getElementById('like-btn');
const liveViewers = document.getElementById('live-viewers');
const chatOnlineCount = document.getElementById('chat-online-count');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatSystemStatus = document.getElementById('chat-system-status');

// المان‌های جدید تایمر، ویدیو و نوتیفیکیشن
const playerDoc = document.getElementById('live-player');
const offlineGif = document.getElementById('offline-gif');
const countdownBox = document.getElementById('countdown-box');
const notifyBtn = document.getElementById('notify-btn');

const cdDays = document.getElementById('cd-days');
const cdHours = document.getElementById('cd-hours');
const cdMinutes = document.getElementById('cd-minutes');
const cdSeconds = document.getElementById('cd-seconds');

const player = videojs('live-player');
const streamDocRef = doc(db, "streams", "current");

let currentUser = null;
let isBanned = false;
let countdownInterval = null;
let notificationTriggered = false; // برای اینکه نوتیفیکیشن فقط یکبار بوق بزند
const ADMIN_EMAIL = "aqayghost@gmail.com";

// ۱. سیستم نوتیفیکیشن "به من خبر بده"
if (localStorage.getItem('live_notify_enabled') === 'true') {
    notifyBtn.classList.add('active');
    notifyBtn.querySelector('span').innerText = "اطلاع‌رسانی فعال شد";
}

notifyBtn.addEventListener('click', () => {
    if (!("Notification" in window)) {
        alert("مرورگر شما از سیستم اطلاع‌رسانی پشتیبانی نمی‌کند.");
        return;
    }

    if (Notification.permission === "granted") {
        toggleNotificationState();
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                toggleNotificationState();
            }
        });
    }
});

function toggleNotificationState() {
    if (notifyBtn.classList.contains('active')) {
        notifyBtn.classList.remove('active');
        notifyBtn.querySelector('span').innerText = "به من خبر بده";
        localStorage.setItem('live_notify_enabled', 'false');
    } else {
        notifyBtn.classList.add('active');
        notifyBtn.querySelector('span').innerText = "اطلاع‌رسانی فعال شد";
        localStorage.setItem('live_notify_enabled', 'true');
        new Notification("سایت آقای گوست", { body: "به محض شروع استریم، به شما خبر می‌دهیم!", icon: "https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png" });
    }
}

// ۲. بررسی وضعیت کاربران چت آنلاین
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        const banCheck = await getDoc(doc(db, "banned_users", user.uid));
        if (banCheck.exists()) {
            isBanned = true;
            updateChatAvailability(true, currentUser, true); // ارسال وضعیت بن شده
            return;
        }

        // کاربر لاگین شده و بن نیست -> وضعیت چت بررسی می‌شود (بر اساس وضعیت فعلی لایو در دیتابیس)
        const currentStatus = liveStatus.innerText;
        const isLiveNow = (currentStatus === "زنده" || currentStatus === "پخش ویدیو");
        updateChatAvailability(isLiveNow, currentUser, false);

        const userPresenceRef = doc(db, "online_users", user.uid);
        await setDoc(userPresenceRef, { name: user.displayName, email: user.email, timestamp: new Date() });
        window.addEventListener('beforeunload', () => { deleteDoc(userPresenceRef); });
        checkIfUserLiked();
    } else {
        currentUser = null;
        const currentStatus = liveStatus.innerText;
        const isLiveNow = (currentStatus === "زنده" || currentStatus === "پخش ویدیو");
        updateChatAvailability(isLiveNow, null, false);
    }
});

// ۳. دریافت آنی وضعیت لایو و مدیریت هوشمند شمارش معکوس (نسخه کاملاً اصلاح‌شده و ضد باگ ریست)
onSnapshot(streamDocRef, async (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        streamTitle.innerText = data.title || "بدون عنوان";

        // پاک کردن تایمر قبلی در صورت وجود تغییر در دیتابیس برای جلوگیری از تداخل
        if (countdownInterval) clearInterval(countdownInterval);

        let targetTime = data.scheduledAt;
        const now = Date.now();

        // 🔴 ج) اولویت اول: حالت کاملاً آفلاین معمولی (اگر ادمین لایو را قطع کرده و زمان آینده‌ای هم نیست)
        if (data.isLive === false && (!targetTime || now >= targetTime)) {
            countdownBox.style.display = "none";
            player.reset();
            playerDoc.style.display = "none";
            offlineGif.style.display = "block";
            liveStatus.innerText = "آفلاین";
            liveStatus.className = "status-tag offline";
            streamDescription.innerText = data.description || "";

            // گرفتن وضعیت واقعی لایو برای چت (که الان آفلاین است)
            updateChatAvailability(false, currentUser, isBanned);
            disableLikeButton();
        }
        // 🎯 الف) اگر زمان آینده ست شده و هنوز به آن زمان نرسیده‌ایم (حالت شمارش معکوس)
        else if (targetTime && now < targetTime && data.isLive === false) {
            countdownBox.style.display = "block";
            offlineGif.style.display = "block";
            playerDoc.style.display = "none";
            liveStatus.innerText = "زمان‌بندی شده";
            liveStatus.className = "status-tag offline";

            // فرمت کردن دستی زمان برای کپشن زیر ویدیو بدون بهم ریختگی
            const sObj = new Date(targetTime);
            const formattedTime = `${sObj.getFullYear()}/${String(sObj.getMonth() + 1).padStart(2, '0')}/${String(sObj.getDate()).padStart(2, '0')} ساعت ${String(sObj.getHours() % 12 || 12).padStart(2, '0')}:${String(sObj.getMinutes()).padStart(2, '0')} ${sObj.getHours() >= 12 ? 'PM' : 'AM'}`;
            streamDescription.innerText = `زمان پخش برنامه‌ریزی شده: ${formattedTime} \n ${data.description || ''}`;

            // راه‌اندازی تایمر معکوس ثانیه‌ای
            countdownInterval = setInterval(() => {
                const timeDiff = targetTime - Date.now();

                if (timeDiff <= 0) {
                    clearInterval(countdownInterval);
                    countdownBox.style.display = "none";

                    if (localStorage.getItem('live_notify_enabled') === 'true' && !notificationTriggered) {
                        new Notification("🔴 پخش زنده شروع شد!", { body: data.title });
                        notificationTriggered = true;
                    }
                    window.location.reload();
                } else {
                    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

                    cdDays.innerText = String(days).padStart(2, '0');
                    cdHours.innerText = String(hours).padStart(2, '0');
                    cdMinutes.innerText = String(minutes).padStart(2, '0');
                    cdSeconds.innerText = String(seconds).padStart(2, '0');
                }
            }, 1000);

            disableLikeButton();
        }
        // 🟢 ب) حالت زنده: اگر ادمین دکمه لایو فوری را زده یا زمان انتظار فرا رسیده/گذشته باشد (و لینک ویدیو موجود باشد)
        else if ((data.isLive === true || (targetTime && now >= targetTime)) && data.hlsUrl) {
            countdownBox.style.display = "none";
            offlineGif.style.display = "none";
            playerDoc.style.display = "block";
            liveStatus.className = "status-tag online";
            streamDescription.innerText = data.description || "";

            if (player.src() !== data.hlsUrl) {
                let videoType = 'application/x-mpegURL';
                const videoUrl = data.hlsUrl.toLowerCase();
                let isMp4 = false;

                if (videoUrl.includes('.mp4') || videoUrl.endsWith('.mp4')) {
                    videoType = 'video/mp4';
                    liveStatus.innerText = "پخش ویدیو";
                    isMp4 = true;
                } else {
                    liveStatus.innerText = "زنده";
                }

                player.src({ src: data.hlsUrl, type: videoType });
                updateChatAvailability(true, currentUser, isBanned);
                player.off('ended');

                // 🔥 بخش جادویی هماهنگ‌سازی زمان لایو برای MP4 (نسخه اصلاح شده و ضد باگ لود)
                if (isMp4) {
                    // اگر ادمین زمان‌بندی نکرده بود (لایو فوری)، زمان فعلی سیستم را مبدا قرار می‌دهیم تا خطا ندهد
                    const streamStartTime = targetTime || now;
                    const passedSeconds = Math.floor((Date.now() - streamStartTime) / 1000);

                    // استفاده از دستور آماده بودن پلیر برای جلوگیری از باگ نادیده گرفتن currentTime
                    player.ready(() => {
                        player.one('canplay', () => {
                            const videoDuration = player.duration();

                            if (passedSeconds > 0 && passedSeconds < videoDuration) {
                                // 🎯 انتقال قطعی کاربر به ثانیه هماهنگ لایو
                                player.currentTime(passedSeconds);
                                player.play().catch(() => { });
                            } else if (passedSeconds >= videoDuration && targetTime) {
                                // اگر تایم ویدیو گذشته بود و زمان‌بندی داشتیم، لایو تمام شده است
                                player.trigger('ended');
                            } else {
                                player.play().catch(() => { });
                            }
                        });
                    });
                } else {
                    // برای لینک‌های m3u8 (لایو واقعی) نیازی به محاسبه نیست
                    player.play().catch(() => { });
                }

                player.on('ended', () => {
                    playerDoc.style.display = "none";
                    offlineGif.style.display = "block";
                    liveStatus.innerText = "آفلاین";
                    liveStatus.className = "status-tag offline";
                    updateChatAvailability(false, currentUser, isBanned);
                });
            }

            enableLikeButton(data.likes || 0);
        }
    }
});

// توابع کمکی لایک دکمه
function disableLikeButton() {
    likeBtn.disabled = true;
    likeBtn.classList.remove('liked');
    likeBtn.style.opacity = "0.4";
    likeBtn.style.cursor = "not-allowed";
    likeCount.innerHTML = `<i class="fa-regular fa-heart"></i> 0`;
}

async function enableLikeButton(totalLikes) {
    if (currentUser) {
        try {
            // اضافه کردن هک فایربیس برای لود از کش در صورت قطع بودن نت
            const userLikeRef = doc(db, "streams", "current", "liked_users", currentUser.uid);
            const likeSnap = await getDoc(userLikeRef).catch(() => {
                console.log("دیتابیس در حالت آفلاین است؛ لود از کش مرورگر...");
            });

            if (likeSnap && likeSnap.exists()) {
                likeBtn.disabled = true;
                likeBtn.classList.add('liked');
            } else {
                likeBtn.disabled = false;
                likeBtn.classList.remove('liked');
                likeBtn.style.opacity = "1";
                likeBtn.style.cursor = "pointer";
            }
        } catch (e) {
            // اگر کلا نت نبود و کش هم خالی بود، دکمه رو باز بذار ولی ارور نده
            likeBtn.disabled = false;
            likeBtn.style.opacity = "1";
        }
    } else {
        likeBtn.disabled = false;
        likeBtn.style.opacity = "1";
    }
    const heartIcon = likeBtn.classList.contains('liked') ? 'fa-solid' : 'fa-regular';
    likeCount.innerHTML = `<i class="${heartIcon} fa-heart"></i> ${totalLikes}`;
}

// بقیه توابع (ثبت لایک، ارسال چت و نمایش لیست چت‌ها) بدون تغییر مثل فایل‌های قبلی زیر این خط کار می‌کنند...
likeBtn.addEventListener('click', async () => {
    if (!currentUser) { alert("لطفاً ابتدا وارد حساب کاربری خود شوید."); return; }
    likeBtn.disabled = true; likeBtn.classList.add('liked');
    const userLikeRef = doc(db, "streams", "current", "liked_users", currentUser.uid);
    try {
        const docSnap = await getDoc(userLikeRef);
        if (!docSnap.exists()) {
            await setDoc(userLikeRef, { liked: true });
            await updateDoc(streamDocRef, { likes: increment(1) });
        }
    } catch (error) { console.error(error); likeBtn.disabled = false; likeBtn.classList.remove('liked'); }
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ⛔ بررسی امنیتی قبل از ارسال
    // اگر کاربر لاگین نیست یا استریم آفلاین است، اجازه ارسال نده
    if (!currentUser) {
        alert("برای ارسال پیام ابتدا باید وارد حساب کاربری خود شوید.");
        return;
    }

    // فرض می‌کنیم یک متغیر سراسری یا روشی برای چک کردن وضعیت لایو دارید
    // (اگر ندارید، می‌توانید همان وضعیت دیتابیس را چک کنید)
    if (liveStatus.innerText === "آفلاین") {
        alert("در حال حاضر چت بسته است.");
        return;
    }

    const text = chatInput.value.trim();
    if (text === "") return;

    // ارسال به دیتابیس...
    await addDoc(collection(db, "streams", "current", "chat"), {
        text: text,
        user: currentUser.displayName,
        avatar: currentUser.photoURL,
        timestamp: new Date()
    });

    chatInput.value = "";
});

onSnapshot(collection(db, "online_users"), (snapshot) => { const count = snapshot.size; liveViewers.innerText = count; chatOnlineCount.innerText = count; });
const chatQuery = query(collection(db, "streams", "current", "chat"), orderBy("timestamp", "asc"), limit(70));
onSnapshot(chatQuery, (querySnapshot) => {
    chatMessages.innerHTML = '';

    // ۱. ساخت پیام سیستمی با حفظ دکمه و رنگ قرمز (innerHTML به جای innerText)
    const sDiv = document.createElement('div');
    sDiv.className = 'system-msg';
    sDiv.innerHTML = chatSystemStatus.innerHTML;
    chatMessages.appendChild(sDiv);

    // 🔥 ۲. فعال‌سازی مجدد کلیک روی دکمه "وارد شوید" که داخل چت کپی شده
    const insideChatLoginBtn = sDiv.querySelector('#chatLoginBtn');
    if (insideChatLoginBtn) {
        insideChatLoginBtn.onclick = function () {
            triggerChatGoogleLogin(insideChatLoginBtn);
        };
    }

    // ۳. رندر کردن بقیه پیام‌های کاربران
    querySnapshot.forEach((doc) => {
        const msg = doc.data();
        const msgElement = document.createElement('div');
        msgElement.className = 'chat-msg';

        let roleBadge = `<span class="badge user-badge">کاربر عادی</span>`;
        if (msg.email === ADMIN_EMAIL) {
            roleBadge = `<span class="badge admin-badge"><i class="fa-solid fa-circle-check"></i> ADMIN</span>`;
            msgElement.classList.add('admin-message-style');
        }

        msgElement.innerHTML = `
            <img src="${msg.avatar || 'https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png'}" class="chat-avatar">
            <div class="msg-body">
                <div class="msg-meta">
                    <span class="user-name">${msg.user}</span>${roleBadge}
                </div>
                <span class="text">${msg.text}</span>
            </div>
        `;
        chatMessages.appendChild(msgElement);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
});
async function checkIfUserLiked() { if (!currentUser) return; const docSnap = await getDoc(doc(db, "streams", "current", "liked_users", currentUser.uid)); if (docSnap.exists()) { likeBtn.classList.add('liked'); likeBtn.disabled = true; } }

// 🔥 تابع کمکی برای لاگین سریع با گوگل مخصوص دکمه درون چت
function triggerChatGoogleLogin(btnElement) {
    import('./firebase.js').then(async (firebaseModule) => {
        const { signInWithPopup, googleProvider, doc, getDoc, setDoc } = firebaseModule;

        btnElement.disabled = true;
        btnElement.innerText = "در حال اتصال...";

        signInWithPopup(auth, googleProvider)
            .then(async (result) => {
                const userDocRef = doc(db, 'users', result.user.uid);
                const userDoc = await getDoc(userDocRef);
                if (!userDoc.exists()) {
                    await setDoc(userDocRef, {
                        uid: result.user.uid,
                        email: result.user.email,
                        displayName: result.user.displayName || 'کاربر جدید',
                        photoURL: result.user.photoURL || '',
                        access: 'free',
                        coins: 150,
                        createdAt: new Date().toISOString()
                    });
                }
                location.reload();
            })
            .catch((error) => {
                btnElement.disabled = false;
                btnElement.innerText = "وارد شوید";
                if (error.code === 'auth/popup-closed-by-user') {
                    alert("پنجره ورود توسط شما بسته شد.");
                } else {
                    console.error("خطا در ورود:", error);
                    alert("خطایی در هنگام ورود رخ داد.");
                }
            });
    });
}

// تابع نهایی مدیریت دسترسی چت (نسخه ضد باگ و فورس استایل)
function updateChatAvailability(isLive, user, isBannedUser = false) {
    const chatForm = document.getElementById('chat-form');
    const chatSystemStatus = document.getElementById('chat-system-status');

    if (!chatForm || !chatSystemStatus) return;

    // ریست کردن استایل‌های قبلی برای اطمینان
    chatSystemStatus.style.color = "";
    chatSystemStatus.style.fontWeight = "";

    if (!isLive) {
        chatForm.style.display = "none";
        chatSystemStatus.innerHTML = `<span style="color: #8a8ab0;">استریم در حال حاضر آفلاین است.</span>`;
    } else if (!user) {
        // 🔴 اعمال استایل قرمز به صورت مستقیم روی خود باکس وضعیت (تضمینی)
        chatForm.style.display = "none";
        chatSystemStatus.style.color = "#ff2a74";
        chatSystemStatus.style.fontWeight = "bold";

        // ساختار داخلی پیام
        chatSystemStatus.innerHTML = `برای چت کردن لطفا <button id="chatLoginBtn" style="background: none; border: none; color: #ff2a74; font-weight: bold; text-decoration: underline; cursor: pointer; padding: 0 4px; font-size: inherit; font-family: inherit;">وارد شوید</button>.`;

        // فعال‌سازی رویداد کلیک دکمه قرمز
        const chatLoginBtn = document.getElementById('chatLoginBtn');
        if (chatLoginBtn) {
            chatLoginBtn.onclick = function () {
                triggerChatGoogleLogin(chatLoginBtn);
            };
        }
    } else if (isBannedUser) {
        chatForm.style.display = "none";
        chatSystemStatus.innerHTML = `<span style="color: #ef4444;">حساب کاربری شما مسدود شده است.</span>`;
    } else {
        chatForm.style.display = "flex";
        chatSystemStatus.innerText = "به چت زنده خوش آمدید!";
    }
}

