export const easeOut: any = [0.16, 1, 0.3, 1];
export const easeStandard: any = [0.4, 0, 0.2, 1];

export const duration = {
  instant: 0.08,
  fast: 0.16,
  base: 0.28,
  moderate: 0.32,
  slow: 0.45,
} as const;

export const spring: any = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  snappy: {
    type: "spring",
    stiffness: 520,
    damping: 34,
  },
};

export const fadeInUp: any = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.base, ease: easeOut },
};

export const staggerContainer: any = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};
