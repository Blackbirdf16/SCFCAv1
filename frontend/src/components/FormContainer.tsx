import type { ReactNode } from "react";

interface FormContainerProps {
  title: string;
  children: ReactNode;
}

export default function FormContainer({ title, children }: Readonly<FormContainerProps>) {
  return (
    <section className="panel p-5">
      <h3 className="text-sm font-semibold tracking-tight theme-text mb-4 pb-3 theme-border" style={{ borderBottomWidth: 1 }}>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}