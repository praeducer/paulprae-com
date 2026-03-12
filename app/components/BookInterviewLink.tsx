import { CalendarIcon } from "./Icons";
import { BOOK_INTERVIEW_URL } from "../../lib/constants";

/**
 * Reusable "Book Interview" link — single source of truth for the booking
 * URL, accessibility attributes, and external-link behavior.
 * Accepts className for styling variants across header, contact row, and chips.
 *
 * No "use client" — works in both server and client components.
 */
export default function BookInterviewLink({
  className,
  iconClassName = "h-3.5 w-3.5",
  title,
  children,
}: {
  className?: string;
  iconClassName?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={BOOK_INTERVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Book interview with Paul (opens in new tab)"
      title={title}
      className={className}
    >
      <CalendarIcon className={iconClassName} />
      {children ?? "Book Interview"}
    </a>
  );
}
