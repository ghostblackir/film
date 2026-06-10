import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    db,
    doc,
    getDoc
} from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initSidebarMenu();
    handleUserAuth();
});

// مدیریت باز و بسته شدن منو
function initSidebarMenu() {
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (!sidebarMenu || !menuToggleBtn) return;

    const openMenu = () => {
        sidebarMenu.classList.add('open');
        sidebarOverlay.classList.add('active');
    };

    const closeMenu = () => {
        sidebarMenu.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    };

    menuToggleBtn.addEventListener('click', openMenu);
    if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeMenu);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeMenu);
}

// مدیریت ورود / خروج و بررسی نوع اشتراک در فایربیس
function handleUserAuth() {
    const profileSection = document.getElementById('userProfileSection');
    if (!profileSection) return;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // کاربر لاگین شده است -> چک کردن دیتابیس برای فیلد اشتراک (مثلاً در کالکشن users)
            let subscriptionType = 'رایگان'; 
            let isVip = false;

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists() && userDoc.data().access === 'vip') {
                    subscriptionType = 'VIP 👑';
                    isVip = true;
                }
            } catch (error) {
                console.error("خطا در دریافت وضعیت اشتراک کاربر:", error);
            }

            // رندر کردن اطلاعات کاربر داخل منو
            profileSection.innerHTML = `
                <div class="user-profile-card">
                    <div class="user-info-flex">
                        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" class="user-avatar ${isVip ? 'vip-border' : ''}" alt="پروفایل">
                        <div>
                            <div class="user-name">${user.displayName || 'کاربر مهمان'}</div>
                            <span class="user-badge ${isVip ? 'badge-vip' : 'badge-free'}">${subscriptionType}</span>
                        </div>
                    </div>
                    <button id="logoutBtn" class="btn-logout"><i class="bi bi-box-arrow-right"></i> خروج از حساب</button>
                </div>
            `;

            // ست کردن رویداد خروج
            document.getElementById('logoutBtn').addEventListener('click', () => {
                signOut(auth).then(() => location.reload());
            });

        } else {
            // کاربر ثبت نام نکرده یا لاگین نیست -> نمایش دکمه ورود با گوگل
            profileSection.innerHTML = `
                <button id="googleLoginBtn" class="btn-google-login">
                    <i class="bi bi-google"></i> ورود / ثبت نام با گوگل
                </button>
            `;

            // ست کردن رویداد ورود با گوگل
            document.getElementById('googleLoginBtn').addEventListener('click', () => {
                signInWithPopup(auth, googleProvider)
                    .then((result) => {
                        console.log("ورود موفقیت‌آمیز:", result.user);
                        location.reload();
                    })
                    .catch((error) => {
                        console.error("خطا در ورود با گوگل:", error);
                        alert("خطایی در هنگام ورود با گوگل رخ داد. لطفاً دوباره تلاش کنید.");
                    });
            });
        }
    });
}