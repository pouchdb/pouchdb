const nextTick = typeof queueMicrotask === "function"
  ? queueMicrotask.bind(undefined)
  : function nextTick(fn) {
    Promise.resolve().then(fn);
  };

export default nextTick;
