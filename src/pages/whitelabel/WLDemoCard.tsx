import { DEMO_ID, DEMO_EMAIL, DEMO_PASSWORD } from "./wlTypes";
import { Section, Field, LinkBtn } from "./WLHelpers";

interface Props {
  parsedDomain: string | null;
  onOpenSite: () => void;
  onLoginAs: () => void;
  onRunApiTests: () => void;
  onEditBrand: () => void;
}

export function WLDemoCard({
  parsedDomain,
  onOpenSite,
  onLoginAs,
  onRunApiTests,
  onEditBrand,
}: Props) {
  const demoSiteUrl = parsedDomain
    ? `${parsedDomain}/?c=${DEMO_ID}`
    : `${window.location.origin}/?c=${DEMO_ID}`;

  return (
    <Section title="Демо-компания" icon="Building2" color="#a78bfa">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Email"    value={DEMO_EMAIL} />
        <Field label="Пароль"   value={DEMO_PASSWORD} />
        <Field label="ID"       value={`#${DEMO_ID}`} />
        <Field label="Демо-сайт" value={demoSiteUrl} href={`/?c=${DEMO_ID}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <LinkBtn icon="Globe"            label="Открыть их сайт"    onClick={onOpenSite}    color="#06b6d4" />
        <LinkBtn icon="LayoutDashboard"  label="Войти в их панель"  onClick={onLoginAs}     color="#a78bfa" />
        <LinkBtn icon="Zap"              label="Живые API"           onClick={onRunApiTests} color="#10b981" />
        <div className="ml-auto">
          <LinkBtn icon="Pencil" label="Редактировать бренд" onClick={onEditBrand} color="#f59e0b" />
        </div>
      </div>
    </Section>
  );
}
