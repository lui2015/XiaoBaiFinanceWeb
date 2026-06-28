/**
 * 短信服务抽象
 * - mock：开发模式，控制台打印验证码
 * - tencent：腾讯云 SMS
 */
type SmsProvider = 'mock' | 'tencent';

export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}

class MockSms implements SmsService {
  async sendOtp(phone: string, code: string) {
    console.log(`\n[MOCK-SMS] -> ${phone} : 您的验证码是 ${code}（5 分钟内有效）\n`);
  }
}

class TencentSms implements SmsService {
  async sendOtp(phone: string, code: string) {
    const sdk: any = await import('tencentcloud-sdk-nodejs-sms');
    const { Client } = sdk.sms.v20210111;
    const client = new Client({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
    });
    const resp = await client.SendSms({
      SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID,
      SignName: process.env.TENCENT_SMS_SIGN_NAME,
      TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID,
      TemplateParamSet: [code, '5'],
      PhoneNumberSet: [`+86${phone}`],
    });
    const item = resp?.SendStatusSet?.[0];
    if (!item || item.Code !== 'Ok') {
      throw new Error(`SMS send failed: ${item?.Code}/${item?.Message}`);
    }
  }
}

let _instance: SmsService | null = null;
export function getSms(): SmsService {
  if (_instance) return _instance;
  const provider = (process.env.SMS_PROVIDER as SmsProvider) || 'mock';
  _instance = provider === 'tencent' ? new TencentSms() : new MockSms();
  return _instance;
}
