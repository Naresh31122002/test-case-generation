// Generates a unique story ID like STORY-XXXX-N
let _seq = 0;
export function makeStoryId(): string {
  _seq++;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `STORY-${rand}-${_seq}`;
}
