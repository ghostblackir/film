import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// اصلاح پکیج دیتابیس: متدهای کش آفلاین دقیقاً از همینجا ایمپورت شدند
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    collection, addDoc, getDocs, getDoc, doc, updateDoc, increment, query, orderBy, limit, where, deleteDoc, onSnapshot, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyCOL8YHwIe3OCCeJcZnb03Gsqf3e290QL0",
    authDomain: "ghost-2add0.firebaseapp.com",
    projectId: "ghost-2add0",
    storageBucket: "ghost-2add0.firebasestorage.app",
    messagingSenderId: "765160111148",
    appId: "1:765160111148:web:51b3ccb5d26a6cb1cfe589",
    measurementId: "G-P5KH7K9D48"
};

const app = initializeApp(firebaseConfig);

// راه‌اندازی دیتابیس با قابلیت حافظه کش آفلاین هوشمند (بدون تداخل و ارور)
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const analytics = getAnalytics(app);

// اکسپورت همزمان برای جلوگیری از ارور Missing Export در صفحات live.js و admin-live.js
export { 
    db, 
    auth,
    googleProvider,
    GoogleAuthProvider, // اضافه شدن کلاس اصلی برای کدهای احتمالی دیگر
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    analytics, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    doc, 
    updateDoc, 
    increment, 
    query, 
    orderBy, 
    limit, 
    where,
    deleteDoc,
    onSnapshot,
    setDoc
};