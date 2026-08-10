import { Switch } from "@/components/ui/switch";

interface Props {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Показать маленькую подпись под тумблером (напр. «выключено» / «работает») */
  label?: string;
  txtSub?: string;
}

/** Единый переключатель вкл/выкл для карточек интеграций. */
export default function EnabledToggle({ enabled, onChange, disabled, label, txtSub }: Props) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {label && (
        <span className="text-[10px] font-semibold" style={{ color: txtSub }}>{label}</span>
      )}
      <Switch checked={enabled} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
