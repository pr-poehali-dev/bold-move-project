import { forwardRef, useEffect, useRef, useState } from "react";
import { formatPhone, isPhoneValid } from "@/hooks/use-phone";

/**
 * Универсальное поле ввода телефона.
 * - Маска +7 (___) ___-__-__ видна сразу при монтировании
 * - При вводе автоматически форматируется
 * - При попытке стереть префикс "+7 (" — он восстанавливается
 * - Валидация: должно быть ровно 11 цифр
 *
 * Возвращает в onChange всегда отформатированную строку.
 */
interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (formatted: string) => void;
  showValidation?: boolean;  // показывать ли красную рамку при невалидном значении
}

const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, showValidation, className, style, ...rest }, ref,
) {
  const [touched, setTouched] = useState(false);

  // Если пришло пустое значение — стартуем с "+7 (" чтобы маска была сразу видна
  useEffect(() => {
    if (!value) {
      onChange("+7 (");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const digits = v.replace(/\D/g, "");
    // если пользователь стёр всё до пустоты — оставим маску
    if (digits.length === 0) { onChange("+7 ("); return; }
    onChange(formatPhone(v));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!value || value === "") onChange("+7 (");
    rest.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    rest.onBlur?.(e);
  };

  const valid = !value || value === "+7 (" || isPhoneValid(value);
  const showError = showValidation && touched && !valid && value !== "+7 (" && value.length > 0;

  return (
    <input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value || "+7 ("}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="+7 (___) ___-__-__"
      className={className}
      style={{
        ...style,
        ...(showError ? { borderColor: "#ef4444" } : {}),
      }}
      {...rest}
    />
  );
});

export default PhoneInput;
