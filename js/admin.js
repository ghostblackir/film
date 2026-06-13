import { db, collection, addDoc, getDocs, getDoc, doc, deleteDoc, updateDoc, orderBy, query } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // بخش اول: تعاریف و مدیریت فیلم‌ها (کد قبلی خودت با اصلاحات جزئی برای عدم تداخل)
    // -------------------------------------------------------------------------
    const form = document.getElementById('addMovieForm');
    const msgElement = document.getElementById('formMessage');
    const adminMoviesList = document.getElementById('adminMoviesList');

    const editMovieIdInput = document.getElementById('editMovieId');
    const submitBtn = document.getElementById('submitBtn');

    // لود کردن اولیه لیست فیلم‌ها برای مدیریت
    fetchAdminMovies();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isEditMode = editMovieIdInput.value !== "";

            submitBtn.disabled = true;
            submitBtn.textContent = isEditMode ? 'در حال اعمال تغییرات...' : 'در حال ارسال و ذخیره‌سازی...';

            const tagsInput = document.getElementById('tags').value;
            let tagsArray = tagsInput ? tagsInput.split(/[،,]+/).map(t => t.trim()).filter(t => t !== "") : [];
            const accessType = document.getElementById('accessType').value;

            if (accessType === 'vip' && !tagsArray.some(t => t.toLowerCase() === 'vip')) {
                tagsArray.push('VIP');
            }

            const movieData = {
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('description').value.trim(),
                video: document.getElementById('videoUrl').value.trim(),
                thumbnail: document.getElementById('thumbnailUrl').value.trim(),
                tags: tagsArray,
                access: accessType,
                duration: document.getElementById('duration').value.trim()
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

                const item = document.createElement('div');
                item.className = 'admin-movie-item';
                item.innerHTML = `
                    <div class="admin-movie-info">
                        <img src="${movie.thumbnail}" class="admin-movie-thumb" alt="">
                        <span class="admin-movie-title">${movie.title} [${movie.access === 'vip' ? '👑 VIP' : '🔓 رایگان'}]</span>
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
    // بخش دوم: منطق جدید اعطای اشتراک دستی، شارژ سکه و لود ایمیل‌ها
    // -------------------------------------------------------------------------
    const manualVipForm = document.getElementById('manualVipForm');
    const manualCoinForm = document.getElementById('manualCoinForm');
    const userEmailSelect = document.getElementById('userEmailSelect');
    const userCoinEmailSelect = document.getElementById('userCoinEmailSelect'); // منوی آبشاری بخش سکه

    // لود خودکار تمام ایمیل‌های ثبت‌نام شده از کالکشن users در فایربیس
    async function loadUsersEmails() {
        if (!userEmailSelect && !userCoinEmailSelect) return;

        try {
            const snapshot = await getDocs(collection(db, 'users'));
            
            // خالی کردن هر دو سلکتور
            if (userEmailSelect) userEmailSelect.innerHTML = '<option value="" disabled selected>یک ایمیل انتخاب کنید...</option>';
            if (userCoinEmailSelect) userCoinEmailSelect.innerHTML = '<option value="" disabled selected>یک ایمیل انتخاب کنید...</option>';

            let hasUsers = false;
            snapshot.forEach((userDoc) => {
                const userData = userDoc.data();
                if (userData.email) {
                    hasUsers = true;
                    
                    // ساخت آپشن برای بخش اشتراک
                    if (userEmailSelect) {
                        const optionVip = document.createElement('option');
                        optionVip.value = userDoc.id;
                        optionVip.textContent = userData.email;
                        userEmailSelect.appendChild(optionVip);
                    }

                    // ساخت آپشن برای بخش سکه
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
            if (userEmailSelect) userEmailSelect.innerHTML = '<option value="" disabled>خطا در بارگذاری لیست کاربران!</option>';
            if (userCoinEmailSelect) userCoinEmailSelect.innerHTML = '<option value="" disabled>خطا در بارگذاری لیست کاربران!</option>';
        }
    }

    // صدا زدن تابع لود ایمیل‌ها برای هر دو بخش
    loadUsersEmails();

    // هندل کردن سابمیت فرم اشتراک دستی
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
                
                // لیست‌ها را برای اطمینان از سینک بودن دیتا دوباره لود کن
                loadUsersEmails();

            } catch (error) {
                console.error("خطا در اعمال اشتراک دستی و سکه: ", error);
                showMessage('خطایی در سیستم فعال‌سازی یا شارژ سکه رخ داد.', 'error');
            } finally {
                activateVipBtn.disabled = false;
                activateVipBtn.textContent = 'دکمه تایید و فعال سازی';
            }
        });
    }

    // هندل کردن سابمیت فرم جدید: افزودن مستقیم سکه به صورت داینامیک
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

                // خواندن سکه‌های فعلی کاربر در فایربیس
                let currentCoins = 0;
                if (userDoc.exists() && userDoc.data().coins !== undefined) {
                    currentCoins = parseInt(userDoc.data().coins);
                }

                // جمع زدن سکه‌های قدیمی با مقدار فیلد ورودی جدید شما
                const totalNewCoins = currentCoins + coinsToInject;

                // بروزرسانی فیلد سکه‌ها در فایربیس بدون تغییر وضعیت VIP
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
});