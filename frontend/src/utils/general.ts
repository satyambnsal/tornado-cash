export const deepEqual = (obj1: object, obj2: object): boolean => {
  // Check for strict equality (handles primitive types)
  if (obj1 === obj2) return true;

  // Handle special cases
  if (
    typeof obj1 !== "object" ||
    typeof obj2 !== "object" ||
    obj1 === null ||
    obj2 === null
  ) {
    // Handle NaN (NaN !== NaN, but they are effectively equal)
    if (Number.isNaN(obj1) && Number.isNaN(obj2)) return true;
    return false;
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  // Handle Date objects
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  // Handle RegExp objects
  if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
    return obj1.toString() === obj2.toString();
  }

  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Different number of keys means they aren't equal
  if (keys1.length !== keys2.length) return false;

  // Check if all keys and their values are equal
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    // @ts-expect-error - obj1 and obj2 are objects with index signature
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
};
