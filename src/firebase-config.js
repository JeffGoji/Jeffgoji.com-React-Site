import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDgjrfK-kTvVvM4GctJdtO6CS1aHyIhUGQ",
    authDomain: "jeffgoji-blog.firebaseapp.com",
    projectId: "jeffgoji-blog",
    storageBucket: "jeffgoji-blog.appspot.com",
    messagingSenderId: "258492076980",
    appId: "1:258492076980:web:9a905508df7ed723ae9a45",
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export { firestore }; 
