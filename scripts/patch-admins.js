/**
 * ONE-TIME ADMIN PATCH SCRIPT
 * Run once to fix all admin users
 */

const admin = require("firebase-admin");

// 🔐 Load your service account
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function patchAdmins() {
  console.log("🔎 Scanning for admin users...");

  const snap = await db
    .collection("users")
    .where("role", "==", "admin")
    .get();

  if (snap.empty) {
    console.log("✅ No admin users found. Nothing to patch.");
    return;
  }

  let patched = 0;

  const batch = db.batch();

  snap.docs.forEach((doc) => {
    const ref = doc.ref;

    batch.set(
      ref,
      {
        approved: true,
        canTakeStaffAttendance: true,
        canTakeStudentAttendance: true,
      },
      { merge: true }
    );

    patched++;
    console.log(`✔ Patched admin: ${doc.id}`);
  });

  await batch.commit();

  console.log(`🎉 Done! ${patched} admin user(s) patched successfully.`);
}

patchAdmins()
  .then(() => {
    console.log("✅ Admin patch completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Patch failed:", err);
    process.exit(1);
  });
