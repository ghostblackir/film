import { db, doc, setDoc, getDoc, updateDoc, collection, onSnapshot, orderBy, query, limit, deleteDoc, getDocs } from "./firebase.js";

const adminForm = document.getElementById('admin-form');
const titleInput = document.getElementById('stream-title-input');
const descInput = document.getElementById('stream-desc-input');
const urlInput = document.getElementById('stream-url-input');
const scheduleDate = document.getElementById('schedule-date');
const scheduleTime = document.getElementById('schedule-time');
const resetBtn = document.getElementById('reset-btn');
const adminChatMessages = document.getElementById('admin-chat-messages');
const statusMessage = document.getElementById('status-message');

const streamDocRef = doc(db, "streams", "current");

// ۱. لود اطلاعات فعلی دیتابیس در فرم ادمین
async function loadData() {
    const docSnap = await getDoc(streamDocRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        titleInput.value = data.title || "";
        descInput.value = data.description || "";
        urlInput.value = data.hlsUrl || "";
        if (data.scheduledAt) {
            const d = new Date(data.scheduledAt);
            scheduleDate.value = d.toISOString().split('T')[0];
            scheduleTime.value = d.toTimeString().split(' ')[0].substring(0,5);
        }
    }
}
loadData();

// ۳. بخش اصلاح شده ثبت فرم در admin-live.js
adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let scheduledTimestamp = null;
    let isLiveStatus = true;

    if (scheduleDate.value && scheduleTime.value) {
        // ایجاد یک آبجکت تاریخ استاندارد بر اساس ورودی ادمین
        const localDateTime = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
        scheduledTimestamp = localDateTime.getTime(); // تبدیل به میلی‌ثانیه استاندارد UTC
        
        // اگر زمان ست شده بزرگتر از زمان حال مرورگر باشد
        if (scheduledTimestamp > Date.now()) {
            isLiveStatus = false; 
        }
    }

    await setDoc(streamDocRef, {
        title: titleInput.value,
        description: descInput.value,
        hlsUrl: urlInput.value,
        isLive: isLiveStatus,
        scheduledAt: scheduledTimestamp
    }, { merge: true });

    showMsg("تنظیمات و زمان‌بندی با موفقیت منتشر شد!");
});

// ۳. دکمه قرمز: قطع کامل لایو، ریست لایک، ریست بازدید و پاکسازی کل چت باکس
resetBtn.addEventListener('click', async () => {
    if (!confirm("آیا از قطع لایو و ریست کردن تمامی آمار (لایک، ویوور و پیام‌ها) مطمئن هستید؟")) return;

    // الف) ریست داکیومنت اصلی لایو
    await setDoc(streamDocRef, {
        title: "پخش زنده به پایان رسید",
        description: "در حال حاضر برنامه‌ای در حال پخش نیست.",
        hlsUrl: "",
        isLive: false,
        likes: 0,
        scheduledAt: null
    });

    // ب) حذف فیزیکی تمامی پیام‌های چت روم از فایربیس
    const chatSnapshot = await getDocs(collection(db, "streams", "current", "chat"));
    chatSnapshot.forEach(async (msgDoc) => {
        await deleteDoc(doc(db, "streams", "current", "chat", msgDoc.id));
    });

    // ج) صفر کردن کاربران آنلاین
    const onlineSnapshot = await getDocs(collection(db, "online_users"));
    onlineSnapshot.forEach(async (userDoc) => {
        await deleteDoc(doc(db, "online_users", userDoc.id));
    });

    // د) پاک کردن لیست کسانی که لایک کرده بودند تا بتونن لایو بعدی دوباره لایک کنند
    const likedSnapshot = await getDocs(collection(db, "streams", "current", "liked_users"));
    likedSnapshot.forEach(async (likeDoc) => {
        await deleteDoc(doc(db, "streams", "current", "liked_users", likeDoc.id));
    });

    showMsg("کل سیستم لایو با موفقیت ریست شد و به حالت آفلاین رفت.");
});

// ۴. مانیتورینگ چت‌ها در پنل ادمین جهت حذف پیام یا بن کاربر
const chatQuery = query(collection(db, "streams", "current", "chat"), orderBy("timestamp", "asc"), limit(50));
onSnapshot(chatQuery, (querySnapshot) => {
    adminChatMessages.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
        const msg = docSnap.data();
        const msgId = docSnap.id;
        
        const msgElement = document.createElement('div');
        msgElement.className = 'chat-msg';
        msgElement.innerHTML = `
            <img src="${msg.avatar}" class="chat-avatar">
            <div class="msg-body">
                <div class="msg-meta">
                    <span class="user-name">${msg.user}</span>
                </div>
                <span class="text">${msg.text}</span>
                <div class="chat-actions">
                    <button class="btn-action btn-del" onclick="deleteMessage('${msgId}')">حذف پیام</button>
                    <button class="btn-action btn-ban" onclick="banUser('${msg.uid}', '${msg.user}')">بن کردن کاربر</button>
                </div>
            </div>
        `;
        adminChatMessages.appendChild(msgElement);
    });
    adminChatMessages.scrollTop = adminChatMessages.scrollHeight;
});

// توابع گلوبال برای دکمه‌های حذف و بن چت
window.deleteMessage = async function(msgId) {
    await deleteDoc(doc(db, "streams", "current", "chat", msgId));
};

window.banUser = async function(uid, username) {
    if (confirm(`آیا از بن کردن ${username} مطمئن هستید؟ این کاربر دیگر نمی‌تواند چت کند.`)) {
        await setDoc(doc(db, "banned_users", uid), { banned: true, name: username, timestamp: new Date() });
        alert("کاربر با موفقیت بن شد.");
    }
};

function showMsg(text) {
    statusMessage.innerText = text;
    statusMessage.style.display = "block";
    setTimeout(() => statusMessage.style.display = "none", 4000);
}
