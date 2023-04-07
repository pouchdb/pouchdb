function guardedConsole(method,...args) {
  console[method]?.apply(console, args);
}

export default guardedConsole;
