async function nextTick(fn) {
  Promise.resolve().then(fn);
}

export default nextTick;