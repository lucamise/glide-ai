window.addEventListener("message", async function(event) {
  const { origin, data: { key, params } } = event;
  console.log("message", origin, key, params);

  let result;
  try {
    result = await window.function(...params);
  } catch (e) {
    result = undefined;
  }

  const response = { key };
  if (result !== undefined) {
    response.result = { type: "string", value: result };
  }

  event.source.postMessage(response, "*");
});
