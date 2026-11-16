import type { ReactNode } from 'react';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  requirements: string[];
  children?: ReactNode;
  className?: string;
}

const ModuleCard = ({
  title,
  description,
  icon,
  gradient,
  requirements,
  children,
  className = '',
}: ModuleCardProps) => (
  <article className={`flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${gradient} p-4 shadow-sm ${className}`}>
    <div className="mb-3 flex items-start gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/70 text-primary shadow-inner [&_svg]:h-7 [&_svg]:w-7">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    {children && <div className="mb-3">{children}</div>}
    <div className="mt-auto flex flex-wrap gap-1.5 pt-3" aria-label={`${title} gereksinimleri`}>
      {requirements.map((requirement) => (
        <span key={requirement} className="rounded-full border border-white/10 bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
          {requirement}
        </span>
      ))}
    </div>
  </article>
);

export default ModuleCard;
