// old ES Module: import admin from "firebase-admin";
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function makeAdmin(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    await admin.firestore().doc(`users/${uid}`).set(
      { role: "admin", id: uid },
      { merge: true }
    );
    console.log("SUCCESS — Admin role applied:", uid);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

const uid = process.argv[2];
if (!uid) {
  console.log("Usage: node makeAdmin.js <uid>");
  process.exit(1);
}

makeAdmin(uid);
