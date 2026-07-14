(() => {
  const scene = document.querySelector("#scene");
  const status = document.querySelector("#status");
  const startButton = document.querySelector("#startButton");
  const trainButton = document.querySelector("#trainButton");
  const resetButton = document.querySelector("#resetButton");

  const setStatus = (message) => {
    status.textContent = message;
  };

  const startCrossing = () => {
    scene.classList.add("is-warning");
    setStatus("カンカンカン。警報灯が点滅し、遮断機が下がっています。");
  };

  const passTrain = () => {
    startCrossing();
    scene.classList.remove("train-running");
    window.requestAnimationFrame(() => {
      scene.classList.add("train-running");
      setStatus("列車が通過中です。遮断機の内側に入らないでください。");
    });
  };

  const resetCrossing = () => {
    scene.classList.remove("is-warning", "train-running");
    setStatus("待機中です。ボタンで踏切を操作できます。");
  };

  startButton.addEventListener("click", startCrossing);
  trainButton.addEventListener("click", passTrain);
  resetButton.addEventListener("click", resetCrossing);

  scene.addEventListener("animationend", (event) => {
    if (event.animationName === "train-pass") {
      scene.classList.remove("train-running");
      setStatus("列車が通過しました。必要に応じてリセットしてください。");
    }
  });
})();
