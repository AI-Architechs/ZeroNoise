if (window.top === window) {
  if (window.ZeroNoiseAdapters && window.ZeroNoiseCore) {
    const runtime = window.ZeroNoiseCore.createRuntime(window.ZeroNoiseAdapters);
    runtime.init();
  }
}
