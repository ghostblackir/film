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
            chatSystemStatus.innerHTML = `<span style="color: #ef4444;">حساب کاربری شما مسدود شده است.</span>`;
            chatForm.style.display = "none";
            return;
        }
        chatSystemStatus.innerText = "به چت زنده خوش آمدید!";
        chatForm.style.display = "flex";
        const userPresenceRef = doc(db, "online_users", user.uid);
        await setDoc(userPresenceRef, { name: user.displayName, email: user.email, timestamp: new Date() });
        window.addEventListener('beforeunload', () => { deleteDoc(userPresenceRef); });
        checkIfUserLiked();
    } else {
        currentUser = null;
        chatSystemStatus.innerHTML = `<span style="color: #ff2a74;">برای چت و لایک ابتدا وارد حساب خود شوید.</span>`;
        chatForm.style.display = "none";
    }
});

// ۳. دریافت آنی وضعیت لایو و مدیریت هوشمند شمارش معکوس (نسخه نهایی و بدون باگ)
onSnapshot(streamDocRef, async (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        streamTitle.innerText = data.title || "بدون عنوان";

        // پاک کردن تایمر قبلی در صورت وجود تغییر در دیتابیس برای جلوگیری از تداخل
        if (countdownInterval) clearInterval(countdownInterval);

        let targetTime = data.scheduledAt;
        const now = Date.now();

        // 🎯 الف) اگر زمان آینده ست شده و هنوز به آن زمان نرسیده‌ایم (حالت شمارش معکوس)
        if (targetTime && now < targetTime && data.isLive === false) {
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
                    // 🎉 زمان انتظار به پایان رسید!
                    clearInterval(countdownInterval);
                    countdownBox.style.display = "none";

                    if (localStorage.getItem('live_notify_enabled') === 'true' && !notificationTriggered) {
                        new Notification("🔴 پخش زنده شروع شد!", { body: data.title });
                        notificationTriggered = true;
                    }
                    // رفرش سبک لوکال برای تغییر وضعیت خودکار کادر به پلیر ویدیو
                    window.location.reload();
                } else {
                    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

                    // تزریق زمان زنده به کادر دیجیتالی منو
                    cdDays.innerText = String(days).padStart(2, '0');
                    cdHours.innerText = String(hours).padStart(2, '0');
                    cdMinutes.innerText = String(minutes).padStart(2, '0');
                    cdSeconds.innerText = String(seconds).padStart(2, '0');
                }
            }, 1000);

            disableLikeButton();
        }
        // 🟢 ب) اگر ادمین دکمه لایو فوری را زده یا زمان انتظار به پایان رسیده باشد (حالت زنده)
        else if (data.isLive === true || (targetTime && now >= targetTime)) {
            countdownBox.style.display = "none";
            offlineGif.style.display = "none";
            playerDoc.style.display = "block";
            liveStatus.innerText = "زنده";
            liveStatus.className = "status-tag online";
            streamDescription.innerText = data.description || "";

            if (player.src() !== data.hlsUrl) {
                // 🛠️ تشخیص هوشمند فرمت لینک (mp4 یا m3u8)
                let videoType = 'application/x-mpegURL'; // پیش‌فرض برای m3u8
                const videoUrl = data.hlsUrl.toLowerCase();

                if (videoUrl.includes('.mp4') || videoUrl.endsWith('.mp4')) {
                    videoType = 'video/mp4'; // سوییچ به فرمت mp4

                    // تغییر متن وضعیت به "پخش ویدیو" برای قشنگی بیشتر (آپشنال)
                    liveStatus.innerText = "پخش ویدیو";
                } else {
                    liveStatus.innerText = "زنده";
                }

                // تزریق لینک و فرمت درست به ویدیو جی‌اس
                player.src({ src: data.hlsUrl, type: videoType });
                updateChatAvailability(true, currentUser);
                player.play().catch(() => { });
                player.off('ended');

                player.on('ended', () => {
                    playerDoc.style.display = "none";      
                    offlineGif.style.display = "block";    
                    liveStatus.innerText = "آفلاین";       
                    liveStatus.className = "status-tag offline";
                    updateChatAvailability(false, currentUser);
                    
                    
                    updateChatAvailability(false, currentUser); 
                });
            }

            enableLikeButton(data.likes || 0);
        }
        // 🔴 ج) حالت کاملاً آفلاین معمولی (بدون زمان‌بندی قبلی)
        else {
            countdownBox.style.display = "none";
            player.reset();
            playerDoc.style.display = "none";
            offlineGif.style.display = "block";
            liveStatus.innerText = "آفلاین";
            liveStatus.className = "status-tag offline";
            streamDescription.innerText = data.description || "";
            updateChatAvailability(false, currentUser);
            disableLikeButton();
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
    chatMessages.innerHTML = ''; const sDiv = document.createElement('div'); sDiv.className = 'system-msg'; sDiv.innerText = chatSystemStatus.innerText; chatMessages.appendChild(sDiv);
    querySnapshot.forEach((doc) => {
        const msg = doc.data(); const msgElement = document.createElement('div'); msgElement.className = 'chat-msg';
        let roleBadge = `<span class="badge user-badge">کاربر عادی</span>`;
        if (msg.email === ADMIN_EMAIL) { roleBadge = `<span class="badge admin-badge"><i class="fa-solid fa-circle-check"></i> ADMIN</span>`; msgElement.classList.add('admin-message-style'); }
        msgElement.innerHTML = `<img src="${msg.avatar || 'https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png'}" class="chat-avatar"><div class="msg-body"><div class="msg-meta"><span class="user-name">${msg.user}</span>${roleBadge}</div><span class="text">${msg.text}</span></div>`;
        chatMessages.appendChild(msgElement);
    }); chatMessages.scrollTop = chatMessages.scrollHeight;
});
async function checkIfUserLiked() { if (!currentUser) return; const docSnap = await getDoc(doc(db, "streams", "current", "liked_users", currentUser.uid)); if (docSnap.exists()) { likeBtn.classList.add('liked'); likeBtn.disabled = true; } }

function updateChatAvailability(isLive, user) {
    const chatForm = document.getElementById('chat-form');
    const chatSystemStatus = document.getElementById('chat-system-status');

    if (!isLive) {
        // اگر لایو نیست، چت کلاً مخفی شود
        chatForm.style.display = "none";
        chatSystemStatus.innerHTML = `<span style="color: #8a8ab0;">استریم در حال حاضر آفلاین است.</span>`;
    } else if (!user) {
        // اگر لایو است ولی کاربر وارد نشده
        chatForm.style.display = "none";
        chatSystemStatus.innerHTML = `<span style="color: #ff2a74;">برای چت کردن <button onclick="window.location.href='/login'" style="background:none; border:none; color:white; text-decoration:underline; cursor:pointer;">وارد شوید</button>.</span>`;
    } else if (isBanned) {
        // اگر کاربر بن شده
        chatForm.style.display = "none";
        chatSystemStatus.innerHTML = `<span style="color: #ef4444;">حساب کاربری شما مسدود شده است.</span>`;
    } else {
        // اگر لایو است و کاربر لاگین است و بن نیست
        chatForm.style.display = "flex";
        chatSystemStatus.innerText = "به چت زنده خوش آمدید!";
    }
}