import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n/language-provider';

// FR-027: sure sadece BILGILENDIRICI istemci UI'si, sunucu zorlamaz. Parent
// mount/unmount eder (key={question.order}) boylece her soruda sifirdan baslar.
// Interval bir kez kurulur (deps: []) — parent re-render (ör. yazi girisi) onu
// yeniden baslatmaz; onExpire ref uzerinden hep guncel tutulur.
export function QuestionTimer({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const { t } = useTranslation('interview');
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Setinterval updater'i sirasinda onExpire cagirmak "baska bilesen render
  // ederken state guncelleme" hatasi verir — bu yuzden ayri bir effect'te,
  // remaining 0'a ULASTIGINDA (yalnizca bir kez) tetiklenir.
  const firedRef = useRef(false);
  useEffect(() => {
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpireRef.current();
    }
  }, [remaining]);

  return (
    <p role="timer" className="text-sm text-[var(--color-text-muted)]">
      {t('timer.remaining', { seconds: remaining })}
    </p>
  );
}
