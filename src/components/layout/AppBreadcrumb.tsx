import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbItemProps {
  label: string;
  href?: string;
}

interface AppBreadcrumbProps {
  items: BreadcrumbItemProps[];
}

export function AppBreadcrumb({ items }: AppBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-4 sm:mb-6">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <BreadcrumbItem key={index}>
              {isLast ? (
                <BreadcrumbPage className="max-w-[200px] truncate">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild>
                    <Link href={item.href ?? "/"}>{item.label}</Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
