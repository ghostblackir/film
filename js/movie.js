import { db, doc, getDoc, updateDoc, increment, collection, getDocs, addDoc, query, where, limit, orderBy } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    loadMovieDetails();
});

async function loadMovieDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');

    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const movieDocRef = doc(db, 'movies', movieId);
        const movieDoc = await getDoc(movieDocRef);

        if (!movieDoc.exists()) {
            alert('فیلم مورد نظر یافت نشد!');
            window.location.href = 'index.html';
            return;
        }

        const movieData = movieDoc.data();

        // افزایش خودکار بازدید
        await updateDoc(movieDocRef, { views: increment(1) });

        // تغییر وضعیت UI از حالت لودینگ
        document.title = `${movieData.title} - GHOST MOVIES`;
        document.getElementById('movieLoading').classList.add('hidden');
        document.getElementById('movieContent').classList.remove('hidden');

        // تنظیم پلیر ویدئو
        const player = document.getElementById('ghostPlayer');
        const source = document.getElementById('videoSource');
        player.poster = movieData.thumbnail;
        source.src = movieData.video;
        player.load();

        // متادیتای متنی
        document.getElementById('movieTitle').textContent = movieData.title;
        document.getElementById('movieDescription').textContent = movieData.description;
        document.getElementById('movieViews').innerHTML = `<i class="bi bi-eye-fill"></i> ${movieData.views + 1} بازدید`;
        document.getElementById('movieDuration').innerHTML = `<i class="bi bi-clock-history"></i> ${movieData.duration}`;

        // هشتگ‌ها
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

        // فعال‌سازی لینک دانلود
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.href = movieData.video;

        // راه‌اندازی لایک، دیس لایک و کامنت‌ها
        setupLikes(movieDocRef, movieData);
        setupComments(movieId);
        fetchSimilarMovies(movieData.tags, movieId);

    } catch (error) {
        console.error("خطا در پردازش اطلاعات فیلم: ", error);
    }
}

// ۱. منطق لایک و دیس لایک
function setupLikes(movieDocRef, movieData) {
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    const likeCount = document.getElementById('likeCount');
    const dislikeCount = document.getElementById('dislikeCount');

    // نمایش مقادیر اولیه از دیتابیس (اگر فیلدها وجود نداشتند ۰ فرض می‌شوند)
    likeCount.textContent = movieData.likes || 0;
    dislikeCount.textContent = movieData.dislikes || 0;

    likeBtn.addEventListener('click', async () => {
        if (likeBtn.classList.contains('active')) return; // جلوگیری از لایک مکرر
        
        likeBtn.classList.add('active');
        likeCount.textContent = parseInt(likeCount.textContent) + 1;
        
        await updateDoc(movieDocRef, { likes: increment(1) });

        if (dislikeBtn.classList.contains('active')) {
            dislikeBtn.classList.remove('active');
            dislikeCount.textContent = Math.max(0, parseInt(dislikeCount.textContent) - 1);
            await updateDoc(movieDocRef, { dislikes: increment(-1) });
        }
    });

    dislikeBtn.addEventListener('click', async () => {
        if (dislikeBtn.classList.contains('active')) return;

        dislikeBtn.classList.add('active');
        dislikeCount.textContent = parseInt(dislikeCount.textContent) + 1;
        
        await updateDoc(movieDocRef, { dislikes: increment(1) });

        if (likeBtn.classList.contains('active')) {
            likeBtn.classList.remove('active');
            likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
            await updateDoc(movieDocRef, { likes: increment(-1) });
        }
    });
}

// ۲. منطق بخش کامنت‌ها (ذخیره و واکشی)
async function setupComments(movieId) {
    const commentForm = document.getElementById('commentForm');
    const commentsList = document.getElementById('commentsList');
    const commentsCount = document.getElementById('commentsCount');
    
    const commentsCollectionRef = collection(db, 'movies', movieId, 'comments');

    // تابع دریافت کامنت‌ها
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
                const dateStr = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleDateString('fa-IR') : 'به‌تازگی';
                
                const item = document.createElement('div');
                item.className = 'comment-item';
                item.innerHTML = `
                    <div class="comment-meta">
                        <span class="comment-user">${comment.name}</span>
                        <span>${dateStr}</span>
                    </div>
                    <p class="comment-text">${comment.text}</p>
                `;
                commentsList.appendChild(item);
            });
        } catch (err) {
            console.error("خطا در بارگذاری کامنت‌ها: ", err);
        }
    };

    // اجرای اولیه بارگذاری نظرات
    await loadComments();

    // ثبت کامنت جدید
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('commenterName');
        const textInput = document.getElementById('commentText');
        const submitBtn = commentForm.querySelector('.btn-submit-comment');

        submitBtn.disabled = true;
        submitBtn.textContent = 'در حال ارسال...';

        try {
            await addDoc(commentsCollectionRef, {
                name: nameInput.value.trim(),
                text: textInput.value.trim(),
                createdAt: new Date()
            });

            textInput.value = ''; // خالی کردن فیلد متن نظر
            await loadComments(); // بارگذاری مجدد لیست کامنت‌ها
        } catch (error) {
            console.error("خطا در ثبت کامنت: ", error);
            alert('ثبت نظر با خطا مواجه شد.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ارسال دیدگاه';
        }
    });
}

// واکشی فیلم‌های مشابه
async function fetchSimilarMovies(tags, currentId) {
    const grid = document.getElementById('similarMoviesGrid');
    if (!tags || tags.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">فیلم مشابهی یافت نشد.</p>';
        return;
    }

    try {
        const q = query(collection(db, 'movies'), where('tags', 'array-contains', tags[0]), limit(4));
        const snapshot = await getDocs(q);
        grid.innerHTML = '';

        let count = 0;
        snapshot.forEach(doc => {
            if (doc.id !== currentId) {
                count++;
                const movie = doc.data();
                const card = document.createElement('a');
                card.href = `movie.html?id=${doc.id}`;
                card.className = 'movie-card';
                card.innerHTML = `
                    <div class="card-img-wrapper">
                        <img src="${movie.thumbnail}" alt="${movie.title}" style="opacity:1;">
                        <span class="card-duration">${movie.duration}</span>
                    </div>
                    <div class="card-info">
                        <h4 class="card-title">${movie.title}</h4>
                    </div>
                `;
                grid.appendChild(card);
            }
        });

        if (count === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted)">فیلم مشابهی یافت نشد.</p>';
        }
    } catch (error) {
        console.error("خطا در واکشی فیلم‌های مشابه: ", error);
    }
}