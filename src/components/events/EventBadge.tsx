import { Badge } from "@/components/ui/badge";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { cn } from "@/lib/utils";

interface EventBadgeProps {
  tag: EventTag;
  className?: string;
  /** 
   * 'glowing' uses the new ultra-premium floating/gradient distinct styles.
   * 'solid' uses the original solid/flat backgrounds. 
   * 'secondary' forces a generic gray secondary badge look.
   * default is 'glowing'.
   */
  variant?: "glowing" | "solid" | "secondary";
  showIcon?: boolean;
}

export function EventBadge({ 
  tag, 
  className, 
  variant = "glowing",
  showIcon = false 
}: EventBadgeProps) {
  const category = EVENT_CATEGORIES[tag];
  
  if (!category) {
    return (
      <Badge variant="secondary" className={className}>
        {tag}
      </Badge>
    );
  }

  // Generic secondary style
  if (variant === "secondary") {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "px-2.5 py-0.5 text-xs font-medium transition-colors bg-secondary/50 text-secondary-foreground hover:bg-secondary border-transparent",
          className
        )}
      >
        {category.label}
      </Badge>
    );
  }

  // Original solid style
  if (variant === "solid") {
    return (
      <Badge 
        className={cn(
          "border-transparent hover:opacity-90",
          category.color,
          className
        )}
      >
        {category.label}
      </Badge>
    );
  }

  // Glowing ultra-premium style
  return (
    <Badge 
      variant="outline"
      className={cn(
        // Override conflicting base outline classes (like text-foreground)
        "bg-transparent !text-current",
        // Floating effects & sizing
        "px-2.5 py-0.5 text-xs font-semibold backdrop-blur-[2px] transition-all duration-300 hover:-translate-y-0.5",
        // Apply the dynamic theme from constants
        category.badgeTheme,
        className
      )}
    >
      {category.label}
    </Badge>
  );
}
