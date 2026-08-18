type SendArgs = { from: string; to: string; subject: string; html: string };
const sendMock = jest
  .fn<Promise<{ data: { id: string } }>, [SendArgs]>()
  .mockResolvedValue({ data: { id: 'test' } });
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { sendVerificationEmail } from './verification-mailer';

// ADR-0008: MAIL_TRANSPORT=resend -> Resend API cagirir; console -> yalnizca loglar (dogrulama akisini bloklamaz).
describe('sendVerificationEmail', () => {
  const email = 'aday@example.com';
  const url = 'https://example.com/verify?token=abc';
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    sendMock.mockClear();
  });

  it('MAIL_TRANSPORT=resend -> Resend emails.send dogru parametrelerle cagrilir', async () => {
    process.env.MAIL_TRANSPORT = 'resend';
    process.env.RESEND_API_KEY = 'test-key';
    process.env.MAIL_FROM = 'no-reply@example.com';

    await sendVerificationEmail(email, url);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@example.com',
        to: email,
      }),
    );
    expect(sendMock.mock.calls[0][0].html).toContain(url);
  });

  it('MAIL_TRANSPORT=console (varsayilan) -> Resend cagrilmaz', async () => {
    process.env.MAIL_TRANSPORT = 'console';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await sendVerificationEmail(email, url);

    expect(sendMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(url));
    logSpy.mockRestore();
  });
});
