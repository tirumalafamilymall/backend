import admin from 'firebase-admin'

if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (privateKey) {
    // 1. Strip out wrapping double quotes if they were pasted accidentally
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    }
    // 2. Clean up both raw and double-escaped newline characters securely
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    })
    console.log("🚀 Firebase Admin initialized successfully.")
  } catch (initError: any) {
    console.error("🚨 Firebase Admin initialization failed completely:", initError.message)
  }
}

export const adminAuth = admin.auth()