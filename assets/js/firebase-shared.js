/**
 * My HTML Tools 共通 Firebase ブートストラップ。
 * 将来のアプリはこのモジュールと同じ firebaseConfig / app 名を利用する。
 * Web SDK 設定はブラウザ内で登録し、公開リポジトリには含めない。
 * Firebase JS SDK 12.19.0 (Apache-2.0), version pinned for reproducibility.
 */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, query, where, onSnapshot, setDoc, updateDoc, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const SHARED_CONFIG_KEY = 'my-html-tools:firebase-config:v1';
export const SHARED_APP_NAME = 'my-html-tools';

export function openSharedFirebase(config) {
  const app = getApps().find(item => item.name === SHARED_APP_NAME) || initializeApp(config, SHARED_APP_NAME);
  const auth = getAuth(app);
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    // 別アプリが先に同じ Firestore を初期化した場合はそのインスタンスを再利用。
    if (error.code !== 'failed-precondition') throw error;
    db = getFirestore(app);
  }
  return { app, auth, db };
}
export {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, query, where, onSnapshot, setDoc, updateDoc, deleteDoc,
};
