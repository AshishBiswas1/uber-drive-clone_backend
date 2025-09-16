// config/firebaseConfig.js
const admin = require('firebase-admin');

// Create service account object from environment variables
const getServiceAccount = () => {
  // Handle the private key - replace escaped newlines with actual newlines
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  return {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: 'googleapis.com',
  };
};

// Initialize Firebase Admin SDK only if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = getServiceAccount();

    // Validate required environment variables
    if (
      !serviceAccount.project_id ||
      !serviceAccount.private_key ||
      !serviceAccount.client_email
    ) {
      throw new Error('Missing required Firebase environment variables');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const auth = admin.auth();

module.exports = { admin, auth };
