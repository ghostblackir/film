import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initSidebarMenu();
    handleUserAuth();
});

function initSidebarMenu() {
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
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

function handleUserAuth() {
    const profileSection = document.getElementById('userProfileSection');
    if (!profileSection) return;

    // tracking variable to prevent double clicks
    let isLoggingIn = false;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let subscriptionType = 'رایگان'; 
            let isVip = false;
            let userCoins = 150; 

            try {
                const userDocRef = doc(db, 'users', user.uid);
                let userDoc = await getDoc(userDocRef);
                
                if (!userDoc.exists()) {
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || 'کاربر جدید',
                        photoURL: user.photoURL || '',
                        access: 'free',
                        coins: 150, 
                        createdAt: new Date().toISOString()
                    });
                    userDoc = await getDoc(userDocRef);
                }

                const userData = userDoc.data();
                userCoins = userData.coins !== undefined ? userData.coins : 150;

                if (userData.access === 'vip') {
                    const now = new Date();
                    const expireDate = userData.vipExpireAt ? new Date(userData.vipExpireAt) : null;

                    if (expireDate && now > expireDate) {
                        await updateDoc(userDocRef, {
                            access: 'free',
                            role: 'member'
                        });
                        subscriptionType = 'رایگان (پایان اشتراک)';
                        isVip = false;
                    } else {
                        subscriptionType = 'VIP 👑';
                        isVip = true;
                    }
                }
            } catch (error) {
                console.error("خطا در دریافت اطلاعات کاربر:", error);
            }

            profileSection.innerHTML = `
                <div class="user-profile-card">
                    <div class="user-info-flex">
                        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" class="user-avatar ${isVip ? 'vip-border' : ''}" alt="پروفایل">
                        <div style="flex-grow: 1;">
                            <div class="user-name">${user.displayName || 'کاربر مهمان'}</div>
                            <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                <span class="user-badge ${isVip ? 'badge-vip' : 'badge-free'}">${subscriptionType}</span>
                                <span class="user-coins-badge" style="background: #2d3748; color: #ffd700; padding: 2px 8px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 4px; border: 1px solid #ffd70033;">
                                    <i class="bi bi-coin" style="color: #ffd700;"></i> ${userCoins}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button id="logoutBtn" class="btn-logout"><i class="bi bi-box-arrow-right"></i> خروج از حساب</button>
                </div>
            `;

            document.getElementById('logoutBtn').addEventListener('click', () => {
                signOut(auth).then(() => location.reload());
            });

        } else {
            profileSection.innerHTML = `
                <button id="googleLoginBtn" class="btn-google-login">
                    <i class="bi bi-google"></i> ورود / ثبت نام با گوگل
                </button>
            `;

            const googleLoginBtn = document.getElementById('googleLoginBtn');

            googleLoginBtn.addEventListener('click', () => {
                // 1. Prevent action if a popup is already loading
                if (isLoggingIn) return;
                
                isLoggingIn = true;
                googleLoginBtn.disabled = true; // Visually disable the button
                googleLoginBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> در حال اتصال...`;

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
                        // 2. Reset states so the user can try again
                        isLoggingIn = false;
                        googleLoginBtn.disabled = false;
                        googleLoginBtn.innerHTML = `<i class="bi bi-google"></i> ورود / ثبت نام با گوگل`;

                        // 3. Handle specific errors silently or with clean alerts
                        if (error.code === 'auth/cancelled-popup-request') {
                            console.log("درخواست قبلی لغو شد؛ پنجره جدید باز شد.");
                        } else if (error.code === 'auth/popup-closed-by-user') {
                            alert("پنجره ورود توسط شما بسته شد.");
                        } else {
                            console.error("خطا در ورود با گوگل:", error);
                            alert("خطایی در هنگام ورود رخ داد.");
                        }
                    });
            });
        }
    });
}