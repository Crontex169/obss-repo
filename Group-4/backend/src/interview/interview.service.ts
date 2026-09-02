// DOSYA REHBERİ: Görüşme akışının asıl beyni — soru üretimi, cevap kaydetme,
// adaptif bir sonraki soru seçimi ve rapor oluşturma adımlarını LLM servisini
// ve veritabanını kullanarak yürütür. Controller sadece isteği buraya iletir.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Interview } from '@prisma/client';
import { resolveLanguage } from '../common/language';
import { LlmService } from '../llm/llm.service';
import { PdfExtractionService } from '../pdf/pdf-extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInterviewInput } from './dto/create-interview.dto';
import type { SubmitAnswerInput } from './dto/submit-answer.dto';
import {
  buildQuestionGenerationSchema,
  buildQuestionGenerationSystemPrompt,
  InvalidJobPostingError,
  QUESTION_GENERATION_TEMPERATURE,
  wrapCvAsData,
  wrapJobPostingAsData,
  wrapPreAssessmentContextAsData,
  type QuestionGenerationResult,
} from './llm/question-generation';
import { buildQuestionBlueprint } from './llm/question-blueprint';
import { LlmSchemaError } from '../llm/llm.errors';
import {
  isNoExperienceAnswer,
  sanitizeFreeText,
  withNoExperienceOption,
} from './llm/prompt-shared';
import { fetchLinkedInJob } from './linkedin-job';
import type { PanelEventInput } from './dto/panel-event.dto';
import {
  REPORT_TIMEOUT_MS,
  REPORT_TEMPERATURE,
  scoreMatchesBand,
  buildReportSystemPrompt,
  buildTranscript,
  reportSchema,
} from './llm/report';
import {
  CV_MATCH_MAX_TOKENS,
  CV_MATCH_TEMPERATURE,
  buildCvMatchSystemPrompt,
  cvMatchSchema,
  type CvMatchResult,
} from './llm/cv-match';
import type { CvMatchRequestInput } from './dto/cv-match.dto';
import {
  ADAPTIVE_TEMPERATURE,
  buildAdaptiveSchema,
  buildAdaptiveSystemPrompt,
  buildAdaptiveUserData,
} from './llm/adaptive';

export interface CreateInterviewArgs {
  dto: CreateInterviewInput;
  file: Express.Multer.File | undefined;
  // CV eklenmesi opsiyoneldir (sadece PDF) — is ilani kaynagindan bagimsizdir.
  cvFile: Express.Multer.File | undefined;
  acceptLanguage: string | undefined;
  userId: string;
}

// Adaya donen soru govdesi. topic/layer/style BILEREK DISARIDA: plan DAHILI bir
// olcum yapisidir; aday "bu, X konusunun 3. katmani" bilgisini gorseydi sorunun
// zorluk kademesini onceden okur ve cevabini ona gore ayarlardi (adaptive.ts
// interviewerRemark kuralindaki ayni gerekce — degerlendirme sinyali sizmamali).
const QUESTION_SELECT = {
  id: true,
  order: true,
  type: true,
  text: true,
  options: true,
  tip: true,
  rationale: true,
} as const;

// FR-031/FR-033 (Ipucu & Rehberlik paneli): LLM ciktisi depolanmadan once
// serbest metin sanitizasyonundan gecirilir (Ilke V) — null oldugu gibi kalir.
function sanitizeNullable(value: string | null): string | null {
  return value === null ? null : sanitizeFreeText(value);
}

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly pdf: PdfExtractionService,
  ) {}

  // US1: iş ilanı girişi + soru üretimi (FR-001..FR-005, FR-019..FR-023).
  async create(args: CreateInterviewArgs): Promise<Interview> {
    const { dto, file, cvFile, userId } = args;

    // 009-linkedin-ilan-cekme: sanitizeFreeText UCLU ifadenin SONUCUNA uygulanir,
    // dal basina degil. jobPostingText su ana kadar hicbir kaynak turunde
    // sanitize edilmiyordu; wrapJobPostingAsData tek basina sahte kapanis
    // etiketini temizlemez (FR-012, Ilke V). Tek satir, uc kaynagi da kapsar.
    const jobPostingText = await this.resolveJobPostingText(dto, file);

    // CV eklenmesi opsiyoneldir; verilmediyse blok hic uretilmez (asagida
    // filter(Boolean) ile userData'dan dusuyor). Icerik DB'ye YAZILMAZ —
    // yalnizca bu cagri icin gecici olarak kullanilir (Ilke V, veri asgarisi).
    const cvText = await this.resolveCvText(userId, cvFile, dto.useStoredCv);

    const language = resolveLanguage(args.acceptLanguage);

    // 003-pre-assessment FR-016/FR-030: aktif kayit varsa raporu context olarak
    // veriyoruz. Zorunlu bagimlilik DEGIL — kayit yoksa akis normal devam eder.
    const preAssessmentContextBlock =
      await this.getActivePreAssessmentContextBlock(userId);

    // T053: LLM çağrısı transaction'dan ÖNCE tamamlanır — hata/timeout/şema
    // uyuşmazlığında hiçbir yarım kayıt (Interview veya Question) oluşmaz (FR-019).
    // T125: sabit varsayilan tavan (4096) N=20'de yaniti yarida keser (olcum:
    // N=6 icin 1682 output token → ~280/soru). Guvenlik payiyla olcekle.
    // Katmanli plan her soruya uc alan daha ekledi (topic/layer/style), bu yuzden
    // soru basina pay 400'den 450'ye cikarildi — tavan yetmezse yanit yarida
    // kesilir ve hata SEMA hatasi gibi gorunur (teshisi zor).
    const questionGenerationMaxTokens = 800 + dto.questionCount * 450;

    const generationArgs = {
      schema: buildQuestionGenerationSchema(dto.questionCount, dto.mode),
      schemaName: 'question_generation',
      systemPrompt: buildQuestionGenerationSystemPrompt({
        jobPostingText,
        questionCount: dto.questionCount,
        mode: dto.mode,
        level: dto.level,
        language,
        hasPreAssessmentContext: !!preAssessmentContextBlock,
        hasCvContext: !!cvText,
      }),
      userData: [
        wrapJobPostingAsData(jobPostingText),
        cvText ? wrapCvAsData(cvText) : undefined,
        preAssessmentContextBlock,
      ]
        .filter(Boolean)
        .join('\n'),
      operation: 'question_generation' as const,
      userId,
      maxTokens: questionGenerationMaxTokens,
      temperature: QUESTION_GENERATION_TEMPERATURE,
    };

    // SEMA HATASINDA BIR KEZ TEKRAR DENE — yalnizca bu cagri icin.
    //
    // Soru uretimi projedeki EN KISITLI LLM ciktisidir: N sorunun her biri
    // katmanli plana (katman/tarz/bicim) uymak, grup ici konu butunlugunu
    // korumak ve tam N adet olmak zorunda. Bu kisitlar saglayicinin
    // constrained decoding'i tarafindan ZORLANMAZ (yalnizca alan tipleri
    // zorlanir); ihlali ancak Zod yakalar. Tek sapma tum mulakati 502'ye
    // dusuruyordu ve kullanici hicbir sey almadan saatlik kotasindan (3) bir
    // hak kaybediyordu.
    //
    // Sicaklik 0.8 (cesitlilik icin bilincli) oldugundan ikinci deneme AYNI
    // girdiyle farkli bir cikti uretir ve pratikte tutar. BIR kez: sonsuz
    // dongu ve iki katindan fazla maliyet olmasin.
    //
    // Yalnizca LlmSchemaError icin. Saglayici/timeout hatalari buraya girmez —
    // onlarin telafisi yedek saglayiciya gecis (LlmService) ve kota iadesidir
    // (LlmQuotaRefundInterceptor); burada tekrarlanirsa ayni ariza iki kez
    // beklenir ve kullanici iki kat sure bekler.
    let generated: QuestionGenerationResult;
    try {
      generated = await this.llm.generateStructured(generationArgs);
    } catch (error) {
      if (!(error instanceof LlmSchemaError)) throw error;
      this.logger.warn(
        `Soru uretimi semayi gecemedi, BIR kez tekrar deneniyor ` +
          `(userId=${userId}, questionCount=${dto.questionCount}, mode=${dto.mode})`,
      );
      generated = await this.llm.generateStructured(generationArgs);
    }

    // Gruplar arasi konu tekrari sema hatasi DEGIL (question-generation.ts),
    // ama sessiz de gecilmez (Ilke VI): tekil konu sayisi plandaki grup
    // sayisindan azsa set vaat ettiginden dar bir kesit olcuyor demektir.
    const distinctTopics = new Set(
      generated.questions.map((q) => q.topic.trim().toLocaleLowerCase('tr')),
    ).size;
    const plannedTopics = new Set(
      buildQuestionBlueprint(dto.questionCount, dto.mode).map(
        (s) => s.topicIndex,
      ),
    ).size;
    if (generated.rejection === null && distinctTopics < plannedTopics) {
      this.logger.warn(
        `Soru seti planlanandan az konu kapsiyor (userId=${userId}): ` +
          `beklenen=${plannedTopics} gelen=${distinctTopics}`,
      );
    }

    // FR-028: LLM ilanin gecersiz oldugunu bildirdi. TokenUsage zaten yazildi
    // (generateStructured icinde, basarili sema dogrulamasi ile) — reddedilen
    // cagri da maliyet uretmistir. LlmSchemaError (502) DEGIL: LLM dogru
    // calisti, sorun kullanici girdisi (contracts §4.1) — 422 firlatilir,
    // Interview/Question hicbir kayit olusturulmaz.
    if (generated.rejection !== null) {
      throw new InvalidJobPostingError();
    }

    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          userId,
          jobPostingSource: dto.jobPostingSource,
          jobPostingText,
          jobPostingFileName: file?.originalname,
          questionCount: dto.questionCount,
          mode: dto.mode,
          adaptiveEnabled: dto.adaptiveEnabled,
          level: dto.level,
          language,
          position: generated.position,
        },
      });

      await tx.question.createMany({
        data: generated.questions.map((q, i) => ({
          interviewId: interview.id,
          order: i + 1,
          type: q.type,
          text: q.text,
          // Coktan secmeli sorulara "bu konuda deneyimim yok" sikki
          // deterministik olarak eklenir (LLM'e URETTIRILMEZ, prompt-shared.ts).
          options:
            q.type === 'multiple_choice'
              ? withNoExperienceOption(q.options, language)
              : q.options,
          tip: sanitizeNullable(q.tip),
          rationale: sanitizeNullable(q.rationale),
          // Katmanli plan kayitla saklanir: rapor "hangi konunun kacinci
          // katmaninda dusuldugunu" ancak boyle gorebilir (bkz. buildTranscript).
          // Konu adi serbest metindir (LLM uretir) — prompt'a geri gidecegi icin
          // ayni sanitizasyondan gecer (FR-012).
          topic: sanitizeFreeText(q.topic),
          layer: q.layer,
          style: q.style,
        })),
      });

      return interview;
    });
  }

  // 003-pre-assessment FR-016/FR-030 + 011-adaptif-on-degerlendirme-baglami:
  // aktif+tamamlanmis kayit varsa CompetencyReport'u izole bir VERI blogu
  // olarak dondurur; hem baseline soru uretimi hem de adaptif uyarlama AYNI
  // kaynagi kullanir (create() ve adaptNextQuestion()). Kayit yoksa undefined
  // doner — zorunlu bagimlilik degildir, akis normal devam eder.
  private async getActivePreAssessmentContextBlock(
    userId: string,
  ): Promise<string | undefined> {
    const activePreAssessment = await this.prisma.preAssessment.findFirst({
      where: { userId, isActive: true, status: 'completed' },
      select: {
        skills: true,
        selfRatings: true,
        report: {
          select: {
            genelOzet: true,
            gucluYonler: true,
            gelisimAlanlari: true,
            calismaTarziOzeti: true,
            guvenSeviyesi: true,
          },
        },
      },
    });
    if (!activePreAssessment?.report) return undefined;
    return wrapPreAssessmentContextAsData({
      ...activePreAssessment.report,
      selfRatings: activePreAssessment.selfRatings
        ? (activePreAssessment.selfRatings as Record<string, number>)
        : undefined,
      skills: activePreAssessment.skills,
    });
  }

  // 009-linkedin-ilan-cekme: cekme hatalari KULLANICI GIRDISI hatasidir.
  // Yakalanmazsa HttpExceptionFilter bunlari 500 yapar ve kullanici akista
  // sıkısır; 400 ile metin/PDF yoluna yonlendirilebilir (specs/009 §2.4).
  private async fetchJobPostingFromUrl(url: string): Promise<string> {
    try {
      return await fetchLinkedInJob(url);
    } catch (error) {
      this.logger.warn(
        `Ilan baglantisindan metin cekilemedi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Ilan baglantisi okunamadi.',
      );
    }
  }

  // Ilan metnini kaynagindan (metin/PDF/LinkedIn URL) cozer ve prompt'a
  // girmeye hazir hale getirir. sanitizeFreeText UCLU ifadenin SONUCUNA
  // uygulanir, dal basina degil (009-linkedin-ilan-cekme, FR-012).
  //
  // create() ve cvJobMatch() ayni kurallari paylasmak ZORUNDA: ayrisirlarsa
  // ayni LinkedIn baglantisi bir uctan gecip digerinden gecmezdi.
  private async resolveJobPostingText(
    dto: {
      jobPostingSource: string;
      jobPostingText?: string;
      jobPostingUrl?: string;
    },
    file: Express.Multer.File | undefined,
  ): Promise<string> {
    return sanitizeFreeText(
      dto.jobPostingSource === 'pdf'
        ? await this.pdf.extractText(file!.buffer, file!.mimetype)
        : dto.jobPostingSource === 'url'
          ? await this.fetchJobPostingFromUrl(dto.jobPostingUrl!)
          : dto.jobPostingText!.trim(),
    );
  }

  // Oncelik: bu istekte yuklenen dosya > Ayarlar'daki kayitli CV profili.
  // Kayitli metin DB'ye YAZILIRKEN sanitize edildi (users.service.ts), burada
  // tekrar temizlenmez. CV yoksa undefined — cagiran katman ne yapacagina
  // kendisi karar verir (soru uretimi CV'siz devam eder, uyum analizi 400 verir).
  private async resolveCvText(
    userId: string,
    cvFile: Express.Multer.File | undefined,
    useStoredCv: boolean,
  ): Promise<string | undefined> {
    if (cvFile) {
      return sanitizeFreeText(
        await this.pdf.extractText(cvFile.buffer, cvFile.mimetype),
      );
    }
    if (!useStoredCv) return undefined;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cvText: true },
    });
    return user.cvText ?? undefined;
  }

  // Ilan x CV uyum analizi. Gorusme OLUSTURMAZ, hicbir sey KAYDETMEZ (token
  // kaydi haric): aday mulakata girmeden once nereye calisacagini gorur.
  // Sonucu saklamamak bilincli — ilan da CV de degisir, bayat bir analiz
  // yanlis yonlendirir; yeniden calistirmak tek LLM cagrisidir.
  async cvJobMatch(args: {
    dto: CvMatchRequestInput;
    file: Express.Multer.File | undefined;
    cvFile: Express.Multer.File | undefined;
    acceptLanguage: string | undefined;
    userId: string;
  }): Promise<CvMatchResult> {
    const { dto, file, cvFile, userId } = args;

    const cvText = await this.resolveCvText(userId, cvFile, dto.useStoredCv);
    if (!cvText || cvText.trim().length === 0) {
      throw new BadRequestException(
        'Uyum analizi icin bir CV gerekli. Ayarlardan CV yukleyin veya bu istekte dosya ekleyin.',
      );
    }

    const jobPostingText = await this.resolveJobPostingText(dto, file);
    const language = resolveLanguage(args.acceptLanguage);

    return this.llm.generateStructured({
      schema: cvMatchSchema,
      schemaName: 'cv_job_match',
      systemPrompt: buildCvMatchSystemPrompt(language),
      // Iki blok da AYRI etiketlerle sarmalanir: model hangi metnin ilan,
      // hangisinin CV oldugunu karistirirsa "eksik yetkinlik" listesi tersine doner.
      userData: [
        wrapJobPostingAsData(jobPostingText),
        wrapCvAsData(cvText),
      ].join('\n'),
      operation: 'cv_job_match',
      userId,
      maxTokens: CV_MATCH_MAX_TOKENS,
      temperature: CV_MATCH_TEMPERATURE,
    });
  }

  // ADR-0014: transcribe ucu Whisper'a dogru dil ipucunu vermek icin sadece
  // bu alani okur — findOne() gibi agir bir sorgu (questions+answer+report
  // include'u) gerekmez.
  async languageOf(id: string): Promise<'tr' | 'en'> {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id },
      select: { language: true },
    });
    return interview.language;
  }

  async currentQuestionOf(interviewId: string) {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });
    if (interview.status !== 'in_progress') return null;

    return this.prisma.question.findUnique({
      where: {
        interviewId_order: {
          interviewId,
          order: interview.currentQuestionOrder,
        },
      },
      select: QUESTION_SELECT,
    });
  }

  // US2: sirali kilit + cevap kaydi + tamamlanma gecisi (FR-006..FR-008, FR-012,
  // FR-024, contracts/interview-flow-rules.md §2).
  async submitAnswer(interviewId: string, dto: SubmitAnswerInput) {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });

    // Sirali kilit: TEK kaynak currentQuestionOrder karsilastirmasidir — ayrica
    // status kontrolu gerekmez, tamamlanmis gorusmede currentQuestionOrder zaten
    // N+1'e ilerletilmis olur (asagida) ve her deneme "zaten cevaplanmis" (<) dalina duser.
    if (dto.questionOrder < interview.currentQuestionOrder) {
      throw new ConflictException('Bu soru zaten cevaplanmis.');
    }
    if (dto.questionOrder > interview.currentQuestionOrder) {
      throw new ConflictException('Siradaki soru bu degil.');
    }

    const question = await this.prisma.question.findUniqueOrThrow({
      where: { interviewId_order: { interviewId, order: dto.questionOrder } },
    });

    if (
      question.type === 'multiple_choice' &&
      dto.content !== '' &&
      !question.options.includes(dto.content)
    ) {
      throw new BadRequestException(
        'Gecersiz secenek: cevap sunulan secenekler arasinda olmalidir.',
      );
    }

    const isLastQuestion = dto.questionOrder === interview.questionCount;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Sirali kilidin ASIL uygulandigi yer burasi. Yukaridaki karsilastirma
      // transaction DISINDA okunmus bir kopyaya bakar: ayni soru icin iki istek
      // ayni anda gelirse (sure dolarken "Gonder"e basmak) IKISI de o kontrolden
      // gecer, ikisi de Answer yazmaya calisir ve questionId @unique yuzunden
      // biri P2002 ile 500'e duserdi.
      //
      // updateMany + currentQuestionOrder kosulu bunu kapatir: Postgres ikinci
      // transaction'i satir kilidinde bekletir, birincisi commit edince kosul
      // artik tutmaz ve count 0 doner. Yani "kim once yazdi" karari veritabaninda
      // verilir, uygulamada degil.
      const { count } = await tx.interview.updateMany({
        where: { id: interviewId, currentQuestionOrder: dto.questionOrder },
        data: isLastQuestion
          ? {
              currentQuestionOrder: dto.questionOrder + 1,
              status: 'completed',
              completedAt: new Date(),
              reportStatus: 'pending',
            }
          : { currentQuestionOrder: dto.questionOrder + 1 },
      });
      if (count === 0) {
        // Yarisi kaybeden istek: cevap kaydedilmez, transaction geri alinir.
        // Sozlesmedeki mesajin AYNISI (contracts §2) — istemci icin bu, sirali
        // kilidin normal 409'undan ayirt edilebilir bir durum degildir.
        throw new ConflictException('Bu soru zaten cevaplanmis.');
      }

      await tx.answer.create({
        data: {
          questionId: question.id,
          content: dto.content,
          sourceMode: interview.mode,
        },
      });

      return tx.interview.findUniqueOrThrow({ where: { id: interviewId } });
    });

    if (isLastQuestion) {
      // Rapor uretimi ESZAMANLI tetiklenir (contracts §4). Hata FIRLATMAZ:
      // cevap zaten kaydedildi, kullanici onu kaybetmemeli — basarisizlik
      // reportStatus='failed' olarak yansir ve retry uc noktasiyla telafi edilir
      // (FR-015, SC-008).
      const withReport = await this.generateReport(interviewId);
      return {
        interview: withReport.interview,
        currentQuestion: null,
        // Son soruda gecis repligi yok: sozlu modda kapanis metni istemcide
        // sablondan gelir (FR-037).
        interviewerRemark: null,
      };
    }

    // US4 (bonus): adaptif uyarlama. Basarisizlik akisi KESMEZ — baseline soru
    // oldugu gibi sunulur (FR-011).
    // FR-038: adaptif akis KAPALIYSA replik uretilmez (ek LLM cagrisi YAPILMAZ)
    // — istemci sablon gecisine duser, sozlu akis yine kesintisiz ilerler.
    const interviewerRemark = interview.adaptiveEnabled
      ? await this.adaptNextQuestion({
          interview,
          askedQuestionText: question.text,
          answerContent: dto.content,
          nextOrder: updated.currentQuestionOrder,
          // "Deneyimim yok" sikki secildiyse siradaki soru bu konuyu
          // derinlestirmemeli (adaptive.ts).
          answerIndicatesNoExperience:
            question.type === 'multiple_choice' &&
            isNoExperienceAnswer(dto.content, interview.language),
        })
      : null;

    return {
      interview: updated,
      interviewerRemark,
      currentQuestion: await this.prisma.question.findUnique({
        where: {
          interviewId_order: {
            interviewId,
            order: updated.currentQuestionOrder,
          },
        },
        select: QUESTION_SELECT,
      }),
    };
  }

  // US4: yalnizca HENUZ GOSTERILMEMIS siradaki soruyu uyarlar (FR-010, FR-011,
  // contracts/interview-flow-rules.md §3).
  //
  // FR-038: ayni cagridan gelen gecis repligini dondurur. Replik KALICI DEGIL —
  // gorusmenin bir parcasi degil, o anki seslendirmenin bir parcasi; kaydedilse
  // Answer immutability'sinin yanina anlamsiz bir ikinci metin koyardi.
  private async adaptNextQuestion(args: {
    interview: Interview;
    askedQuestionText: string;
    answerContent: string;
    nextOrder: number;
    answerIndicatesNoExperience: boolean;
  }): Promise<string | null> {
    const { interview, nextOrder } = args;

    const target = await this.prisma.question.findUnique({
      where: {
        interviewId_order: { interviewId: interview.id, order: nextOrder },
      },
      include: { answer: true },
    });

    // Savunma: cevaplanmis soru DONMUSTUR, uyarlanamaz (data-model.md kurali).
    // Normal akista buraya cevaplanmis bir soru gelmez; kural yine de burada
    // uygulanir cunku "gosterilmemis olma" garantisi tek yerde durmali.
    if (!target || target.answer) return null;

    // 011-adaptif-on-degerlendirme-baglami: create() ile AYNI kaynak — aktif+
    // tamamlanmis kayit varsa uyarlama da bu baglami goz onunde bulundurabilir
    // (ör. "deneyimim yok" durumunda hangi temel konuya gecilecegi). Zorunlu
    // degil; kayit yoksa/degistiyse uyarlama etkilenmeden calisir.
    const preAssessmentContextBlock =
      await this.getActivePreAssessmentContextBlock(interview.userId);

    try {
      const result = await this.llm.generateStructured({
        schema: buildAdaptiveSchema(target.type),
        schemaName: 'adaptive_evaluation',
        systemPrompt: buildAdaptiveSystemPrompt({
          targetType: target.type,
          level: interview.level,
          language: interview.language,
          answerIndicatesNoExperience: args.answerIndicatesNoExperience,
          hasPreAssessmentContext: !!preAssessmentContextBlock,
        }),
        // Soru metinleri de cevapla birlikte VERI olarak gider (§5): uyarlanmis
        // soru metni bir sonraki turda askedQuestion olarak geri geliyor.
        // On degerlendirme baglami da (varsa) ayni disiplinle izole VERI blogu
        // olarak eklenir — sistem talimatina yalnizca var/yok bilgisi girer.
        userData: [
          buildAdaptiveUserData({
            askedQuestion: args.askedQuestionText,
            answerContent: args.answerContent,
            nextQuestionBaseline: target.text,
          }),
          preAssessmentContextBlock,
        ]
          .filter(Boolean)
          .join('\n'),
        operation: 'adaptive_evaluation',
        userId: interview.userId,
        interviewId: interview.id,
        temperature: ADAPTIVE_TEMPERATURE,
      });

      // Gorusme ani gozlemi ONCE yazilir: bu, CEVABIN degerlendirmesidir ve
      // uyarlamanin basarili olup olmamasindan bagimsiz olarak dogrudur.
      // Onceden her turda uretilip hicbir yere yazilmiyordu — model bedelini
      // odedigimiz bir sinyali copa atiyorduk.
      const evaluatedAnswerId = await this.answerIdOf(
        interview.id,
        args.nextOrder - 1,
      );
      if (evaluatedAnswerId) {
        await this.prisma.answer.update({
          where: { id: evaluatedAnswerId },
          // Rapora prompt icinde geri gidecek LLM ciktisi — depolanmadan once
          // sanitize edilir (Ilke V, FR-012).
          data: {
            evaluationSummary: sanitizeFreeText(result.evaluationSummary),
          },
        });
      }

      // Soru SAYISI degismez — yalnizca icerik guncellenir (FR-010).
      await this.prisma.question.update({
        where: { id: target.id },
        data: {
          text: result.nextQuestion.text,
          // Uyarlanmis soru da coktan secmeliyse "deneyimim yok" sikki
          // yeniden eklenir (LLM'in ciktisinda olmayabilir, deterministiktir).
          options:
            target.type === 'multiple_choice'
              ? withNoExperienceOption(
                  result.nextQuestion.options,
                  interview.language,
                )
              : result.nextQuestion.options,
          // FR-031: soru icerigi degistigi icin ipucu/gerekce de guncellenir.
          tip: sanitizeNullable(result.nextQuestion.tip),
          rationale: sanitizeNullable(result.nextQuestion.rationale),
          isBaseline: false,
          adaptedFromAnswerId: evaluatedAnswerId,
        },
      });

      // FR-033 ile ayni disiplin: adaya gosterilen/okunan LLM ciktisi duz metne
      // indirgenir (Ilke V).
      return sanitizeNullable(result.interviewerRemark);
    } catch (error) {
      // Sessiz basarisizlik DEGIL: loglanir. Ama akis kesilmez ve baseline
      // soru degismeden sunulur (FR-011, Hikaye 4 kriter 3).
      this.logger.warn(
        `Adaptif uyarlama basarisiz, baseline soru korunuyor (interviewId=${interview.id}, order=${nextOrder}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Replik de uretilemedi; istemci sablon gecisine duser (FR-037).
      return null;
    }
  }

  private async answerIdOf(
    interviewId: string,
    order: number,
  ): Promise<string | null> {
    const question = await this.prisma.question.findUnique({
      where: { interviewId_order: { interviewId, order } },
      include: { answer: true },
    });
    return question?.answer?.id ?? null;
  }

  // US5: rapor uretimi/orkestrasyonu (FR-013, FR-014, FR-015).
  // pending -> ready | failed. Hata YUTULMAZ ama cagirana FIRLATILMAZ; durum
  // reportStatus'e yazilir, cevaplar korunur.
  private async generateReport(interviewId: string) {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { answer: true } },
      },
    });

    const pairs = interview.questions
      .filter((q) => q.answer !== null)
      .map((q) => ({
        order: q.order,
        questionText: q.text,
        options: q.options,
        answerContent: q.answer!.content,
        // Katmanli plan + gorusme ani gozlemi: rapor bunlari gormeden "hangi
        // konunun kacinci katmaninda dusuldugunu" cikaramaz. Eski gorusmelerde
        // null gelir ve transcript'e hic yazilmaz.
        topic: q.topic,
        layer: q.layer,
        evaluationSummary: q.answer!.evaluationSummary,
      }));

    try {
      const generated = await this.llm.generateStructured({
        schema: reportSchema,
        schemaName: 'interview_report',
        systemPrompt: buildReportSystemPrompt({
          level: interview.level,
          language: interview.language,
          hasPosition: interview.position !== null,
        }),
        // position da kayitla birlikte VERI olarak gider (§5).
        userData: buildTranscript({ position: interview.position, pairs }),
        // Varsayilan 30 sn bu cagriyi keserdi — tum set gonderiliyor (SC-005, §3.2).
        timeoutMs: REPORT_TIMEOUT_MS,
        // Issue #68: cikti artik soru basina bir geri bildirim blogu daha
        // iceriyor; sabit 4096 varsayilani N=20'de raporu yarida keserdi.
        // Soru uretimindeki (T125) ayni olcekleme mantigi.
        maxTokens: 1500 + pairs.length * 350,
        operation: 'interview_report',
        userId: interview.userId,
        interviewId,
        temperature: REPORT_TEMPERATURE,
      });

      // Bant/skor tutarliligi: sema her ikisini AYRI AYRI dogrular, ILISKIYI
      // dogrulayamaz. Model "zayif" bandini secip 78 yazarsa rapor kendi
      // icinde celisir ve capalar islevini kaybeder. Rapor REDDEDILMEZ (skor
      // yine 0-100 araliginda gecerli bir sayidir ve adayi rapor gormeden
      // birakmak daha kotu) ama sessiz de gecilmez — Ilke VI.
      for (const [axis, calibration] of Object.entries(generated.calibration)) {
        const score = generated.scores[axis as keyof typeof generated.scores];
        if (!scoreMatchesBand(calibration.band, score)) {
          this.logger.warn(
            `Rapor bant/skor celiskisi (interviewId=${interviewId}, eksen=${axis}): ` +
              `band=${calibration.band} skor=${score}`,
          );
        }
      }

      // Model kayitta olmayan bir sira numarasi uydurursa veya ayni soruyu iki
      // kez degerlendirirse UI'da eslesmeyen/cift kart olusur. Sema bunu
      // yakalayamaz (order'i tek tek dogrular, KUMEYI degil) — burada eleriz.
      const answeredOrders = new Set(pairs.map((p) => p.order));
      const seen = new Set<number>();
      const questionFeedback = generated.questionFeedback.filter((f) => {
        if (!answeredOrders.has(f.order) || seen.has(f.order)) return false;
        seen.add(f.order);
        return true;
      });

      const reportData = {
        overallImpression: generated.overallImpression,
        strengths: generated.strengths,
        improvementAreas: generated.improvementAreas,
        // ponytail: eksende hic soru yoksa (or. sozlu modda davranissal
        // soru sorulmadiysa) model yine de bir sayi uydurmak zorunda —
        // dogrusu bu kolonlarin nullable olmasi. Migration + grafik/PDF/
        // trend/admin (12+ nokta) birlikte degismeli, ayri is olarak dursun.
        technicalScore: generated.scores.technical,
        behavioralScore: generated.scores.behavioral,
        generalScore: generated.scores.general,
        // FR-026: LLM'den okunmaz — sema dogrulamasi gectikten SONRA
        // sunucuda hesaplanir; reportSchema'da zaten boyle bir alan yok,
        // dolayisiyla LLM yanitinda gelse bile Zod tarafindan atilir.
        overallScore: Math.round(
          (generated.scores.technical +
            generated.scores.behavioral +
            generated.scores.general) /
            3,
        ),
        additionalNotes: generated.additionalNotes ?? [],
        questionFeedback,
      };

      const [, updated] = await this.prisma.$transaction([
        // create DEGIL upsert: Report.interviewId @unique'tir ve satir bir kez
        // olustuktan sonra create ARTIK BASARILI OLAMAZ. Eszamanli iki retry
        // (veya interview.reportStatus'u 'ready' yapamadan yarida kalan bir
        // yazma) sonucunda "Report VAR ama reportStatus='failed'" durumu
        // olusabiliyordu; o noktadan sonra her retry P2002 alip yeniden
        // 'failed' yaziyordu, yani rapor KALICI olarak erisilemez kaliyordu.
        // Rapor zaten yeniden uretilebilir bir ciktidir (retry sozlesmesi
        // bunu soyler) — uzerine yazmak dogru davranistir.
        this.prisma.report.upsert({
          where: { interviewId },
          create: { interviewId, ...reportData },
          update: reportData,
        }),
        this.prisma.interview.update({
          where: { id: interviewId },
          data: { reportStatus: 'ready' },
        }),
      ]);

      return { interview: updated, error: null };
    } catch (error: unknown) {
      // Sessiz basarisizlik yasak (Ilke VI): durum kalici olarak isaretlenir ve loglanir.
      this.logger.error(
        `Rapor uretimi basarisiz (interviewId=${interviewId})`,
        error instanceof Error ? error.stack : String(error),
      );
      const updated = await this.prisma.interview.update({
        where: { id: interviewId },
        data: { reportStatus: 'failed' },
      });
      // Hata NESNESI de dondurulur: retry yolu 502/504 ayrimini koruyarak
      // yeniden firlatabilsin (§3.4). Otomatik akista (son cevap) yutulur.
      // Error'a normalize ediyoruz: cagiran taraf bunu dogrudan `throw` ediyor
      // ve `unknown` firlatmak hem lint hatasi hem de HttpException eslemesini
      // kaybettirir. LlmError zaten Error tureviyse oldugu gibi gecer.
      return {
        interview: updated,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // contracts/interview-api.md §5 — ready ise LLM'e TEKRAR GIDILMEZ (FR-014, SC-007).
  async getReport(interviewId: string) {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { report: true },
    });

    if (interview.status !== 'completed') {
      throw new ConflictException('Gorusme henuz tamamlanmadi.');
    }
    if (interview.reportStatus === 'failed') {
      throw new ConflictException(
        'Rapor uretimi basarisiz oldu. Tekrar deneyebilirsiniz.',
      );
    }
    if (interview.reportStatus !== 'ready' || !interview.report) {
      // 202: uretim suruyor (eszamanli akista nadiren yakalanir).
      return { status: 'pending' as const, report: null };
    }

    return { status: 'ready' as const, report: interview.report };
  }

  // contracts/interview-api.md §6 — yalnizca completed + failed durumunda gecerli.
  async retryReport(interviewId: string) {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });

    if (
      interview.status !== 'completed' ||
      interview.reportStatus !== 'failed'
    ) {
      throw new ConflictException(
        'Yeniden deneme yalnizca basarisiz rapor uretimi icin gecerlidir.',
      );
    }

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { reportStatus: 'pending' },
    });

    const result = await this.generateReport(interviewId);
    if (result.error) {
      // Retry KULLANICI TETIKLI: sessizce "failed" donmek yaniltir, orijinal
      // hata sinifi firlatilir -> 502 (saglayici/sema) veya 504 (timeout).
      // reportStatus 'failed' kaldi, cevaplar korunuyor, tekrar denenebilir.
      throw result.error;
    }
    return this.getReport(interviewId);
  }

  async findOne(id: string) {
    // Sahiplik/varlik kontrolu InterviewOwnershipGuard'da yapildi (404 orada
    // firlatilir); burada kayit gercekten yoksa da ayni 404 verilir (guard
    // sonrasi race durumu icin savunma).
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { answer: true } },
        report: true,
      },
    });
    if (!interview) throw new NotFoundException();

    const { questions, report, ...rest } = interview;

    // Cevaplanmis soru-cevap ciftleri DEGISMEDEN doner (FR-009, Hikaye 3 kriter 1).
    const answeredPairs = questions
      .filter((q) => q.answer !== null)
      .map((q) => ({
        order: q.order,
        type: q.type,
        text: q.text,
        options: q.options,
        tip: q.tip,
        rationale: q.rationale,
        answer: {
          content: q.answer!.content,
          answeredAt: q.answer!.answeredAt,
        },
      }));

    // KRITIK (FR-006): currentQuestionOrder'dan BUYUK hicbir sorunun metni/secenekleri
    // donmez — soru i+1, soru i cevaplanana kadar istemciye HIC gonderilmez.
    const currentQuestion =
      interview.status === 'in_progress'
        ? (questions.find((q) => q.order === interview.currentQuestionOrder) ??
          null)
        : null;

    return {
      ...rest,
      answeredPairs,
      currentQuestion: currentQuestion && {
        id: currentQuestion.id,
        order: currentQuestion.order,
        type: currentQuestion.type,
        text: currentQuestion.text,
        options: currentQuestion.options,
        tip: currentQuestion.tip,
        rationale: currentQuestion.rationale,
      },
      // completed + ready ise rapor AYNI kayittan doner, LLM'e gidilmez (FR-014, SC-007).
      report: interview.reportStatus === 'ready' ? report : null,
    };
  }

  // contracts/interview-api.md §2 — History ekraninin veri temeli.
  // Soft-delete gorunurlugu: sahibi silinmis kaydi GORMEZ, admin GORUR (§4.3).
  async list(user: { id: string; role: string }) {
    const isAdmin = user.role === 'admin';

    const interviews = await this.prisma.interview.findMany({
      where: isAdmin ? {} : { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        position: true,
        status: true,
        reportStatus: true,
        mode: true,
        level: true,
        language: true,
        questionCount: true,
        createdAt: true,
        completedAt: true,
        // Admin UI "silindi" isaretini bundan uretir; kullaniciya bu alanlar gitmez.
        ...(isAdmin ? { deletedAt: true, userId: true } : {}),
      },
    });

    // Tam soru/cevap/rapor icerigi bu uc noktada YER ALMAZ (§2).
    return interviews;
  }

  // contracts/interview-api.md §7, contracts/interview-flow-rules.md §4.4
  // (FR-034, issue #48). Salt telemetri: DB'ye yazilmaz, rapor/istatistigi
  // ETKILEMEZ — tek amac gozlemlenebilirlik (Ilke VI).
  logPanelEvent(
    interviewId: string,
    userId: string,
    input: PanelEventInput,
  ): void {
    this.logger.log(
      `Ipucu & Rehberlik paneli acildi: interviewId=${interviewId} userId=${userId} questionOrder=${input.questionOrder} tab=${input.tab}`,
    );
  }

  // "Bildir" aksiyonu (Görüşmelerim üç nokta menüsü) — sahiplik kontrolü
  // InterviewOwnershipGuard'da yapıldı; burada yalnızca kayıt yazılır.
  async reportProblem(
    interviewId: string,
    userId: string,
    message: string,
  ): Promise<void> {
    await this.prisma.interviewProblemReport.create({
      data: { interviewId, userId, message },
    });
  }

  // --- Rapor paylasim linki ---
  //
  // Amac: aday raporunu bir mentore/arkadasina gosterebilsin. Karsi tarafta
  // HESAP ISTENMEZ, yoksa paylasim pratikte hic kullanilmaz.
  //
  // Guvenlik duruşu: link BILEN HERKESE acik oldugundan token tahmin edilemez
  // olmali (192 bit rastgelelik) ve SURELI olmali — kalici link, unutulmus bir
  // kamuya acik rapor demektir. Kullanici istedigi an iptal edebilir.
  private static readonly SHARE_TTL_DAYS = 7;

  async createShareLink(
    interviewId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      select: { reportStatus: true, shareToken: true, shareExpiresAt: true },
    });

    // Rapor hazir degilse paylasilacak bir sey YOKTUR: link acilsa karsi taraf
    // bos/yarim bir sayfa gorurdu.
    if (interview.reportStatus !== 'ready') {
      throw new ConflictException(
        'Rapor hazir olmadan paylasim linki olusturulamaz.',
      );
    }

    // Zaten gecerli bir link varsa AYNISI doner: her tikta yeni token uretmek,
    // kullanicinin daha once gonderdigi linki sessizce olduruyordu.
    if (
      interview.shareToken &&
      interview.shareExpiresAt &&
      interview.shareExpiresAt > new Date()
    ) {
      return {
        token: interview.shareToken,
        expiresAt: interview.shareExpiresAt,
      };
    }

    // base64url: URL'de kacis gerektirmeyen alfabe (cuid/uuid'den daha fazla
    // entropi, daha kisa metin).
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(
      Date.now() + InterviewService.SHARE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { shareToken: token, shareExpiresAt: expiresAt },
    });

    return { token, expiresAt };
  }

  // Idempotent: link zaten yoksa da 204. Iptal, token'i NULL'lar — ayni link
  // bir daha calismaz (sure dolmasini beklemez).
  async revokeShareLink(interviewId: string): Promise<void> {
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { shareToken: null, shareExpiresAt: null },
    });
  }

  // ANONIM okuma yolu — oturum YOK, sahiplik guard'i YOK. Tek anahtar token.
  //
  // Donen icerikte kullanicinin KIMLIGI (ad/e-posta) YER ALMAZ: paylasilan sey
  // performanstir, kisi degil. Bulunamayan/suresi dolmus/silinmis her durum
  // AYNI 404'u verir — aksi halde token'in "var ama suresi dolmus" oldugu
  // bilgisi disariya sizardi.
  async findSharedReport(token: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { shareToken: token },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { answer: true } },
        report: true,
      },
    });

    if (
      !interview ||
      !interview.report ||
      interview.deletedAt !== null ||
      interview.shareExpiresAt === null ||
      interview.shareExpiresAt <= new Date()
    ) {
      throw new NotFoundException();
    }

    return {
      position: interview.position,
      level: interview.level,
      language: interview.language,
      completedAt: interview.completedAt,
      report: interview.report,
      answeredPairs: interview.questions
        .filter((q) => q.answer !== null)
        .map((q) => ({
          order: q.order,
          type: q.type,
          text: q.text,
          options: q.options,
          tip: q.tip,
          rationale: q.rationale,
          answer: {
            content: q.answer!.content,
            answeredAt: q.answer!.answeredAt,
          },
        })),
    };
  }

  // 004-history contracts/history-api.md §3 — soft-delete, fiziksel silme YOK.
  // Sahiplik + "zaten silinmis" kontrolu burada TEKRARLANMAZ: InterviewOwnershipGuard
  // bu istegi zaten filtrelemistir (2026-08-03 bulgusu — guard degistirilmeden
  // yeniden kullanilir, deletedAt dolu kayitlar guard seviyesinde 404 alir).
  async softDelete(interviewId: string): Promise<void> {
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { deletedAt: new Date() },
    });
  }
}
