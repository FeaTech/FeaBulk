import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A small "i" button that explains what to enter in a field. The message shows on hover and
 * keyboard focus, and a click or tap pins it open until Escape or a click elsewhere.
 * Place it inside a positioned parent (see FieldLabel); the message spans that parent's width.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const message = useRef<HTMLSpanElement>(null);

  // Fields near the right edge would push the message off screen, so slide it back in.
  const keepOnScreen = () => {
    const element = message.current;
    if (!element) return;
    element.style.transform = "";
    const viewportWidth = document.documentElement.clientWidth;
    const box = element.getBoundingClientRect();
    // Never slide further than the left edge allows; a zero-width (hidden) page is left alone.
    const shift = Math.min(box.right - (viewportWidth - 8), box.left - 8);
    if (viewportWidth > 0 && shift > 0) element.style.transform = `translateX(-${shift}px)`;
  };
  useLayoutEffect(() => {
    if (pinned) keepOnScreen();
  }, [pinned]);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setPinned(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  return (
    <span
      ref={root}
      className="group/tip inline-flex"
      onMouseEnter={keepOnScreen}
      onFocus={keepOnScreen}
    >
      <button
        type="button"
        aria-label={`Help for ${label}`}
        aria-describedby={id}
        aria-expanded={pinned}
        onClick={(event) => {
          // Inside a <label>, a click must not also focus or toggle the field.
          event.preventDefault();
          setPinned((value) => !value);
        }}
        className="grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full border border-current font-serif text-[10px] font-bold italic leading-none opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F87908]"
      >
        i
      </button>
      <span
        id={id}
        ref={message}
        role="tooltip"
        className={`absolute left-0 top-full z-30 mt-1 w-64 min-w-full max-w-[80vw] bg-[#102B52] px-3 py-2 text-left text-xs font-normal normal-case leading-5 tracking-normal text-white shadow-lg ${
          pinned ? "block" : "hidden group-focus-within/tip:block group-hover/tip:block"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

/** A field's caption with an optional help icon; the positioned box the help message anchors to. */
export function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <span className="relative flex items-center gap-1.5">
      <span>{children ?? label}</span>
      {hint && <InfoTip label={label} text={hint} />}
    </span>
  );
}
