import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, increment, query, orderBy, limit, where, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const analytics = getAnalytics(app);

export { 
    db, 
    auth,
    googleProvider,
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
    onSnapshot
};