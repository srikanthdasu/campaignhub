export const EASE_SOFT = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

export const staggerContainer = (stagger = 0.06, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DURATION.base, ease: EASE_SOFT },
};

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -3, scale: 1.01 },
};

export const tapScale = { scale: 0.97 };
