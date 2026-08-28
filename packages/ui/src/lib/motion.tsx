"use client";

import * as React from "react";
// These are the tree-shakeable Motion 13 entry modules. Keep the pinned
// dependency and paths together so the full `framer-motion` entry is never
// pulled into the application bundle.
import type { Transition } from "framer-motion";

const isTestEnvironment = typeof process !== "undefined" && process.env.NODE_ENV === "test";

type MotionElementProps = React.HTMLAttributes<HTMLElement> & {
  animate?: unknown;
  custom?: unknown;
  exit?: unknown;
  initial?: unknown;
  layout?: unknown;
  layoutDependency?: unknown;
  layoutId?: unknown;
  onAnimationComplete?: unknown;
  onAnimationStart?: unknown;
  transition?: Transition;
  variants?: unknown;
  viewport?: unknown;
  whileFocus?: unknown;
  whileHover?: unknown;
  whileInView?: unknown;
  whileTap?: unknown;
};

type MotionElement = React.ForwardRefExoticComponent<
  MotionElementProps & React.RefAttributes<HTMLElement>
>;

const stripMotionProps = ({
  animate: _animate,
  custom: _custom,
  exit: _exit,
  initial: _initial,
  layout: _layout,
  layoutDependency: _layoutDependency,
  layoutId: _layoutId,
  onAnimationComplete: _onAnimationComplete,
  onAnimationStart: _onAnimationStart,
  transition: _transition,
  variants: _variants,
  viewport: _viewport,
  whileFocus: _whileFocus,
  whileHover: _whileHover,
  whileInView: _whileInView,
  whileTap: _whileTap,
  ...domProps
}: MotionElementProps) => domProps;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(reducedMotionQuery).matches,
  );

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(reducedMotionQuery);
    const update = () => setReduced(mediaQuery.matches);

    update();
    mediaQuery.addEventListener?.("change", update);

    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function stripMotionTransforms(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const { transform: _transform, ...withoutTransform } = value as Record<string, unknown>;

  return withoutTransform;
}

function reduceMotionProps(props: MotionElementProps): MotionElementProps {
  return {
    ...props,
    animate: stripMotionTransforms(props.animate),
    exit: stripMotionTransforms(props.exit),
    initial: stripMotionTransforms(props.initial),
    layout: undefined,
    layoutDependency: undefined,
    layoutId: undefined,
  };
}

const createMotionElement = (tag: "div" | "span"): MotionElement => {
  const AsyncElement = React.lazy(async () => {
    const module = await import("motion/react-m");

    return { default: module[tag] as MotionElement };
  });

  return React.forwardRef<HTMLElement, MotionElementProps>((props, ref) => {
    const reducedMotion = usePrefersReducedMotion();
    const effectiveProps = reducedMotion ? reduceMotionProps(props) : props;

    // Unit tests assert the Base UI lifecycle synchronously. Rendering the
    // semantic element while the browser-only Motion chunk is absent keeps
    // those assertions deterministic without changing production behavior.
    if (isTestEnvironment) {
      return React.createElement(tag, { ...stripMotionProps(effectiveProps), ref });
    }

    return (
      <React.Suspense
        fallback={React.createElement(tag, { ...stripMotionProps(effectiveProps), ref })}
      >
        <AsyncElement {...effectiveProps} ref={ref} />
      </React.Suspense>
    );
  });
};

const m = {
  div: createMotionElement("div"),
  span: createMotionElement("span"),
};

type MotionRuntimeProps = {
  children?: React.ReactNode;
  [key: string]: unknown;
};
type MotionRuntimeComponent = React.ComponentType<MotionRuntimeProps>;

/**
 * The presence/configuration modules are loaded only when an app mounts the
 * provider. Keeping these imports behind React.lazy prevents the static app
 * entry from inheriting the full framer-motion runtime while retaining the
 * official LazyMotion + domMax lifecycle.
 */
const AsyncAnimatePresence = React.lazy(async () => {
  const module =
    // @ts-expect-error Motion does not expose the internal module declaration.
    await import("../../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");

  return { default: module.AnimatePresence as MotionRuntimeComponent };
});

const AsyncLazyMotion = React.lazy(async () => {
  const module =
    // @ts-expect-error Motion does not expose the internal module declaration.
    await import("../../node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs");

  return { default: module.LazyMotion as MotionRuntimeComponent };
});

const AsyncMotionConfig = React.lazy(async () => {
  const module =
    // @ts-expect-error Motion does not expose the internal module declaration.
    await import("../../node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs");

  return { default: module.MotionConfig as MotionRuntimeComponent };
});

type ControlledStateProps<T, Rest extends unknown[]> = {
  value?: T;
  defaultValue: T;
  onChange?: (value: T, ...args: Rest) => void;
};

/**
 * Keeps an overlay's local lifecycle in sync with both controlled and
 * uncontrolled roots while preserving Base UI's event details.
 */
export function useControlledState<T, Rest extends unknown[] = []>(
  props: ControlledStateProps<T, Rest>,
): readonly [T, (next: T, ...args: Rest) => void] {
  const { value, defaultValue, onChange } = props;
  const [internalValue, setInternalValue] = React.useState<T>(value ?? defaultValue);

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const setValue = React.useCallback(
    (next: T, ...args: Rest) => {
      setInternalValue(next);
      onChange?.(next, ...args);
    },
    [onChange],
  );

  return [value ?? internalValue, setValue] as const;
}

/**
 * Loads Motion's DOM feature bundle asynchronously so the shared UI package
 * does not pull the full `motion` component entry into every application.
 */
const loadDomFeatures = async () => {
  const { domMax } =
    // @ts-expect-error Motion does not expose the internal module declaration.
    await import("../../node_modules/framer-motion/dist/es/render/dom/features-max.mjs");

  return domMax;
};

export function UiMotionProvider({ children }: React.PropsWithChildren) {
  // Vitest renders the test tree synchronously. Keep that tree stable while
  // the browser-only Motion chunks are being requested in production.
  const [runtimeReady, setRuntimeReady] = React.useState(isTestEnvironment);

  React.useEffect(() => {
    // Do not suspend the initial SSR/hydration pass. TanStack Start keeps the
    // document body hidden until that pass commits; deferring the Motion
    // boundary to the first client effect preserves the existing first paint.
    setRuntimeReady(true);
  }, []);

  if (isTestEnvironment || !runtimeReady) {
    return children;
  }

  return (
    <React.Suspense fallback={children}>
      <AsyncLazyMotion features={loadDomFeatures} strict>
        <AsyncMotionConfig reducedMotion="user">{children}</AsyncMotionConfig>
      </AsyncLazyMotion>
    </React.Suspense>
  );
}

function TestAnimatePresence({ children }: MotionRuntimeProps) {
  const [rendered, setRendered] = React.useState<React.ReactNode>(children);

  React.useEffect(() => {
    if (children) {
      setRendered(children);

      return;
    }

    // Tests assert the Base UI lifecycle synchronously. Production keeps the
    // mounted subtree through Motion's exit animation; the test fallback must
    // remove a closed portal immediately so a subsequent trigger cannot target
    // a stale pointer-events:none element.
    setRendered(null);
  }, [children]);

  return <>{rendered}</>;
}

function AnimatePresence(props: MotionRuntimeProps) {
  if (isTestEnvironment) {
    return <TestAnimatePresence {...props} />;
  }

  return (
    <React.Suspense fallback={props.children}>
      <AsyncAnimatePresence {...props} />
    </React.Suspense>
  );
}

/** Observe Base UI's data-highlighted state without changing its semantics. */
export function useDataAttribute(ref: React.RefObject<HTMLElement | null>, attribute: string) {
  const [active, setActive] = React.useState(false);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      const value = element.getAttribute(attribute);
      setActive(value !== null && value !== "false");
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(element, { attributes: true, attributeFilter: [attribute] });

    return () => observer.disconnect();
  }, [attribute, ref]);

  return active;
}

export function MotionHighlight({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <m.span
          aria-hidden="true"
          data-slot="menu-highlight"
          className="pointer-events-none absolute inset-0 z-0 rounded-md bg-accent"
          initial={{ opacity: 0, transform: "scale(0.98)" }}
          animate={{ opacity: 1, transform: "scale(1)" }}
          exit={{ opacity: 0, transform: "scale(0.98)" }}
          transition={{ type: "spring", stiffness: 350, damping: 35 }}
        />
      )}
    </AnimatePresence>
  );
}

export { AnimatePresence, m, type Transition };
