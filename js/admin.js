import { db, collection, addDoc, getDocs, getDoc, doc, deleteDoc, updateDoc, orderBy, query, where } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // بخش اول: تعاریف و مدیریت فیلم‌ها
    // -------------------------------------------------------------------------
    const form = document.getElementById('addMovieForm');
    const msgElement = document.getElementById('formMessage');
    const adminMoviesList = document.getElementById('adminMoviesList');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const editMovieIdInput = document.getElementById('editMovieId');
    const submitBtn = document.getElementById('submitBtn');
    const freeUntilInput = document.getElementById('freeUntil');
    const accessTypeSelect = document.getElementById('accessType');

    // لود کردن اولیه لیست فیلم‌ها برای مدیریت
    fetchAdminMovies();

    // هندل کردن نمایش/عدم نمایش فیلد زمان‌بندی بر اساس نوع دسترسی
    if (accessTypeSelect && document.getElementById('freeLimitGroup')) {
        accessTypeSelect.addEventListener('change', () => {
            if (accessTypeSelect.value === 'vip') {
                document.getElementById('freeLimitGroup').style.display = 'none';
                if (freeUntilInput) freeUntilInput.value = ''; // اگر VIP شد زمان پاک بشه
            } else {
                document.getElementById('freeLimitGroup').style.display = 'block';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isEditMode = editMovieIdInput.value !== "";

            submitBtn.disabled = true;
            submitBtn.textContent = isEditMode ? 'در حال اعمال تغییرات...' : 'در حال ارسال و ذخیره‌سازی...';

            const tagsInput = document.getElementById('tags').value;
            let tagsArray = tagsInput ? tagsInput.split(/[،,]+/).map(t => t.trim()).filter(t => t !== "") : [];
            const accessType = accessTypeSelect.value;

            if (accessType === 'vip' && !tagsArray.some(t => t.toLowerCase() === 'vip')) {
                tagsArray.push('VIP');
            }

            // خواندن تاریخ انقضا در صورت وجود
            const freeUntilValue = (accessType === 'free' && freeUntilInput.value) ? new Date(freeUntilInput.value).toISOString() : null;

            const movieData = {
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('description').value.trim(),
                video: document.getElementById('videoUrl').value.trim(),
                thumbnail: document.getElementById('thumbnailUrl').value.trim(),
                tags: tagsArray,
                access: accessType,
                duration: document.getElementById('duration').value.trim(),
                freeUntil: freeUntilValue // 🌟 ذخیره تایم سوییچ به VIP
            };

            try {
                if (isEditMode) {
                    const movieDocRef = doc(db, 'movies', editMovieIdInput.value);
                    await updateDoc(movieDocRef, movieData);

                    showMessage('تغییرات فیلم با موفقیت به‌روزرسانی شد!', 'success');

                    editMovieIdInput.value = "";
                    submitBtn.textContent = 'ثبت و انتشار فیلم';
                    submitBtn.classList.remove('updating-mode');
                } else {
                    movieData.views = 0;
                    movieData.createdAt = new Date();

                    await addDoc(collection(db, 'movies'), movieData);
                    showMessage('فیلم با موفقیت منتشر شد!', 'success');
                }

                form.reset();
                fetchAdminMovies();

            } catch (error) {
                console.error("خطا در عملیات دیتابیس: ", error);
                showMessage('متاسفانه خطایی رخ داد. مجدد تلاش کنید.', 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    async function fetchAdminMovies() {
        if (!adminMoviesList) return;

        try {
            const q = query(collection(db, 'movies'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            adminMoviesList.innerHTML = '';

            if (snapshot.empty) {
                adminMoviesList.innerHTML = `<p style="color: var(--text-muted); text-align: center;">هیچ فیلمی یافت نشد.</p>`;
                return;
            }

            snapshot.forEach(movieDoc => {
                const movie = movieDoc.data();
                const id = movieDoc.id;

                // بررسی اینکه آیا فیلم زمان‌بندی فعال دارد یا خیر برای نمایش توی لیست ادمین
                let scheduleBadge = '';
                if (movie.access === 'free' && movie.freeUntil) {
                    const localDate = new Date(movie.freeUntil).toLocaleString('fa-IR');
                    scheduleBadge = `<br><span style="font-size:11px; color:#ffd700;">⏳ انتقال به VIP در: ${localDate}</span>`;
                }

                const item = document.createElement('div');
                item.className = 'admin-movie-item';
                // داخل حلقه snapshot.forEach
                item.innerHTML = `
<div class="admin-movie-info" style="display:flex; align-items:center; gap:10px;">
    <input type="checkbox" class="movie-checkbox" value="${id}">
    <img src="${movie.thumbnail}" class="admin-movie-thumb" alt="">
    <span class="admin-movie-title">${movie.title} [${movie.access === 'vip' ? '👑 VIP' : '🔓 رایگان'}] ${scheduleBadge}</span>
</div>
<div class="admin-movie-actions-flex">
    <button class="btn-edit" data-id="${id}" data-movie='${JSON.stringify(movie).replace(/'/g, "&apos;")}'>
        <i class="bi bi-pencil-square"></i> ویرایش
    </button>
    <button class="btn-delete" data-id="${id}">
        <i class="bi bi-trash3-fill"></i> حذف
    </button>
</div>
`;
                adminMoviesList.appendChild(item);
            });

            adminMoviesList.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const movieId = e.currentTarget.getAttribute('data-id');
                    if (confirm('آیا از حذف این فیلم مطمئن هستید؟')) {
                        await deleteMovie(movieId);
                    }
                });
            });

            adminMoviesList.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const movieId = e.currentTarget.getAttribute('data-id');
                    const movieData = JSON.parse(e.currentTarget.getAttribute('data-movie'));

                    document.getElementById('title').value = movieData.title || '';
                    document.getElementById('description').value = movieData.description || '';
                    document.getElementById('videoUrl').value = movieData.video || '';
                    document.getElementById('thumbnailUrl').value = movieData.thumbnail || '';
                    document.getElementById('duration').value = movieData.duration || '';
                    document.getElementById('accessType').value = movieData.access || 'free';
                    document.getElementById('tags').value = movieData.tags ? movieData.tags.join('، ') : '';

                    // پر کردن فیلد تاریخ زمان‌بندی هنگام ویرایش
                    if (movieData.freeUntil && movieData.access === 'free') {
                        // تبدیل ISO به فرمت قابل فهم برای datetime-local (YYYY-MM-DDTHH:MM)
                        const dateObj = new Date(movieData.freeUntil);
                        const tzoffset = dateObj.getTimezoneOffset() * 60000; // برحسب میلی‌ثانیه
                        const localISOTime = (new Date(dateObj.getTime() - tzoffset)).toISOString().slice(0, 16);

                        if (freeUntilInput) freeUntilInput.value = localISOTime;
                        if (document.getElementById('freeLimitGroup')) document.getElementById('freeLimitGroup').style.display = 'block';
                    } else {
                        if (freeUntilInput) freeUntilInput.value = '';
                        if (movieData.access === 'vip' && document.getElementById('freeLimitGroup')) {
                            document.getElementById('freeLimitGroup').style.display = 'none';
                        }
                    }

                    editMovieIdInput.value = movieId;
                    submitBtn.textContent = '💾 ذخیره تغییرات فیلم (Update)';
                    submitBtn.classList.add('updating-mode');

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });


            });

        } catch (error) {
            console.error("خطا در دریافت لیست: ", error);
            adminMoviesList.innerHTML = `<p style="color: #ef4444; text-align: center;">خطا در بارگذاری لیست.</p>`;
        }
    }

    async function deleteMovie(id) {
        try {
            await deleteDoc(doc(db, 'movies', id));
            fetchAdminMovies();
            alert('فیلم با موفقیت حذف شد.');
        } catch (error) {
            console.error("خطا in حذف: ", error);
        }
    }

    function showMessage(text, status) {
        if (!msgElement) return;
        msgElement.textContent = text;
        msgElement.className = `form-message ${status}`;
        msgElement.style.display = 'block';
        setTimeout(() => { msgElement.style.display = 'none'; }, 5000);
    }

    // -------------------------------------------------------------------------
    // بخش جدید: اعمال آمار فیک تصادفی به همه فیلم‌ها (داخل محدوده مجاز دکمه‌ها)
    // -------------------------------------------------------------------------
    const updateAllStatsBtn = document.getElementById('updateAllStatsBtn');

    if (updateAllStatsBtn) {
        updateAllStatsBtn.addEventListener('click', async () => {
            const viewsInput = document.getElementById('manualViews').value;
            const likesInput = document.getElementById('manualLikes').value;

            const maxViews = parseInt(viewsInput);
            const maxLikes = parseInt(likesInput);

            if (isNaN(maxViews) && isNaN(maxLikes)) {
                alert('لطفاً حداقل یکی از فیلدهای بازدید یا لایک را پر کنید.');
                return;
            }

            if (confirm('آیا از اعمال آمار فیک تصادفی روی تمام فیلم‌های پلتفرم مطمئن هستید؟')) {
                updateAllStatsBtn.disabled = true;
                updateAllStatsBtn.textContent = 'در حال شلیک آمار...';

                try {
                    // گرفتن تمام مستندات فیلم‌ها از کلکشن movies
                    const snapshot = await getDocs(collection(db, 'movies'));
                    const updatePromises = [];

                    snapshot.forEach((movieDoc) => {
                        const movieRef = doc(db, 'movies', movieDoc.id);
                        const updateData = {};

                        // ایجاد نوسان طبیعی: عددی تصادفی بین ۸۰٪ تا ۱۰۰٪ سقف وارد شده
                        if (!isNaN(maxViews) && maxViews > 0) {
                            const randomViews = Math.floor(maxViews * (0.8 + Math.random() * 0.2));
                            updateData.views = randomViews;
                        }

                        if (!isNaN(maxLikes) && maxLikes > 0) {
                            const randomLikes = Math.floor(maxLikes * (0.8 + Math.random() * 0.2));
                            updateData.likes = randomLikes;
                        }

                        if (Object.keys(updateData).length > 0) {
                            updatePromises.push(updateDoc(movieRef, updateData));
                        }
                    });

                    // اجرای موازی تمام آپدیت‌ها در فایربیس
                    await Promise.all(updatePromises);

                    alert('💥 آمار فیک با مقادیر کاملاً نوسانی و طبیعی روی تمام فیلم‌ها اعمال شد!');
                    document.getElementById('manualViews').value = '';
                    document.getElementById('manualLikes').value = '';

                    // حالا چون داخل بلاک هستیم، بدون ارور لیست فیلم‌ها را رفرش می‌کند
                    fetchAdminMovies();

                } catch (error) {
                    console.error("خطا در تزریق آمار فیک گروهی: ", error);
                    alert('خطایی در ارتباط با فایربیس رخ داد.');
                } finally {
                    updateAllStatsBtn.disabled = false;
                    updateAllStatsBtn.textContent = '⚡ اعمال آمار به همه';
                }
            }
        });
    }




    // -------------------------------------------------------------------------
    // بخش دوم: منطق اعطای اشتراک دستی، شارژ سکه و لود ایمیل‌ها
    // -------------------------------------------------------------------------
    const manualVipForm = document.getElementById('manualVipForm');
    const manualCoinForm = document.getElementById('manualCoinForm');
    const userEmailSelect = document.getElementById('userEmailSelect');
    const userCoinEmailSelect = document.getElementById('userCoinEmailSelect');

    async function loadUsersEmails() {
        if (!userEmailSelect && !userCoinEmailSelect) return;

        try {
            const snapshot = await getDocs(collection(db, 'users'));

            if (userEmailSelect) userEmailSelect.innerHTML = '<option value="" disabled selected>یک ایمیل انتخاب کنید...</option>';
            if (userCoinEmailSelect) userCoinEmailSelect.innerHTML = '<option value="" disabled selected>یک ایمیل انتخاب کنید...</option>';

            let hasUsers = false;
            snapshot.forEach((userDoc) => {
                const userData = userDoc.data();
                if (userData.email) {
                    hasUsers = true;

                    if (userEmailSelect) {
                        const optionVip = document.createElement('option');
                        optionVip.value = userDoc.id;
                        optionVip.textContent = userData.email;
                        userEmailSelect.appendChild(optionVip);
                    }

                    if (userCoinEmailSelect) {
                        const optionCoin = document.createElement('option');
                        optionCoin.value = userDoc.id;
                        optionCoin.textContent = userData.email;
                        userCoinEmailSelect.appendChild(optionCoin);
                    }
                }
            });

            if (!hasUsers) {
                if (userEmailSelect) userEmailSelect.innerHTML = '<option value="" disabled>هیچ کاربر ثبت‌نام شده‌ای یافت نشد.</option>';
                if (userCoinEmailSelect) userCoinEmailSelect.innerHTML = '<option value="" disabled>هیچ کاربر ثبت‌نام شده‌ای یافت نشد.</option>';
            }
        } catch (error) {
            console.error("خطا در دریافت لیست ایمیل کاربران: ", error);
        }
    }

    loadUsersEmails();

    if (manualVipForm) {
        manualVipForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userId = userEmailSelect.value;
            const daysToActivate = parseInt(document.getElementById('vipPlan').value);
            const activateVipBtn = document.getElementById('activateVipBtn');

            if (!userId) {
                alert('لطفاً ابتدا ایمیل یک کاربر را انتخاب کنید.');
                return;
            }

            activateVipBtn.disabled = true;
            activateVipBtn.textContent = 'در حال فعال‌سازی و شارژ سکه...';

            let coinsToAdd = 0;
            if (daysToActivate === 7) coinsToAdd = 1700;
            else if (daysToActivate === 30) coinsToAdd = 2100;
            else if (daysToActivate === 90) coinsToAdd = 4300;
            else if (daysToActivate === 365) coinsToAdd = 21000;

            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + daysToActivate);

            try {
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                let currentCoins = 0;
                if (userDoc.exists() && userDoc.data().coins !== undefined) {
                    currentCoins = parseInt(userDoc.data().coins);
                }

                const totalNewCoins = currentCoins + coinsToAdd;

                await updateDoc(userDocRef, {
                    access: 'vip',
                    vipExpireAt: expireDate.toISOString(),
                    vipDaysPlan: daysToActivate,
                    coins: totalNewCoins,
                    role: 'vip_member'
                });

                showMessage(`👑 اشتراک ${daysToActivate} روزه فعال و تعداد ${coinsToAdd} سکه هدیه به کاربر اضافه شد! (مجموع سکه‌ها: ${totalNewCoins})`, 'success');
                manualVipForm.reset();
                userEmailSelect.value = "";
                loadUsersEmails();

            } catch (error) {
                console.error("خطا در اعمال اشتراک دستی: ", error);
                showMessage('خطایی در سیستم فعال‌سازی یا شارژ سکه رخ داد.', 'error');
            } finally {
                activateVipBtn.disabled = false;
                activateVipBtn.textContent = 'دکمه تایید و فعال سازی';
            }
        });
    }

    if (manualCoinForm) {
        manualCoinForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userId = userCoinEmailSelect.value;
            const coinsToInject = parseInt(document.getElementById('coinAmountInput').value);
            const chargeCoinBtn = document.getElementById('chargeCoinBtn');

            if (!userId) {
                alert('لطفاً ابتدا ایمیل یک کاربر را انتخاب کنید.');
                return;
            }

            if (isNaN(coinsToInject) || coinsToInject <= 0) {
                alert('لطفاً یک عدد معتبر برای تعداد سکه وارد کنید.');
                return;
            }

            chargeCoinBtn.disabled = true;
            chargeCoinBtn.textContent = 'در حال محاسبه و شارژ دیتابیس...';

            try {
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                let currentCoins = 0;
                if (userDoc.exists() && userDoc.data().coins !== undefined) {
                    currentCoins = parseInt(userDoc.data().coins);
                }

                const totalNewCoins = currentCoins + coinsToInject;

                await updateDoc(userDocRef, {
                    coins: totalNewCoins
                });

                showMessage(`🪙 تعداد ${coinsToInject} سکه با موفقیت به حساب کاربر واریز شد! (مجموع جدید: ${totalNewCoins})`, 'success');
                manualCoinForm.reset();
                userCoinEmailSelect.value = "";

            } catch (error) {
                console.error("خطا در شارژ دستی سکه کاربر: ", error);
                showMessage('خطایی در برقراری ارتباط با فایربیس رخ داد.', 'error');
            } finally {
                chargeCoinBtn.disabled = false;
                chargeCoinBtn.textContent = 'تایید و شارژ سکه';
            }
        });
    }

    // -------------------------------------------------------------------------
    // بخش دوم: مدیریت شورت ویدیوها (هوشمند با قابلیت اتوپُرکن فیلدها و سیستم VIP)
    // -------------------------------------------------------------------------
    const shortForm = document.getElementById('addShortForm');
    const adminShortsList = document.getElementById('adminShortsList');
    const editShortIdInput = document.getElementById('editShortId');
    const shortSubmitBtn = document.getElementById('shortSubmitBtn');
    const shortUserInput = document.getElementById('shortUser');
    const autoLoadStatus = document.getElementById('autoLoadStatus');

    fetchAdminShorts();

    if (shortUserInput) {
        shortUserInput.addEventListener('blur', async () => {
            const username = shortUserInput.value.trim();
            if (!username) return;

            if (autoLoadStatus) autoLoadStatus.textContent = "⏳ در حال بررسی سوابق سازنده...";
            try {
                const q = query(collection(db, 'shorts'), where('username', '==', username), orderBy('timestamp', 'desc'));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const lastShort = querySnapshot.docs[0].data();

                    if (document.getElementById('shortFollowers')) document.getElementById('shortFollowers').value = lastShort.followers || 0;
                    if (document.getElementById('shortFollowing')) document.getElementById('shortFollowing').value = lastShort.following || 0;
                    if (document.getElementById('shortAvatar')) document.getElementById('shortAvatar').value = lastShort.avatar || '';
                    if (document.getElementById('shortInstagram')) document.getElementById('shortInstagram').value = lastShort.instagram || '';
                    if (document.getElementById('shortPhone')) document.getElementById('shortPhone').value = lastShort.phone || '';
                    if (document.getElementById('shortWebsite')) document.getElementById('shortWebsite').value = lastShort.website || '';

                    if (autoLoadStatus) {
                        autoLoadStatus.textContent = "✅ مشخصات قبلی سازنده اعمال شد.";
                        autoLoadStatus.style.color = "#00ffcc";
                    }
                } else {
                    if (autoLoadStatus) {
                        autoLoadStatus.textContent = "ℹ️ سازنده جدید است. مقادیر پیش‌فرض استفاده می‌شود.";
                        autoLoadStatus.style.color = "#a0aec0";
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    // 💥 رویداد اصلی ارسال فرم شورت ویدیو به فایربیس
    if (shortForm) {
        shortForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const editShortIdInput = document.getElementById('editShortId');
            const shortSubmitBtn = document.getElementById('shortSubmitBtn');
            const isEditMode = editShortIdInput && editShortIdInput.value !== "";

            if (shortSubmitBtn) {
                shortSubmitBtn.disabled = true;
                shortSubmitBtn.textContent = 'در حال پردازش شبح...';
            }

            const shortData = {
                username: document.getElementById('shortUser').value.trim(),
                followers: parseInt(document.getElementById('shortFollowers').value) || 0,
                following: parseInt(document.getElementById('shortFollowing').value) || 0,
                videoUrl: document.getElementById('shortUrl').value.trim(),
                cover: document.getElementById('shortCover').value.trim() || '',
                avatar: document.getElementById('shortAvatar').value.trim() || 'https://www.gravatar.com/avatar/?d=mp',
                likes: parseInt(document.getElementById('shortLikes').value) || 0,
                views: parseInt(document.getElementById('shortViews').value) || 0,
                caption: document.getElementById('shortCaption').value.trim(),
                access: document.getElementById('shortAccess').value || 'free', // 🌟 دسترسی جدید
                instagram: document.getElementById('shortInstagram').value.trim() || '', // 🌟 ارتباطی جدید
                phone: document.getElementById('shortPhone').value.trim() || '',
                website: document.getElementById('shortWebsite').value.trim() || '',
                timestamp: new Date().getTime()
            };

            try {
                if (isEditMode) {
                    await updateDoc(doc(db, 'shorts', editShortIdInput.value), shortData);
                    alert('شورت ویدیو با موفقیت ویرایش شد!');
                } else {
                    await addDoc(collection(db, 'shorts'), shortData);
                    alert('شورت ویدیو جدید با موفقیت شلیک شد!');
                }
                shortForm.reset();
                if (editShortIdInput) editShortIdInput.value = "";
                if (autoLoadStatus) autoLoadStatus.textContent = "";
                if (shortSubmitBtn) {
                    shortSubmitBtn.textContent = "💥 شلیک و انتشار ویدیو در سیستم شورتس";
                    shortSubmitBtn.style.background = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";
                }
                if (typeof fetchAdminShorts === 'function') fetchAdminShorts();
            } catch (err) {
                alert('خطا در عملیات: ' + err.message);
            } finally {
                if (shortSubmitBtn) shortSubmitBtn.disabled = false;
            }
        });
    }

    async function fetchAdminShorts() {
        if (!adminShortsList) return;
        try {
            const querySnapshot = await getDocs(collection(db, 'shorts'));
            adminShortsList.innerHTML = '';

            if (querySnapshot.empty) {
                adminShortsList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">هیچ شورت ویدیویی یافت نشد.</p>';
                return;
            }

            querySnapshot.forEach((docSnap) => {
                const short = docSnap.data();
                const badge = short.access === 'vip' ? '<span style="background:#ef4444; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">VIP</span>' : '<span style="background:#00ffcc; color:#000; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:5px;">رایگان</span>';

                const div = document.createElement('div');
                div.className = 'admin-movie-item';
                div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${short.cover}" style="width:40px; height:55px; object-fit:cover; border-radius:4px;">
                    <div>
                        <h4 style="margin:0; font-size:14px; color:#fff;">@${short.username} ${badge}</h4>
                        <p style="margin:4px 0 0 0; font-size:11px; color:var(--text-muted);">${short.caption ? short.caption.substring(0, 30) + '...' : 'بدون کپشن'}</p>
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="edit-short-btn" data-id="${docSnap.id}" style="background:#3182ce; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">ویرایش</button>
                    <button class="delete-short-btn" data-id="${docSnap.id}" style="background:#e53e3e; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">حذف</button>
                </div>
            `;
                adminShortsList.appendChild(div);
            });

            // رویداد حذف شورت ویدیو
            document.querySelectorAll('.delete-short-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    if (confirm('آیا از حذف این شورت ویدیو مطمئن هستید؟')) {
                        const id = e.target.getAttribute('data-id');
                        await deleteDoc(doc(db, 'shorts', id));
                        fetchAdminShorts();
                    }
                };
            });

            // رویداد ویرایش شورت ویدیو
            document.querySelectorAll('.edit-short-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    const shortId = e.target.getAttribute('data-id');
                    try {
                        const docSnap = await getDoc(doc(db, 'shorts', shortId));
                        if (docSnap.exists()) {
                            const short = docSnap.data();

                            editShortIdInput.value = shortId;
                            document.getElementById('shortUrl').value = short.videoUrl || '';
                            document.getElementById('shortCover').value = short.cover || '';
                            document.getElementById('shortUser').value = short.username || '';
                            document.getElementById('shortAvatar').value = short.avatar || '';
                            document.getElementById('shortFollowers').value = short.followers || 0;
                            document.getElementById('shortFollowing').value = short.following || 0;
                            document.getElementById('shortLikes').value = short.likes || 0;
                            document.getElementById('shortViews').value = short.views || 0;
                            document.getElementById('shortCaption').value = short.caption || '';
                            document.getElementById('shortAccess').value = short.access || 'free';
                            document.getElementById('shortInstagram').value = short.instagram || '';
                            document.getElementById('shortPhone').value = short.phone || '';
                            document.getElementById('shortWebsite').value = short.website || '';

                            shortSubmitBtn.style.background = "linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%)";
                            shortSubmitBtn.textContent = "💾 ثبت تغییرات و ویرایش شورت ویدیو";

                            document.getElementById('addShortForm').scrollIntoView({ behavior: 'smooth' });
                        }
                    } catch (err) {
                        alert('خطا در فراخوانی دیتای شورت ویدیو!');
                    }
                };
            });
        } catch (err) {
            console.error(err);
        }
    }
});
// کنترل نمایش دکمه حذف گروهی و منطق کلیک
adminMoviesList.addEventListener('change', (e) => {
    if (e.target.classList.contains('movie-checkbox')) {
        const checkedCount = document.querySelectorAll('.movie-checkbox:checked').length;
        bulkDeleteBtn.style.display = checkedCount > 0 ? 'block' : 'none';
        bulkDeleteBtn.textContent = `حذف ${checkedCount} فیلم انتخاب شده`;
    }
});

bulkDeleteBtn.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.movie-checkbox:checked');
    if (confirm(`آیا از حذف ${selected.length} فیلم مطمئن هستید؟`)) {
        try {
            for (const cb of selected) {
                await deleteDoc(doc(db, 'movies', cb.value));
            }
            alert('فیلم‌های انتخاب شده حذف شدند.');
            bulkDeleteBtn.style.display = 'none';
            fetchAdminMovies(); // رفرش لیست
        } catch (error) {
            console.error("خطا در حذف گروهی: ", error);
        }
    }
});

