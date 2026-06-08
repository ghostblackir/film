import { db, collection, addDoc, getDocs, doc, deleteDoc, orderBy, query } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addMovieForm');
    const msgElement = document.getElementById('formMessage');
    const adminMoviesList = document.getElementById('adminMoviesList');

    // لود کردن اولیه لیست فیلم‌ها برای مدیریت
    fetchAdminMovies();

    // ۱. منطق ثبت فیلم جدید
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'در حال ارسال و ذخیره‌سازی...';

        const tagsInput = document.getElementById('tags').value;
        const tagsArray = tagsInput ? tagsInput.split(/[،,]+/).map(t => t.trim()).filter(t => t !== "") : [];

        const moviePayload = {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value.trim(),
            video: document.getElementById('videoUrl').value.trim(),
            thumbnail: document.getElementById('thumbnailUrl').value.trim(),
            tags: tagsArray,
            views: 0,
            duration: document.getElementById('duration').value.trim(),
            createdAt: new Date()
        };

        try {
            await addDoc(collection(db, 'movies'), moviePayload);
            showMessage('فیلم با موفقیت منتشر شد و اکنون در صفحه اصلی در دسترس است!', 'success');
            form.reset();
            
            // به‌روزرسانی آنی لیست مدیریت پس از افزودن فیلم جدید
            fetchAdminMovies();
        } catch (error) {
            console.error("خطا هنگام ثبت اسناد در فایربیس: ", error);
            showMessage('متاسفانه خطایی در اتصال به دیتابیس رخ داد. مجدد تلاش کنید.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ثبت و انتشار فیلم';
        }
    });

    // ۲. واکشی فیلم‌ها و نمایش در بخش مدیریت
    async function fetchAdminMovies() {
        if (!adminMoviesList) return;
        
        try {
            const q = query(collection(db, 'movies'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            adminMoviesList.innerHTML = '';

            if (snapshot.empty) {
                adminMoviesList.innerHTML = `<p style="color: var(--text-muted); text-align: center;">هیچ فیلمی در دیتابیس یافت نشد.</p>`;
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
                        <span class="admin-movie-title">${movie.title}</span>
                    </div>
                    <button class="btn-delete" data-id="${id}">
                        <i class="bi bi-trash3-fill"></i> حذف
                    </button>
                `;
                adminMoviesList.appendChild(item);
            });

            // افزودن رویداد کلیک برای تمام دکمه‌های حذف
            const deleteButtons = adminMoviesList.querySelectorAll('.btn-delete');
            deleteButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const movieId = e.currentTarget.getAttribute('data-id');
                    
                    // تایید نهایی از مدیر قبل از حذف
                    if (confirm('آیا از حذف این فیلم مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
                        await deleteMovie(movieId);
                    }
                });
            });

        } catch (error) {
            console.error("خطا در دریافت لیست مدیریت: ", error);
            adminMoviesList.innerHTML = `<p style="color: #ef4444; text-align: center;">خطا در بارگذاری لیست.</p>`;
        }
    }

    // ۳. تابع حذف فیلم از Firestore
    async function deleteMovie(id) {
        try {
            const docRef = doc(db, 'movies', id);
            await deleteDoc(docRef);
            
            // لود مجدد لیست برای همگام‌سازی رابط کاربری
            fetchAdminMovies();
            alert('فیلم با موفقیت از دیتابیس حذف شد.');
        } catch (error) {
            console.error("خطا در حذف فیلم: ", error);
            alert('حذف فیلم با خطا مواجه شد.');
        }
    }

    function showMessage(text, status) {
        msgElement.textContent = text;
        msgElement.className = `form-message ${status}`;
        setTimeout(() => { msgElement.style.display = 'none'; }, 5000);
    }
});