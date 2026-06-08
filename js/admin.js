import { db, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, orderBy, query } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addMovieForm');
    const msgElement = document.getElementById('formMessage');
    const adminMoviesList = document.getElementById('adminMoviesList');
    
    // المان‌های فرم و فیلد مخفی ادیت
    const editMovieIdInput = document.getElementById('editMovieId');
    const submitBtn = document.getElementById('submitBtn');

    // لود کردن اولیه لیست فیلم‌ها برای مدیریت
    fetchAdminMovies();

    // ۱. منطق مدیریت فرم (ثبت جدید یا به‌روزرسانی قدیمی)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const isEditMode = editMovieIdInput.value !== ""; // تشخیص حالت ویرایش
        
        submitBtn.disabled = true;
        submitBtn.textContent = isEditMode ? 'در حال اعمال تغییرات...' : 'در حال ارسال و ذخیره‌سازی...';

        const tagsInput = document.getElementById('tags').value;
        let tagsArray = tagsInput ? tagsInput.split(/[،,]+/).map(t => t.trim()).filter(t => t !== "") : [];
        const accessType = document.getElementById('accessType').value;

        if (accessType === 'vip' && !tagsArray.some(t => t.toLowerCase() === 'vip')) {
            tagsArray.push('VIP');
        }

        // دیتا پِیلود مشترک
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
                // ---- حالت ویرایش دکمه ----
                const movieDocRef = doc(db, 'movies', editMovieIdInput.value);
                await updateDoc(movieDocRef, movieData);
                
                showMessage('تغییرات فیلم با موفقیت به‌روزرسانی شد!', 'success');
                
                // ریست کردن فرم به حالت اولیه ثبت
                editMovieIdInput.value = "";
                submitBtn.textContent = 'ثبت و انتشار فیلم';
                submitBtn.classList.remove('updating-mode');
            } else {
                // ---- حالت ثبت فیلم جدید ----
                movieData.views = 0;
                movieData.createdAt = new Date();
                
                await addDoc(collection(db, 'movies'), movieData);
                showMessage('فیلم با موفقیت منتشر شد!', 'success');
            }

            form.reset();
            fetchAdminMovies(); // لود مجدد لیست نهایی
            
        } catch (error) {
            console.error("خطا در عملیات دیتابیس: ", error);
            showMessage('متاسفانه خطایی رخ داد. مجدد تلاش کنید.', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // ۲. واکشی فیلم‌ها و رندر دکمه‌های حذف و ادیت
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

            // ست کردن کلیک دکمه‌های حذف
            adminMoviesList.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const movieId = e.currentTarget.getAttribute('data-id');
                    if (confirm('آیا از حذف این فیلم مطمئن هستید؟')) {
                        await deleteMovie(movieId);
                    }
                });
            });

            // ست کردن کلیک دکمه‌های ویرایش (انتقال دیتا به فرم بالا)
            adminMoviesList.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const movieId = e.currentTarget.getAttribute('data-id');
                    const movieData = JSON.parse(e.currentTarget.getAttribute('data-movie'));

                    // پر کردن فیلدهای فرم بالا با اطلاعات فیلم انتخاب شده
                    document.getElementById('title').value = movieData.title || '';
                    document.getElementById('description').value = movieData.description || '';
                    document.getElementById('videoUrl').value = movieData.video || '';
                    document.getElementById('thumbnailUrl').value = movieData.thumbnail || '';
                    document.getElementById('duration').value = movieData.duration || '';
                    document.getElementById('accessType').value = movieData.access || 'free';
                    document.getElementById('tags').value = movieData.tags ? movieData.tags.join('، ') : '';

                    // قراردادن سیستم روی حالت ویرایش
                    editMovieIdInput.value = movieId;
                    submitBtn.textContent = '💾 ذخیره تغییرات فیلم (Update)';
                    submitBtn.classList.add('updating-mode');

                    // اسکرول نرم به بالای صفحه تا ادمین فرم پر شده را ببیند
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            });

        } catch (error) {
            console.error("خطا در دریافت لیست: ", error);
            adminMoviesList.innerHTML = `<p style="color: #ef4444; text-align: center;">خطا در بارگذاری لیست.</p>`;
        }
    }

    // ۳. تابع حذف فیلم
    async function deleteMovie(id) {
        try {
            await deleteDoc(doc(db, 'movies', id));
            fetchAdminMovies();
            alert('فیلم با موفقیت حذف شد.');
        } catch (error) {
            console.error("خطا در حذف: ", error);
        }
    }

    function showMessage(text, status) {
        msgElement.textContent = text;
        msgElement.className = `form-message ${status}`;
        msgElement.style.display = 'block';
        setTimeout(() => { msgElement.style.display = 'none'; }, 5000);
    }
});