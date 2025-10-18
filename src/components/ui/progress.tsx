import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export const Progress: React.FC<Props> = ({ value = 0, className = "", ...rest }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`w-full bg-muted rounded ${className}`} {...rest}>
      <div className="bg-primary h-full rounded" style={{ width: `${pct}%`, height: '100%' }} />
    </div>
  );
};

export default Progress;
