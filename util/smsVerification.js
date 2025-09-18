// util/smsVerification.js - Complete MSG91 Integration
const crypto = require('crypto');
const axios = require('axios');

const verificationSessions = new Map();

// Generate and send OTP via MSG91
const generateAndSendOTP = async (phoneNo) => {
  const sessionId = crypto.randomBytes(12).toString('hex');
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const session = {
    phone: phoneNo,
    otp: otp,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    attempts: 0,
    maxAttempts: 3,
    verified: false,
    isExpired: false,
  };

  verificationSessions.set(sessionId, session);

  try {
    // ✅ Send real SMS via MSG91
    const smsResult = await sendSMS(phoneNo, otp);
    console.log(`📲 MSG91 SMS sent to ${phoneNo} with OTP: ${otp}`);
    console.log(`📲 MSG91 Request ID: ${smsResult.request_id}`);

    return {
      sessionId,
      phone: phoneNo,
      smsStatus: 'sent',
      expiresIn: 300,
      isVerified: false,
      requestId: smsResult.request_id,
      provider: 'MSG91',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined, // Show OTP in dev mode
    };
  } catch (error) {
    console.error('❌ MSG91 SMS sending failed:', error);
    return {
      sessionId,
      phone: phoneNo,
      smsStatus: 'failed',
      expiresIn: 300,
      isVerified: false,
      error: error.message,
      provider: 'MSG91',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined, // Show OTP even if SMS fails in dev
    };
  }
};

// ✅ MSG91 SMS sending function
const sendSMS = async (phoneNo, otp) => {
  try {
    console.log('📲 Sending SMS via MSG91...');
    console.log(`📱 To: ${phoneNo}`);
    console.log(`📱 OTP: ${otp}`);

    // Clean phone number (remove +91 for MSG91)
    const cleanPhone = phoneNo.replace('+91', '').replace(/\s/g, '');

    // MSG91 API endpoint
    const url = 'https://api.msg91.com/api/v5/otp';

    const data = {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${cleanPhone}`, // Add country code
      authkey: process.env.MSG91_AUTH_KEY,
      otp: otp,
      // Optional: Add extra variables for your template
      var1: otp,
      var2: 'RideFlex Pro',
    };

    console.log('📲 MSG91 Request data:', {
      ...data,
      authkey: '[HIDDEN]',
      mobile: data.mobile,
      otp: '[HIDDEN]',
    });

    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.MSG91_AUTH_KEY,
      },
    });

    console.log('✅ MSG91 SMS sent successfully!');
    console.log(`📲 Response:`, response.data);

    if (response.data.type === 'success') {
      return {
        success: true,
        request_id: response.data.request_id,
        message: response.data.message,
      };
    } else {
      throw new Error(response.data.message || 'MSG91 SMS failed');
    }
  } catch (error) {
    console.error('❌ MSG91 SMS error:', error);

    // Better error messages
    let errorMessage = 'MSG91 SMS sending failed';
    if (error.response) {
      errorMessage = error.response.data?.message || errorMessage;
      console.error('MSG91 API Error:', error.response.data);
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Your existing functions...
const getVerificationSession = (sessionId) => {
  const session = verificationSessions.get(sessionId);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  if (new Date() > session.expiresAt) {
    session.isExpired = true;
    verificationSessions.delete(sessionId);
    throw new Error('Verification session expired');
  }

  return session;
};

const verifyOTP = async (sessionId, otp) => {
  const session = getVerificationSession(sessionId);

  session.attempts += 1;

  if (session.attempts > session.maxAttempts) {
    verificationSessions.delete(sessionId);
    throw new Error('Too many failed attempts');
  }

  if (session.otp !== otp) {
    throw new Error('Invalid OTP');
  }

  session.verified = true;
  verificationSessions.delete(sessionId);

  return {
    success: true,
    phone: session.phone,
    verifiedAt: new Date(),
    provider: 'MSG91',
  };
};

// ✅ Resend SMS via MSG91
const resendSMS = async (sessionId) => {
  try {
    const session = getVerificationSession(sessionId);
    const smsResult = await sendSMS(session.phone, session.otp);

    console.log(`🔄 MSG91 SMS resent to ${session.phone}`);
    return {
      success: true,
      requestId: smsResult.request_id,
      phone: session.phone,
      provider: 'MSG91',
    };
  } catch (error) {
    console.error('❌ MSG91 SMS resend failed:', error);
    throw error;
  }
};

module.exports = {
  generateAndSendOTP,
  getVerificationSession,
  verifyOTP,
  sendSMS,
  resendSMS,
};
