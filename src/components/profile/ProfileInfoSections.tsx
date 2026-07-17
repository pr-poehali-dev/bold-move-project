import type { Dispatch, SetStateAction } from "react";
import { Section, Field, PhoneField } from "./ProfileFieldControls";

export interface ProfileFormData {
  name: string;
  phone: string;
  company_name: string;
  company_inn: string;
  company_addr: string;
  website: string;
  telegram: string;
}

interface Props<T extends ProfileFormData> {
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  email: string;
}

export default function ProfileInfoSections<T extends ProfileFormData>({ form, setForm, email }: Props<T>) {
  return (
    <>
      {/* Личные данные */}
      <Section title="Личные данные" icon="User">
        <Field label="Имя"     value={form.name}  onChange={v => setForm(f => ({ ...f, name: v }))}  placeholder="Иван Петров" />
        <PhoneField label="Телефон" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
        <Field label="Email"   value={email || ""} readonly />
      </Section>

      {/* Компания */}
      <Section title="Компания" icon="Building2">
        <Field label="Название" value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="ООО «Натяжные потолки»" />
        <Field label="ИНН"      value={form.company_inn}  onChange={v => setForm(f => ({ ...f, company_inn: v }))}  placeholder="7712345678" />
        <Field label="Адрес"    value={form.company_addr} onChange={v => setForm(f => ({ ...f, company_addr: v }))} placeholder="г. Москва, ул. Примерная, 1" />
      </Section>

      {/* Контакты */}
      <Section title="Контакты" icon="Globe">
        <Field label="Сайт"     value={form.website}  onChange={v => setForm(f => ({ ...f, website: v }))}  placeholder="https://mysite.ru" />
        <Field label="Telegram" value={form.telegram} onChange={v => setForm(f => ({ ...f, telegram: v }))} placeholder="@username" />
      </Section>
    </>
  );
}