export const parseFloors = (floorsParam: string | undefined): number[] => {
  if (!floorsParam) return [];
  try {
    return JSON.parse(floorsParam);
  } catch {
    return [];
  }
};
