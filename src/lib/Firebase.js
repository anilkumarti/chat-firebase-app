
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "react-chat-168fb.firebaseapp.com",
  projectId: "react-chat-168fb",
  storageBucket: "react-chat-168fb.appspot.com",
  messagingSenderId: "1006309491215",
  appId: "1:1006309491215:web:4465c4aef49b20290e197a"
};

 {console.log(import.meta.env.VITE_API_KEY)}
const app = initializeApp(firebaseConfig);
export const auth=getAuth(app)
export const db=getFirestore(app)
export const storage=getStorage(app)