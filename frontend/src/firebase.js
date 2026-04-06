import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCzkUEPO7QAogIKBzeL5RSl0TV-UsEFRGI",
  authDomain: "accident-evidence-management.firebaseapp.com",
  projectId: "accident-evidence-management",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Authentication instance
export const auth = getAuth(app);
export const db = getFirestore(app);
