// PPS DOM drošības palīgs
window.ppsGet = function (id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`PPS: elements #${id} nav atrasts.`);
  }
  return element;
};

window.ppsOn = function (id, eventName, handler) {
  const element = window.ppsGet(id);
  if (element) element.addEventListener(eventName, handler);
};
