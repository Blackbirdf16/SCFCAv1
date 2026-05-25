import type { ReactNode } from "react";

interface TableWrapperProps {
  title: string;
  children: ReactNode;
}

export default function TableWrapper({ title, children }: Readonly<TableWrapperProps>) {
  return (
    <section className="panel p-5">
      <h3 className="text-sm font-semibold tracking-tight theme-text mb-4 pb-3 theme-border" style={{ borderBottomWidth: 1 }}>
        {title}
      </h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}