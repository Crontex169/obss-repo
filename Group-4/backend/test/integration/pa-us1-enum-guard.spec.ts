import request from 'supertest';
import {
  createPreAssessmentTestApp,
  freshUser,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { validCreateBody } from './helpers/fake-competency-report';

// H1-4, FR-003, SC-008: enum disi / aralik disi deger -> 400 VE LLM CAGRILMAZ
// (fake cagri sayaciyla dogrulanir).
//
// Her senaryo TAZE kullanici acar (bkz. pa-app.ts freshUser yorumu).
describe('POST /api/pre-assessments (US1 enum guard)', () => {
  let ctx: PreAssessmentTestApp;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({
      where: { user: { email: { in: createdUsers } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: createdUsers } },
    });
    await ctx.app.close();
  });

  async function user(tag: string) {
    const u = await freshUser(ctx, `us1-enum-${tag}`);
    createdUsers.push(u.email);
    return u.cookies;
  }

  // 008: learningStyle / educationLevel semadan cikti - enum korumasi artik
  // onlar icin gecerli degil (gonderilirse yok sayilir, bkz. pa-us1-trim).
  it.each([
    ['experienceYears', 'yirmi_yil'],
    ['workStatus', 'emekli'],
    ['workPreference', 'kodlama'],
    ['teamPreference', 'uzaktan'],
    ['problemApproach', 'kacarim'],
  ])('gecersiz %s degeri -> 400, LLM cagrilmaz', async (field, value) => {
    const cookies = await user(field.toLowerCase());
    ctx.fakeLlm.reset();

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody({ [field]: value }));

    expect(res.status).toBe(400);
    expect(ctx.fakeLlm.calls).toHaveLength(0);
  });

  // 008: oz-degerlendirme puan araligi dogrulamasi kaldirildi - alan semada yok.
});
