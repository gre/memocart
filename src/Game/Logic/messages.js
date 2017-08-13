//@flow
const isMobile = "ontouchstart" in document;

export const pressSpace = () => (isMobile ? "TAP here" : "Press SPACE");
export const holdSpace = () => (isMobile ? "TAP and HOLD" : "Hold SPACE");
export const spaceToSkip = () => (isMobile ? "TAP to skip" : "SPACE to skip");
export const pressRight = () => (isMobile ? "Swipe RIGHT" : "Press RIGHT");
