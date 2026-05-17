import admin from 'firebase-admin'

if (!admin.apps.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || ''
    
    // 🔥 THE MAGIC FIX: This forces Vercel's broken string back into a valid cryptographic key
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '')

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    })
    console.log("🚀 Firebase Admin initialized perfectly")
  } catch (error: any) {
    console.error("🚨 Firebase Init Failed:", error.message)
  }
}

export const adminAuth = admin.auth()