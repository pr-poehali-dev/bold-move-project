import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';
import type { FC } from 'react';

interface IconProps extends LucideProps {
  name: string;
  fallback?: string;
}

const Icon: FC<IconProps> = ({ name, fallback = 'CircleAlert', ...props }) => {
  const IconComponent = (LucideIcons as Record<string, FC<LucideProps>>)[name];

  if (!IconComponent) {
    // Если иконка не найдена, используем fallback иконку
    const FallbackIcon = (LucideIcons as Record<string, FC<LucideProps>>)[fallback];

    // Если даже fallback не найден, возвращаем пустой span
    if (!FallbackIcon) {
      return <span className="text-xs text-gray-400">[icon]</span>;
    }

    return <FallbackIcon {...props} />;
  }

  return <IconComponent {...props} />;
};

export default Icon;