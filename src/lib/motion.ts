export const easeStandard = [0.4, 0, 0.2, 1] as const;
export const easeOut = [0, 0, 0.2, 1] as const;
export const easeIn = [0.4, 0, 1, 1] as const;

export const duration = {
  instant: 0.1,
  fast: 0.15,
  base: 0.2,
  moderate: 0.3,
  slow: 0.5,
};

export const spring = {
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: duration.base, ease: easeStandard },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.base, ease: easeOut },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: duration.fast },
};

export const slideInRight = {
  initial: { x: 24, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 24, opacity: 0 },
  transition: { duration: 0.25, ease: easeStandard },
};

export const slideInLeft = {
  initial: { x: -24, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -24, opacity: 0 },
  transition: { duration: 0.25, ease: easeStandard },
};
