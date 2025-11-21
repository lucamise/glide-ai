const cache = new Map();

window.function = function (key, min, max) {
  // default values
  min = min.value ?? 0;
  max = max.value ?? 1;
  key = key.value ?? "";

  let num;
  // an empty key always returns a new random number
  if (key !== "") {
    num = cache.get(key);
  }
  if (num === undefined) {
    num = Math.random();
  }
  if (key !== "") {
    cache.set(key, num);
  }

  // scale at the end, so min/max can change between invocations
  return num * (max - min) + min;
}
