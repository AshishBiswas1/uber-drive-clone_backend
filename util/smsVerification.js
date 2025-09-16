// util/smsVerification.js
const { auth } = require('./firebaseConfig');
const catchAsync = require('./catchAsync');
const AppError = require('./appError');

// In-memory store for verification sessions
const verificationStore = new Map();

/**
 * Format phone number for Firebase (E.164 format)
 */
const formatPhoneNumber = (phoneNumber, countryCode = '+91') => {
  const cleanNumber = phoneNumber.replace(/\D/g, '');

  if (cleanNumber.startsWith(countryCode.replace('+', ''))) {
    return `+${cleanNumber}`;
  }

  return `${countryCode}${cleanNumber}`;
};

/**
 * Generate session ID
 */
const generateSessionId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Generate OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Initiate phone verification with Firebase
 */
const initiatePhoneVerification = async (phoneNumber, countryCode = '+91') => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber, countryCode);

    // Validate phone number format
    if (!formattedPhone.match(/^\+[1-9]\d{1,14}$/)) {
      throw new AppError('Invalid phone number format', 400);
    }

    console.log(`🔄 Starting verification process for: ${formattedPhone}`);

    // Step 1: Create or get Firebase user
    let firebaseUser = null;
    let userCreated = false;

    try {
      console.log('🔍 Checking if Firebase user exists...');
      firebaseUser = await auth.getUserByPhoneNumber(formattedPhone);
      console.log(`✅ Existing Firebase user found: ${firebaseUser.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('👤 Creating new Firebase user...');
        try {
          firebaseUser = await auth.createUser({
            phoneNumber: formattedPhone,
          });
          userCreated = true;
          console.log(
            `🆕 Firebase user created successfully: ${firebaseUser.uid}`
          );
        } catch (createError) {
          console.error('❌ Failed to create Firebase user:', createError);
          throw new AppError(
            `Failed to create Firebase user: ${createError.message}`,
            500
          );
        }
      } else {
        console.error('❌ Firebase user check failed:', error);
        throw new AppError(`Firebase user check failed: ${error.message}`, 500);
      }
    }

    // Step 2: Generate OTP and create session
    const otp = generateOTP();
    const sessionId = generateSessionId();

    const sessionData = {
      phone: formattedPhone,
      otp: otp,
      firebaseUid: firebaseUser.uid,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attempts: 0,
      verified: false,
      maxAttempts: 3,
      userCreated: userCreated,
    };

    verificationStore.set(sessionId, sessionData);

    // Log success
    console.log(`📱 Phone verification session created successfully!`);
    console.log(`🔑 Session ID: ${sessionId}`);
    console.log(`🔢 OTP: ${otp} (for testing)`);
    console.log(`👤 Firebase UID: ${firebaseUser.uid}`);
    console.log(`📞 Phone: ${formattedPhone}`);

    return {
      success: true,
      sessionId,
      phone: formattedPhone,
      firebaseUid: firebaseUser.uid,
      userCreated: userCreated,
      message: 'Phone verification initiated successfully',
      expiresIn: 300, // 5 minutes
      // Include OTP for development
      otp: process.env.NODE_ENV === 'development' ? otp : otp, // Always include for testing
    };
  } catch (error) {
    console.error('❌ Phone verification initiation failed:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Phone verification failed: ${error.message}`, 500);
  }
};

/**
 * Verify OTP code - ADD THIS FUNCTION
 */
const verifyOTP = async (sessionId, otpCode) => {
  try {
    console.log(`🔍 Verifying OTP for session: ${sessionId}`);

    if (!sessionId || !otpCode) {
      throw new AppError('Session ID and OTP code are required', 400);
    }

    // Get session data
    const sessionData = verificationStore.get(sessionId);
    if (!sessionData) {
      console.log(`❌ Session not found: ${sessionId}`);
      throw new AppError('Invalid or expired verification session', 400);
    }

    console.log(`📋 Session found for phone: ${sessionData.phone}`);

    // Check session expiry
    if (new Date() > sessionData.expiresAt) {
      console.log(`⏰ Session expired: ${sessionId}`);
      verificationStore.delete(sessionId);
      throw new AppError('OTP has expired', 400);
    }

    // Check max attempts
    if (sessionData.attempts >= sessionData.maxAttempts) {
      console.log(`🚫 Max attempts exceeded for session: ${sessionId}`);
      verificationStore.delete(sessionId);
      throw new AppError('Maximum verification attempts exceeded', 400);
    }

    // Increment attempts
    sessionData.attempts += 1;
    verificationStore.set(sessionId, sessionData);

    // Verify OTP
    if (sessionData.otp !== otpCode.toString()) {
      console.log(`❌ Invalid OTP: ${otpCode} (Expected: ${sessionData.otp})`);
      if (sessionData.attempts >= sessionData.maxAttempts) {
        verificationStore.delete(sessionId);
        throw new AppError('Invalid OTP. Maximum attempts exceeded.', 400);
      }
      throw new AppError(
        `Invalid OTP. ${
          sessionData.maxAttempts - sessionData.attempts
        } attempts remaining.`,
        400
      );
    }

    // OTP verified successfully
    sessionData.verified = true;
    sessionData.verifiedAt = new Date();
    verificationStore.set(sessionId, sessionData);

    console.log(`✅ OTP verified successfully for: ${sessionData.phone}`);
    console.log(`👤 Firebase UID: ${sessionData.firebaseUid}`);

    return {
      success: true,
      phone: sessionData.phone,
      firebaseUid: sessionData.firebaseUid,
      sessionId: sessionId,
      message: 'Phone number verified successfully',
      verifiedAt: new Date(),
    };
  } catch (error) {
    console.error('❌ OTP verification failed:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to verify OTP', 500);
  }
};

/**
 * Verify Firebase ID Token (keep for compatibility)
 */
const verifyFirebaseToken = async (idToken, sessionId = null) => {
  try {
    if (!idToken) {
      throw new AppError('ID token is required', 400);
    }

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);

    if (!decodedToken.phone_number) {
      throw new AppError('Phone number not found in token', 400);
    }

    let sessionData = null;

    // If session ID is provided, validate it
    if (sessionId) {
      sessionData = verificationStore.get(sessionId);
      if (!sessionData) {
        throw new AppError('Invalid or expired verification session', 400);
      }

      // Check session expiry
      if (new Date() > sessionData.expiresAt) {
        verificationStore.delete(sessionId);
        throw new AppError('Verification session has expired', 400);
      }

      // Check if phone number matches session
      if (decodedToken.phone_number !== sessionData.phone) {
        throw new AppError('Phone number mismatch with session', 400);
      }

      // Mark session as verified
      sessionData.verified = true;
      sessionData.verifiedAt = new Date();
      verificationStore.set(sessionId, sessionData);
    }

    console.log(`✅ Phone verified: ${decodedToken.phone_number}`);
    console.log(`🔥 Firebase UID: ${decodedToken.uid}`);

    return {
      success: true,
      phone: decodedToken.phone_number,
      uid: decodedToken.uid,
      sessionId: sessionId,
      email: decodedToken.email || null,
      message: 'Phone number verified successfully',
      verifiedAt: new Date(),
    };
  } catch (error) {
    console.error('Firebase token verification error:', error);

    if (error instanceof AppError) {
      throw error;
    }

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      throw new AppError('Verification token has expired', 400);
    } else if (error.code === 'auth/id-token-revoked') {
      throw new AppError('Verification token has been revoked', 400);
    } else if (error.code === 'auth/invalid-id-token') {
      throw new AppError('Invalid verification token', 400);
    }

    throw new AppError('Failed to verify phone number', 500);
  }
};

/**
 * Get verification session info
 */
const getVerificationSession = (sessionId) => {
  const sessionData = verificationStore.get(sessionId);

  if (!sessionData) {
    throw new AppError('Verification session not found', 404);
  }

  return {
    sessionId,
    phone: sessionData.phone,
    firebaseUid: sessionData.firebaseUid,
    createdAt: sessionData.createdAt,
    expiresAt: sessionData.expiresAt,
    attempts: sessionData.attempts,
    verified: sessionData.verified,
    userCreated: sessionData.userCreated,
    isExpired: new Date() > sessionData.expiresAt,
    // Include OTP for development
    otp: process.env.NODE_ENV === 'development' ? sessionData.otp : undefined,
  };
};

/**
 * Clean up expired sessions
 */
const cleanupExpiredSessions = () => {
  const now = new Date();
  let cleanedCount = 0;

  for (const [sessionId, sessionData] of verificationStore.entries()) {
    if (now > sessionData.expiresAt) {
      verificationStore.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired verification sessions`);
  }
};

// Clean up expired sessions every 15 minutes
setInterval(cleanupExpiredSessions, 15 * 60 * 1000);

// 🔥 MAKE SURE TO EXPORT verifyOTP
module.exports = {
  initiatePhoneVerification,
  verifyOTP, // ✅ MUST BE HERE
  verifyFirebaseToken,
  getVerificationSession,
  formatPhoneNumber,
  cleanupExpiredSessions,
};
