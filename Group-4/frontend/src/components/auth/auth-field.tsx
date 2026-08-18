import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { Eye, EyeOff } from 'lucide-react'

// 007-ui-design v2.pen alan deseni: 12px etiket (#6B7280) + 8px koseli,
// #F8FAFC zeminli, #E5E7EB cerceveli kutu. Etiket GORUNUR (eski formlarda
// sr-only idi) — tasarimin kendisi boyle ve e2e secicileri de placeholder
// yerine etikete baglanabiliyor.
export function AuthField({
  label,
  type = 'text',
  children,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  children?: ReactNode
}) {
  const otomatikId = useId()
  const id = rest.id ?? otomatikId
  const [gorunur, setGorunur] = useState(false)
  const parola = type === 'password'

  return (
    <div className="relative flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-[var(--color-text-muted)]"
      >
        {label}
      </label>
      {/* Odakta TEK mavi kenar gorunur: disaridaki halka. Iki kaynak da
          kapatilir — (1) kutunun kendi cercevesi gri kalir (focus-within ile
          maviye DONMEZ), (2) ic input'un halkasi `!` ile susturulur, cunku
          index.css'teki genel `:focus-visible` kurali KATMANSIZ ve katmanli
          Tailwind utility'sini yener; `outline-none` tek basina yetmiyor. */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-accent)]">
        <input
          {...rest}
          id={id}
          type={parola && gorunur ? 'text' : type}
          className="w-full bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:outline-none!"
        />
        {parola && (
          <button
            type="button"
            onClick={() => setGorunur((v) => !v)}
            aria-label={gorunur ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="shrink-0 text-[var(--color-text-muted)]"
          >
            {gorunur ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
