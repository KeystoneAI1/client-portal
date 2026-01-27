import Twilio from "twilio";

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export async function sendVerificationCode(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  if (!isTwilioConfigured()) {
    console.error("Twilio not configured");
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: `Your Client Portal verification code is: ${code}. This code expires in 10 minutes.`,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });
    console.log(`SMS sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
}
